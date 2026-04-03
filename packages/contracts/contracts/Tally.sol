// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Clone } from "@excubiae/contracts/contracts/proxy/Clone.sol";

import { IMACI } from "./interfaces/IMACI.sol";
import { Hasher } from "./crypto/Hasher.sol";
import { IPoll } from "./interfaces/IPoll.sol";
import { ITally } from "./interfaces/ITally.sol";
import { IMessageProcessor } from "./interfaces/IMessageProcessor.sol";
import { SnarkCommon } from "./crypto/SnarkCommon.sol";
import { IVerifier } from "./interfaces/IVerifier.sol";
import { IVerifyingKeysRegistry } from "./interfaces/IVerifyingKeysRegistry.sol";
import { DomainObjs } from "./utilities/DomainObjs.sol";

/// @title Tally
/// @notice The Tally contract is used during votes tallying
/// and by users to verify the tally results.
contract Tally is Clone, SnarkCommon, Hasher, DomainObjs, ITally {
  uint256 internal constant TREE_ARITY = 2;
  uint256 internal constant VOTE_OPTION_TREE_ARITY = 5;

  /// @notice The commitment to the tally results. Its initial value is 0, but after
  /// the tally of each batch is proven on-chain via a zk-SNARK, it should be
  /// updated to:
  ///
  /// QV:
  /// hash3(
  ///   hashLeftRight(merkle root of current results, salt0)
  ///   hashLeftRight(number of spent voice credits, salt1),
  ///   hashLeftRight(merkle root of the no. of spent voice credits per vote option, salt2)
  /// )
  ///
  /// Non-QV or Full:
  /// hash2(
  ///   hashLeftRight(merkle root of current results, salt0)
  ///   hashLeftRight(number of spent voice credits, salt1),
  /// )
  ///
  /// Where each salt is unique and the merkle roots are of arrays of leaves
  /// TREE_ARITY ** voteOptionTreeDepth long.
  uint256 public tallyCommitment;

  uint256 public tallyBatchNum;

  // The final commitment to the state and ballot roots
  uint256 public sbCommitment;

  IVerifier public verifier;
  IVerifyingKeysRegistry public verifyingKeysRegistry;
  IPoll public poll;
  IMessageProcessor public messageProcessor;
  Mode public mode;

  // The tally results
  mapping(uint256 => TallyResult) internal tallyResults;

  // The total tally results number
  uint256 public totalTallyResults;

  // spent field retrieved in the totalSpentVoiceCredits object
  uint256 public totalSpent;

  /// @notice events
  event ResultAdded(uint256 indexed voteOptionIndex, uint256 indexed tallyResult);

  /// @notice custom errors
  error ProcessingNotComplete();
  error InvalidTallyVotesProof();
  error AllBallotsTallied();
  error NotSupported();
  error VotesNotTallied();
  error IncorrectSpentVoiceCredits();

  /// @notice Initializes the contract.
  function _initialize() internal override {
    super._initialize();

    bytes memory data = _getAppendedBytes();
    (address _verifier, address _verifyingKeysRegistry, address _poll, address _mp, Mode _mode) = abi.decode(
      data,
      (address, address, address, address, Mode)
    );

    verifier = IVerifier(_verifier);
    verifyingKeysRegistry = IVerifyingKeysRegistry(_verifyingKeysRegistry);
    poll = IPoll(_poll);
    messageProcessor = IMessageProcessor(_mp);
    mode = _mode;
  }

  /// @inheritdoc ITally
  function isTallied() public view returns (bool tallied) {
    (uint8 tallyProcessingStateTreeDepth, , ) = poll.treeDepths();
    uint256 totalSignups = poll.totalSignups();

    uint256 pollEndDate = poll.endDate();

    if (pollEndDate > block.timestamp) {
      tallied = false;
    } else {
      // Require that there are untallied ballots left
      tallied = tallyBatchNum * (TREE_ARITY ** tallyProcessingStateTreeDepth) >= totalSignups;
    }
  }

  /// @inheritdoc ITally
  function getTallyResults(uint256 index) public view returns (TallyResult memory) {
    return tallyResults[index];
  }

  /// @inheritdoc ITally
  function updateSbCommitment() public {
    // Require that all messages have been processed
    if (!messageProcessor.processingComplete()) {
      revert ProcessingNotComplete();
    }

    if (sbCommitment == 0) {
      sbCommitment = messageProcessor.sbCommitment();
    }
  }

  /// @inheritdoc ITally
  function tallyVotes(uint256 _newTallyCommitment, uint256[8] calldata _proof) public {
    updateSbCommitment();

    // get the batch size and start index
    (uint8 tallyProcessingStateTreeDepth, , ) = poll.treeDepths();
    uint256 tallyBatchSize = TREE_ARITY ** tallyProcessingStateTreeDepth;
    uint256 batchStartIndex = tallyBatchNum * tallyBatchSize;

    (uint256 totalSignups, ) = poll.totalSignupsAndMessages();

    // Require that there are untallied ballots left
    if (batchStartIndex >= totalSignups) {
      revert AllBallotsTallied();
    }

    // save some gas because we won't overflow uint256
    unchecked {
      tallyBatchNum++;
    }

    if (!verifyTallyProof(batchStartIndex, _newTallyCommitment, _proof)) {
      revert InvalidTallyVotesProof();
    }

    // Update the tally commitment and the tally batch num
    tallyCommitment = _newTallyCommitment;
  }

  /// @inheritdoc ITally
  function getPublicCircuitInputs(
    uint256 _batchStartIndex,
    uint256 _newTallyCommitment
  ) public view returns (uint256[] memory publicInputs) {
    (uint256 totalSignups, ) = poll.totalSignupsAndMessages();

    publicInputs = new uint256[](5);
    publicInputs[0] = sbCommitment;
    publicInputs[1] = tallyCommitment;
    publicInputs[2] = _newTallyCommitment;
    publicInputs[3] = _batchStartIndex;
    publicInputs[4] = totalSignups;
  }

  /// @inheritdoc ITally
  function verifyTallyProof(
    uint256 _batchStartIndex,
    uint256 _newTallyCommitment,
    uint256[8] calldata _proof
  ) public view returns (bool isValid) {
    (uint8 tallyProcessingStateTreeDepth, uint8 voteOptionTreeDepth, ) = poll.treeDepths();
    uint256[] memory circuitPublicInputs = getPublicCircuitInputs(_batchStartIndex, _newTallyCommitment);
    IMACI maci = poll.getMaciContract();

    // Get the verifying key
    VerifyingKey memory verifyingKey = verifyingKeysRegistry.getTallyVerifyingKey(
      maci.stateTreeDepth(),
      tallyProcessingStateTreeDepth,
      voteOptionTreeDepth,
      mode
    );
    // Verify the proof
    isValid = verifier.verify(_proof, verifyingKey, circuitPublicInputs);
  }

  /// @notice Compute the merkle root from the path elements
  /// and a leaf
  /// @param _depth the depth of the merkle tree
  /// @param _index the index of the leaf
  /// @param _leaf the leaf
  /// @param _pathElements the path elements to reconstruct the merkle root
  /// @return current The merkle root
  function computeMerkleRootFromPath(
    uint8 _depth,
    uint256 _index,
    uint256 _leaf,
    uint256[][] calldata _pathElements
  ) internal pure returns (uint256 current) {
    uint256 pos = _index % VOTE_OPTION_TREE_ARITY;
    current = _leaf;
    uint8 k;

    uint256[VOTE_OPTION_TREE_ARITY] memory level;

    for (uint8 i = 0; i < _depth; ++i) {
      for (uint8 j = 0; j < VOTE_OPTION_TREE_ARITY; ++j) {
        if (j == pos) {
          level[j] = current;
        } else {
          if (j > pos) {
            k = j - 1;
          } else {
            k = j;
          }
          level[j] = _pathElements[i][k];
        }
      }

      _index /= VOTE_OPTION_TREE_ARITY;
      pos = _index % VOTE_OPTION_TREE_ARITY;
      current = hash5(level);
    }
  }

  /// @inheritdoc ITally
  function verifySpentVoiceCredits(
    uint256 _totalSpent,
    uint256 _totalSpentSalt,
    uint256 _resultCommitment,
    uint256 _perVoteOptionSpentVoiceCreditsHash
  ) public view returns (bool isValid) {
    if (mode == Mode.QV) {
      isValid = verifyQvSpentVoiceCredits(
        _totalSpent,
        _totalSpentSalt,
        _resultCommitment,
        _perVoteOptionSpentVoiceCreditsHash
      );
    } else if (mode == Mode.NON_QV || mode == Mode.FULL) {
      isValid = verifyNonQvSpentVoiceCredits(_totalSpent, _totalSpentSalt, _resultCommitment);
    }
  }

  /// @notice Verify the number of spent voice credits for QV from the tally.json
  /// @param _totalSpent spent field retrieved in the totalSpentVoiceCredits object
  /// @param _totalSpentSalt the corresponding salt in the totalSpentVoiceCredit object
  /// @param _resultCommitment hashLeftRight(merkle root of the results.tally, results.salt) in tally.json file
  /// @param _perVoteOptionSpentVoiceCreditsHash hashLeftRight(merkle root of the no spent voice credits per vote option, salt)
  /// @return isValid Whether the provided values are valid
  function verifyQvSpentVoiceCredits(
    uint256 _totalSpent,
    uint256 _totalSpentSalt,
    uint256 _resultCommitment,
    uint256 _perVoteOptionSpentVoiceCreditsHash
  ) internal view returns (bool isValid) {
    uint256[3] memory tally;
    tally[0] = _resultCommitment;
    tally[1] = hashLeftRight(_totalSpent, _totalSpentSalt);
    tally[2] = _perVoteOptionSpentVoiceCreditsHash;

    isValid = hash3(tally) == tallyCommitment;
  }

  /// @notice Verify the number of spent voice credits for Non-QV from the tally.json
  /// @param _totalSpent spent field retrieved in the totalSpentVoiceCredits object
  /// @param _totalSpentSalt the corresponding salt in the totalSpentVoiceCredit object
  /// @param _resultCommitment hashLeftRight(merkle root of the results.tally, results.salt) in tally.json file
  /// @return isValid Whether the provided values are valid
  function verifyNonQvSpentVoiceCredits(
    uint256 _totalSpent,
    uint256 _totalSpentSalt,
    uint256 _resultCommitment
  ) internal view returns (bool isValid) {
    uint256[2] memory tally;
    tally[0] = _resultCommitment;
    tally[1] = hashLeftRight(_totalSpent, _totalSpentSalt);

    isValid = hash2(tally) == tallyCommitment;
  }

  /// @inheritdoc ITally
  function verifyPerVoteOptionSpentVoiceCredits(
    uint256 _voteOptionIndex,
    uint256 _spent,
    uint256[][] calldata _spentProof,
    uint256 _spentSalt,
    uint8 _voteOptionTreeDepth,
    uint256 _spentVoiceCreditsHash,
    uint256 _resultCommitment
  ) public view returns (bool isValid) {
    if (mode != Mode.QV) {
      revert NotSupported();
    }

    uint256 computedRoot = computeMerkleRootFromPath(_voteOptionTreeDepth, _voteOptionIndex, _spent, _spentProof);

    uint256[3] memory tally;
    tally[0] = _resultCommitment;
    tally[1] = _spentVoiceCreditsHash;
    tally[2] = hashLeftRight(computedRoot, _spentSalt);

    isValid = hash3(tally) == tallyCommitment;
  }

  /// @inheritdoc ITally
  function verifyTallyResult(
    uint256 _voteOptionIndex,
    uint256 _tallyResult,
    uint256[][] calldata _tallyResultProof,
    uint256 _tallyResultSalt,
    uint8 _voteOptionTreeDepth,
    uint256 _spentVoiceCreditsHash,
    uint256 _perVoteOptionSpentVoiceCreditsHash
  ) public view returns (bool isValid) {
    uint256 computedRoot = computeMerkleRootFromPath(
      _voteOptionTreeDepth,
      _voteOptionIndex,
      _tallyResult,
      _tallyResultProof
    );

    if (mode == Mode.QV) {
      uint256[3] memory tally;
      tally[0] = hashLeftRight(computedRoot, _tallyResultSalt);
      tally[1] = _spentVoiceCreditsHash;
      tally[2] = _perVoteOptionSpentVoiceCreditsHash;

      isValid = hash3(tally) == tallyCommitment;
    } else if (mode == Mode.NON_QV || mode == Mode.FULL) {
      uint256[2] memory tally;
      tally[0] = hashLeftRight(computedRoot, _tallyResultSalt);
      tally[1] = _spentVoiceCreditsHash;

      isValid = hash2(tally) == tallyCommitment;
    }
  }

  /**
   * @inheritdoc ITally
   */
  function addTallyResults(ITally.AddTallyResultsArgs calldata args) public virtual {
    if (!isTallied()) {
      revert VotesNotTallied();
    }

    (, uint8 voteOptionTreeDepth, ) = poll.treeDepths();
    uint256 voteOptionsLength = args.voteOptionIndices.length;

    for (uint256 i = 0; i < voteOptionsLength; ) {
      addTallyResult(
        args.voteOptionIndices[i],
        args.tallyResults[i],
        args.tallyResultProofs[i],
        args.tallyResultSalt,
        args.spentVoiceCreditsHash,
        args.perVOSpentVoiceCreditsHash,
        voteOptionTreeDepth
      );

      unchecked {
        i++;
      }
    }

    bool verified = verifySpentVoiceCredits(
      args.totalSpent,
      args.totalSpentSalt,
      args.newResultsCommitment,
      args.perVOSpentVoiceCreditsHash
    );

    if (!verified) {
      revert IncorrectSpentVoiceCredits();
    }

    totalSpent = args.totalSpent;
  }

  /**
   * @dev Add and verify tally votes and calculate sum of tally squares for alpha calculation.
   * @param _voteOptionIndex Vote option index.
   * @param _tallyResult The results of vote tally for the recipients.
   * @param _tallyResultProof Proofs of correctness of the vote tally results.
   * @param _tallyResultSalt the respective salt in the results object in the tally.json
   * @param _spentVoiceCreditsHash hashLeftRight(number of spent voice credits, spent salt)
   * @param _perVoteOptionSpentVoiceCreditsHash hashLeftRight(root of noSpentVoiceCreditsPerVoteOption, perVoteOptionSpentVoiceCredits)
   * @param _voteOptionTreeDepth vote option tree depth
   */
  function addTallyResult(
    uint256 _voteOptionIndex,
    uint256 _tallyResult,
    uint256[][] calldata _tallyResultProof,
    uint256 _tallyResultSalt,
    uint256 _spentVoiceCreditsHash,
    uint256 _perVoteOptionSpentVoiceCreditsHash,
    uint8 _voteOptionTreeDepth
  ) internal virtual {
    bool isValid = verifyTallyResult(
      _voteOptionIndex,
      _tallyResult,
      _tallyResultProof,
      _tallyResultSalt,
      _voteOptionTreeDepth,
      _spentVoiceCreditsHash,
      _perVoteOptionSpentVoiceCreditsHash
    );

    if (!isValid) {
      revert InvalidTallyVotesProof();
    }

    TallyResult storage previous = tallyResults[_voteOptionIndex];

    if (!previous.isSet) {
      previous.isSet = true;
      totalTallyResults++;
    }

    previous.value = _tallyResult;

    emit ResultAdded(_voteOptionIndex, _tallyResult);
  }
}
