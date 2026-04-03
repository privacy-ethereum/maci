// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IBasePolicy } from "@excubiae/contracts/contracts/interfaces/IBasePolicy.sol";

import { IPollFactory } from "./interfaces/IPollFactory.sol";
import { IMessageProcessorFactory } from "./interfaces/IMessageProcessorFactory.sol";
import { ITallyFactory } from "./interfaces/ITallyFactory.sol";
import { IVerifier } from "./interfaces/IVerifier.sol";
import { IVerifyingKeysRegistry } from "./interfaces/IVerifyingKeysRegistry.sol";
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
  /// in contracts/ts/generateEmptyBallotRoots.ts file
  /// if we change the state tree depth!
  uint8 public immutable stateTreeDepth;

  uint256 public immutable maxSignups;

  uint8 internal constant STATE_TREE_ARITY = 2;

  /// @notice This is the poseidon hash of the pad key. Check crypto/SnarkConstants.sol for more info about the pad key.
  uint256 internal constant PAD_KEY_HASH = 1309255631273308531193241901289907343161346846555918942743921933037802809814;

  /// @notice This is poseidon_hash2([1,1]), used to verify that hash libraries are linked correctly
  uint256 internal constant POSEIDON_VALIDITY_CHECK_VALUE =
    217234377348884654691879377518794323857294947151490278790710809376325639809;

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

  /// @notice The verifier contract for zk-SNARK proofs
  /// This is send to the poll when deploying
  IVerifier public immutable verifier;

  /// @notice The verifying keys registry contract
  /// This is send to the poll when deploying
  IVerifyingKeysRegistry public immutable verifyingKeysRegistry;

  /// @notice The array of the state tree roots for each sign up
  /// For the N'th sign up, the state tree root will be stored at the index N
  uint256[] public stateRootsOnSignUp;

  struct InitParams {
    // The PollFactory contract
    IPollFactory pollFactory;
    // The MessageProcessorFactory contract
    IMessageProcessorFactory messageProcessorFactory;
    // The TallyFactory contract
    ITallyFactory tallyFactory;
    // MACI signup policy contract
    IBasePolicy signUpPolicy;
    // Verifier contract for zk-SNARK proofs
    IVerifier verifier;
    // Verifying keys registry contract for zk-SNARK proofs
    IVerifyingKeysRegistry verifyingKeysRegistry;
    // Depth of the state tree
    uint8 stateTreeDepth;
    // Roots of the empty ballot trees
    uint256[5] emptyBallotRoots;
  }

  // Events
  event SignUp(
    uint256 _stateIndex,
    uint256 _timestamp,
    uint256 indexed _userPublicKeyX,
    uint256 indexed _userPublicKeyY
  );
  event DeployPoll(
    uint256 _pollId,
    uint256 indexed _coordinatorPublicKeyX,
    uint256 indexed _coordinatorPublicKeyY,
    Mode _mode
  );

  /// @notice custom errors
  error PoseidonHashLibrariesNotLinked();
  error TooManySignups();
  error InvalidPublicKey();
  error InvalidVoteOptionTreeDepth(uint8 depth);
  error PollDoesNotExist(uint256 pollId);
  error UserNotSignedUp();

  /// @notice Create a new instance of the MACI contract.
  /// @param initParams The initialization parameters defined above
  constructor(InitParams memory initParams) payable {
    // initialize and insert the blank leaf
    InternalLeanIMT._insert(leanIMTData, PAD_KEY_HASH);
    stateRootsOnSignUp.push(PAD_KEY_HASH);

    pollFactory = initParams.pollFactory;
    messageProcessorFactory = initParams.messageProcessorFactory;
    tallyFactory = initParams.tallyFactory;
    signUpPolicy = initParams.signUpPolicy;
    verifier = initParams.verifier;
    verifyingKeysRegistry = initParams.verifyingKeysRegistry;
    stateTreeDepth = initParams.stateTreeDepth;
    maxSignups = uint256(STATE_TREE_ARITY) ** uint256(initParams.stateTreeDepth);
    emptyBallotRoots = initParams.emptyBallotRoots;

    // Verify linked poseidon libraries
    if (hash2([uint256(1), uint256(1)]) != POSEIDON_VALIDITY_CHECK_VALUE) revert PoseidonHashLibrariesNotLinked();
  }

  /// @inheritdoc IMACI
  function signUp(PublicKey memory _publicKey, bytes memory _signUpPolicyData) public virtual {
    // ensure we do not have more signups than what the circuits support
    if (leanIMTData.size >= maxSignups) revert TooManySignups();

    // ensure that the public key is on the baby jubjub curve
    if (!CurveBabyJubJub.isOnCurve(_publicKey.x, _publicKey.y)) {
      revert InvalidPublicKey();
    }

    // Register the user via the sign-up policy. This function should
    // throw if the user has already registered or if ineligible to do so.
    signUpPolicy.enforce(msg.sender, _signUpPolicyData);

    // Hash the public key and insert it into the tree.
    uint256 publicKeyHash = hashLeftRight(_publicKey.x, _publicKey.y);
    uint256 stateRoot = InternalLeanIMT._insert(leanIMTData, publicKeyHash);

    // Store the current state tree root in the array
    stateRootsOnSignUp.push(stateRoot);

    emit SignUp(leanIMTData.size - 1, block.timestamp, _publicKey.x, _publicKey.y);
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
    if (!CurveBabyJubJub.isOnCurve(args.coordinatorPublicKey.x, args.coordinatorPublicKey.y)) {
      revert InvalidPublicKey();
    }

    ExtContracts memory extContracts = ExtContracts({
      maci: IMACI(address(this)),
      verifier: verifier,
      verifyingKeysRegistry: verifyingKeysRegistry,
      policy: IBasePolicy(args.policy),
      initialVoiceCreditProxy: IInitialVoiceCreditProxy(args.initialVoiceCreditProxy)
    });

    uint8 voteOptionTreeDepth = args.treeDepths.voteOptionTreeDepth;

    if (voteOptionTreeDepth == 0 || voteOptionTreeDepth > emptyBallotRoots.length) {
      revert InvalidVoteOptionTreeDepth(voteOptionTreeDepth);
    }

    IPollFactory.DeployPollArgs memory deployPollArgs = IPollFactory.DeployPollArgs({
      startDate: args.startDate,
      endDate: args.endDate,
      treeDepths: args.treeDepths,
      messageBatchSize: args.messageBatchSize,
      coordinatorPublicKey: args.coordinatorPublicKey,
      extContracts: extContracts,
      emptyBallotRoot: emptyBallotRoots[voteOptionTreeDepth - 1],
      pollId: pollId,
      relayers: args.relayers,
      voteOptions: args.voteOptions
    });

    address poll = pollFactory.deploy(deployPollArgs);
    address messageProcessor = messageProcessorFactory.deploy(
      address(verifier),
      address(verifyingKeysRegistry),
      poll,
      args.mode
    );
    address tally = tallyFactory.deploy(
      address(verifier),
      address(verifyingKeysRegistry),
      poll,
      messageProcessor,
      args.mode
    );

    // store the addresses in a struct so they can be returned
    PollContracts memory pollAddresses = PollContracts({
      poll: poll,
      messageProcessor: messageProcessor,
      tally: tally
    });

    polls[pollId] = pollAddresses;

    emit DeployPoll(pollId, args.coordinatorPublicKey.x, args.coordinatorPublicKey.y, args.mode);

    return pollAddresses;
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
  function totalSignups() public view returns (uint256 signUps) {
    signUps = leanIMTData.size;
  }

  /// @inheritdoc IMACI
  function getStateRootOnIndexedSignUp(uint256 _index) external view returns (uint256 stateRoot) {
    stateRoot = stateRootsOnSignUp[_index];
  }

  /// @inheritdoc IMACI
  function getStateIndex(uint256 _publicKeyHash) external view returns (uint256) {
    uint256 index = leanIMTData.leaves[_publicKeyHash];

    if (index == 0) revert UserNotSignedUp();

    // need to subtract 1 because the index is 1 indexed due to 0 index reserved for deleted leaves
    return index - 1;
  }
}
