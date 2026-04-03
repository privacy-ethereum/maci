// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Clone } from "@excubiae/contracts/contracts/proxy/Clone.sol";

import { IMACI } from "./interfaces/IMACI.sol";
import { IPoll } from "./interfaces/IPoll.sol";
import { SnarkCommon } from "./crypto/SnarkCommon.sol";
import { Hasher } from "./crypto/Hasher.sol";
import { IVerifier } from "./interfaces/IVerifier.sol";
import { IVerifyingKeysRegistry } from "./interfaces/IVerifyingKeysRegistry.sol";
import { IMessageProcessor } from "./interfaces/IMessageProcessor.sol";
import { DomainObjs } from "./utilities/DomainObjs.sol";

/// @title MessageProcessor
/// @dev MessageProcessor is used to process messages published by signup users.
/// It will process message by batch due to large size of messages.
/// After it finishes processing, the sbCommitment will be used for Tally and Subsidy contracts.
contract MessageProcessor is Clone, SnarkCommon, Hasher, IMessageProcessor, DomainObjs {
  /// @notice custom errors
  error NoMoreMessages();
  error InvalidProcessMessageProof();

  /// @inheritdoc IMessageProcessor
  bool public processingComplete;

  /// @notice  The number of batches processed
  uint256 public totalBatchesProcessed;

  /// @notice The current message batch index
  uint256 public currentBatchIndex;

  /// @inheritdoc IMessageProcessor
  uint256 public sbCommitment;

  IPoll public poll;
  IVerifier public verifier;
  IVerifyingKeysRegistry public verifyingKeysRegistry;
  Mode public mode;

  /// @notice Initializes the contract.
  function _initialize() internal override {
    super._initialize();

    bytes memory data = _getAppendedBytes();
    (address _verifier, address _verifyingKeysRegistry, address _poll, Mode _mode) = abi.decode(
      data,
      (address, address, address, Mode)
    );

    verifier = IVerifier(_verifier);
    verifyingKeysRegistry = IVerifyingKeysRegistry(_verifyingKeysRegistry);
    poll = IPoll(_poll);
    mode = _mode;
    currentBatchIndex = 1;
  }

  /// @notice Update the Poll's currentSbCommitment if the proof is valid.
  /// @param _newSbCommitment The new state root and ballot root commitment
  ///                         after all messages are processed
  /// @param _proof The zk-SNARK proof
  function processMessages(uint256 _newSbCommitment, uint256[8] calldata _proof) external {
    // There must be unprocessed messages
    if (processingComplete) {
      revert NoMoreMessages();
    }

    (, uint8 voteOptionTreeDepth, ) = poll.treeDepths();
    uint8 messageBatchSize = poll.messageBatchSize();

    uint256[] memory batchHashes;
    // Copy the state and ballot commitment and set the batch index if this
    // is the first batch to process
    if (totalBatchesProcessed == 0) {
      uint256 currentSbCommitment = poll.currentSbCommitment();
      sbCommitment = currentSbCommitment;

      /// @notice this also checks that the voting period is over so we do not
      /// need to check it in this function
      poll.padLastBatch();
      batchHashes = poll.getBatchHashes();
      currentBatchIndex = batchHashes.length - 1;
    } else {
      batchHashes = poll.getBatchHashes();
    }

    uint256 outputBatchHash = batchHashes[currentBatchIndex];

    if (
      !verifyProcessProof(
        currentBatchIndex,
        outputBatchHash,
        _newSbCommitment,
        messageBatchSize,
        voteOptionTreeDepth,
        _proof
      )
    ) {
      revert InvalidProcessMessageProof();
    }

    (, uint256 numMessages) = poll.totalSignupsAndMessages();

    updateMessageProcessingData(_newSbCommitment, numMessages <= messageBatchSize * (totalBatchesProcessed + 1));
  }

  /// @inheritdoc IMessageProcessor
  function getPublicCircuitInputs(
    uint256 _currentMessageBatchIndex,
    uint256 _newSbCommitment,
    uint256 _outputBatchHash
  ) public view override returns (uint256[] memory publicInputs) {
    uint256 coordinatorPublicKeyHash = poll.coordinatorPublicKeyHash();
    uint8 messageBatchSize = poll.messageBatchSize();
    (uint256 totalSignups, uint256 numMessages) = poll.totalSignupsAndMessages();
    uint256 batchEndIndex = _currentMessageBatchIndex * messageBatchSize;

    if (batchEndIndex > numMessages) {
      batchEndIndex = numMessages;
    }

    uint256 batchStartIndex = _currentMessageBatchIndex > 0 ? (_currentMessageBatchIndex - 1) * messageBatchSize : 0;

    publicInputs = new uint256[](9);
    publicInputs[0] = totalSignups;
    publicInputs[1] = _outputBatchHash;
    publicInputs[2] = poll.actualStateTreeDepth();
    publicInputs[3] = coordinatorPublicKeyHash;
    publicInputs[4] = poll.voteOptions();
    publicInputs[5] = (sbCommitment == 0 ? poll.currentSbCommitment() : sbCommitment);
    publicInputs[6] = _newSbCommitment;
    publicInputs[7] = batchStartIndex;
    publicInputs[8] = batchEndIndex;
  }

  /// @notice Verify the proof for processMessage
  /// @dev used to update the sbCommitment
  /// @param _currentBatchIndex The batch index of current message batch
  /// @param _outputBatchHash The output batch hash
  /// @param _newSbCommitment The new sbCommitment after we update this message batch
  /// @param _messageBatchSize The message batch size
  /// @param _voteOptionTreeDepth The vote option tree depth
  /// @param _proof The zk-SNARK proof
  /// @return isValid Whether the proof is valid
  function verifyProcessProof(
    uint256 _currentBatchIndex,
    uint256 _outputBatchHash,
    uint256 _newSbCommitment,
    uint8 _messageBatchSize,
    uint8 _voteOptionTreeDepth,
    uint256[8] memory _proof
  ) internal view returns (bool isValid) {
    // get the tree depths
    // get the message batch size from the message tree subdepth
    // get the number of signups
    IMACI maci = poll.getMaciContract();

    uint256[] memory publicCircuitInputs = getPublicCircuitInputs(
      _currentBatchIndex,
      _newSbCommitment,
      _outputBatchHash
    );

    // Get the verifying key from the VerifyingKeysRegistry
    VerifyingKey memory verifyingKey = verifyingKeysRegistry.getProcessVerifyingKey(
      maci.stateTreeDepth(),
      _voteOptionTreeDepth,
      _messageBatchSize,
      mode
    );

    isValid = verifier.verify(_proof, verifyingKey, publicCircuitInputs);
  }

  /// @notice update message processing state variables
  /// @param _newSbCommitment sbCommitment to be updated
  /// @param _processingComplete update flag that indicate processing is finished or not
  function updateMessageProcessingData(uint256 _newSbCommitment, bool _processingComplete) internal {
    sbCommitment = _newSbCommitment;
    processingComplete = _processingComplete;
    currentBatchIndex -= 1;
    totalBatchesProcessed++;
  }
}
