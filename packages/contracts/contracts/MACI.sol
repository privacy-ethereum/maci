// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IBasePolicy } from "@excubiae/contracts/contracts/interfaces/IBasePolicy.sol";

import { IPollFactory } from "./interfaces/IPollFactory.sol";
import { IMessageProcessorFactory } from "./interfaces/IMPFactory.sol";
import { ITallyFactory } from "./interfaces/ITallyFactory.sol";
import { IVerifier } from "./interfaces/IVerifier.sol";
import { IVkRegistry } from "./interfaces/IVkRegistry.sol";
import { IInitialVoiceCreditProxy } from "./interfaces/IInitialVoiceCreditProxy.sol";
import { IMACI } from "./interfaces/IMACI.sol";
import { Params } from "./utilities/Params.sol";
import { DomainObjs } from "./utilities/DomainObjs.sol";
import { CurveBabyJubJub } from "./crypto/BabyJubJub.sol";
import { Hasher } from "./crypto/Hasher.sol";
import { InternalLeanIMT, LeanIMTData } from "./trees/LeanIMT.sol";

/// @title MACI - Minimum Anti-Collusion Infrastructure Version 1
/// @notice A contract which allows users to sign up, and deploy new polls
contract MACI is IMACI, DomainObjs, Params, Hasher {
  /// @notice The state tree depth is fixed. As such it should be as large as feasible
  /// so that there can be as many users as possible.  i.e. 2 ** 23 = 8388608
  /// this should also match the parameter of the circom circuits.
  /// @notice IMPORTANT: remember to change the ballot tree depth
  /// in contracts/ts/genEmptyBallotRootsContract.ts file
  /// if we change the state tree depth!
  uint8 public immutable stateTreeDepth;

  uint256 public immutable maxSignups;

  uint8 internal constant STATE_TREE_ARITY = 2;

  /// @notice This is the poseidon hash of the pad key
  uint256 internal constant PAD_KEY_HASH = 1309255631273308531193241901289907343161346846555918942743921933037802809814;

  /// @notice The roots of the empty ballot trees
  uint256[5] public emptyBallotRoots;

  /// @notice Each poll has an incrementing ID
  uint256 public nextPollId;

  /// @notice A mapping of poll IDs to Poll contracts.
  mapping(uint256 => PollContracts) public polls;

  /// @notice Factory contract that deploy a Poll contract
  IPollFactory public immutable pollFactory;

  /// @notice Factory contract that deploy a MessageProcessor contract
  IMessageProcessorFactory public immutable messageProcessorFactory;

  /// @notice Factory contract that deploy a Tally contract
  ITallyFactory public immutable tallyFactory;

  /// @notice The state tree. Stores users' public keys
  LeanIMTData public leanIMTData;

  /// @notice Address of the signup policy, a contract which determines whether a
  /// user may sign up to vote
  IBasePolicy public immutable signUpPolicy;

  /// @notice The array of the state tree roots for each sign up
  /// For the N'th sign up, the state tree root will be stored at the index N
  uint256[] public stateRootsOnSignUp;

  // Events
  event SignUp(uint256 _stateIndex, uint256 _timestamp, uint256 indexed _userPubKeyX, uint256 indexed _userPubKeyY);
  event DeployPoll(
    uint256 _pollId,
    uint256 indexed _coordinatorPubKeyX,
    uint256 indexed _coordinatorPubKeyY,
    Mode _mode
  );

  /// @notice custom errors
  error PoseidonHashLibrariesNotLinked();
  error TooManySignups();
  error InvalidPubKey();
  error PollDoesNotExist(uint256 pollId);
  error UserNotSignedUp();

  /// @notice Create a new instance of the MACI contract.
  /// @param _pollFactory The PollFactory contract
  /// @param _messageProcessorFactory The MessageProcessorFactory contract
  /// @param _tallyFactory The TallyFactory contract
  /// @param _signUpPolicy The signup policy contract
  /// @param _stateTreeDepth The depth of the state tree
  /// @param _emptyBallotRoots The roots of the empty ballot trees
  constructor(
    IPollFactory _pollFactory,
    IMessageProcessorFactory _messageProcessorFactory,
    ITallyFactory _tallyFactory,
    IBasePolicy _signUpPolicy,
    uint8 _stateTreeDepth,
    uint256[5] memory _emptyBallotRoots
  ) payable {
    // initialize and insert the blank leaf
    InternalLeanIMT._insert(leanIMTData, PAD_KEY_HASH);
    stateRootsOnSignUp.push(PAD_KEY_HASH);

    pollFactory = _pollFactory;
    messageProcessorFactory = _messageProcessorFactory;
    tallyFactory = _tallyFactory;
    signUpPolicy = _signUpPolicy;
    stateTreeDepth = _stateTreeDepth;
    maxSignups = uint256(STATE_TREE_ARITY) ** uint256(_stateTreeDepth);
    emptyBallotRoots = _emptyBallotRoots;

    // Verify linked poseidon libraries
    if (hash2([uint256(1), uint256(1)]) == 0) revert PoseidonHashLibrariesNotLinked();
  }

  /// @inheritdoc IMACI
  function signUp(PubKey memory _pubKey, bytes memory _signUpPolicyData) public virtual {
    // ensure we do not have more signups than what the circuits support
    if (leanIMTData.size >= maxSignups) revert TooManySignups();

    // ensure that the public key is on the baby jubjub curve
    if (!CurveBabyJubJub.isOnCurve(_pubKey.x, _pubKey.y)) {
      revert InvalidPubKey();
    }

    // Register the user via the sign-up policy. This function should
    // throw if the user has already registered or if ineligible to do so.
    signUpPolicy.enforce(msg.sender, _signUpPolicyData);

    // Hash the public key and insert it into the tree.
    uint256 pubKeyHash = hashLeftRight(_pubKey.x, _pubKey.y);
    uint256 stateRoot = InternalLeanIMT._insert(leanIMTData, pubKeyHash);

    // Store the current state tree root in the array
    stateRootsOnSignUp.push(stateRoot);

    emit SignUp(leanIMTData.size - 1, block.timestamp, _pubKey.x, _pubKey.y);
  }

  /// @inheritdoc IMACI
  function deployPoll(DeployPollArgs memory args) public virtual returns (PollContracts memory) {
    // cache the poll to a local variable so we can increment it
    uint256 pollId = nextPollId;

    // Increment the poll ID for the next poll
    // 2 ** 256 polls available
    unchecked {
      nextPollId++;
    }

    // check coordinator key is a valid point on the curve
    if (!CurveBabyJubJub.isOnCurve(args.coordinatorPubKey.x, args.coordinatorPubKey.y)) {
      revert InvalidPubKey();
    }

    ExtContracts memory extContracts = ExtContracts({
      maci: IMACI(address(this)),
      verifier: IVerifier(args.verifier),
      vkRegistry: IVkRegistry(args.vkRegistry),
      policy: IBasePolicy(args.policy),
      initialVoiceCreditProxy: IInitialVoiceCreditProxy(args.initialVoiceCreditProxy)
    });

    IPollFactory.DeployPollArgs memory deployPollArgs = IPollFactory.DeployPollArgs({
      startDate: args.startDate,
      endDate: args.endDate,
      treeDepths: args.treeDepths,
      messageBatchSize: args.messageBatchSize,
      coordinatorPubKey: args.coordinatorPubKey,
      extContracts: extContracts,
      emptyBallotRoot: emptyBallotRoots[args.treeDepths.voteOptionTreeDepth - 1],
      pollId: pollId,
      relayers: args.relayers,
      voteOptions: args.voteOptions
    });

    address p = pollFactory.deploy(deployPollArgs);
    address mp = messageProcessorFactory.deploy(args.verifier, args.vkRegistry, p, args.mode);
    address tally = tallyFactory.deploy(args.verifier, args.vkRegistry, p, mp, args.mode);

    // store the addresses in a struct so they can be returned
    PollContracts memory pollAddr = PollContracts({ poll: p, messageProcessor: mp, tally: tally });

    polls[pollId] = pollAddr;

    emit DeployPoll(pollId, args.coordinatorPubKey.x, args.coordinatorPubKey.y, args.mode);

    return pollAddr;
  }

  /// @inheritdoc IMACI
  function getStateTreeRoot() public view returns (uint256 root) {
    root = InternalLeanIMT._root(leanIMTData);
  }

  /// @notice Get the Poll details
  /// @param _pollId The identifier of the Poll to retrieve
  /// @return pollContracts The Poll contract object
  function getPoll(uint256 _pollId) public view returns (PollContracts memory pollContracts) {
    if (_pollId >= nextPollId) revert PollDoesNotExist(_pollId);
    pollContracts = polls[_pollId];
  }

  /// @inheritdoc IMACI
  function numSignUps() public view returns (uint256 signUps) {
    signUps = leanIMTData.size;
  }

  /// @inheritdoc IMACI
  function getStateRootOnIndexedSignUp(uint256 _index) external view returns (uint256 stateRoot) {
    stateRoot = stateRootsOnSignUp[_index];
  }

  /// @inheritdoc IMACI
  function getStateIndex(uint256 _pubKeyHash) external view returns (uint256) {
    uint256 index = leanIMTData.leaves[_pubKeyHash];

    if (index == 0) revert UserNotSignedUp();

    // need to subtract 1 because the index is 1 indexed due to 0 index reserved for deleted leaves
    return index - 1;
  }
}
