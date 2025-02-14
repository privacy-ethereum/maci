// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IMACI } from "./interfaces/IMACI.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IPoll } from "./interfaces/IPoll.sol";
import { SnarkCommon } from "./crypto/SnarkCommon.sol";
import { Hasher } from "./crypto/Hasher.sol";
import { IVerifier } from "./interfaces/IVerifier.sol";
import { IVkRegistry } from "./interfaces/IVkRegistry.sol";
import { IMessageProcessor } from "./interfaces/IMessageProcessor.sol";
import { CommonUtilities } from "./utilities/CommonUtilities.sol";
import { DomainObjs } from "./utilities/DomainObjs.sol";

/// @title MessageProcessor
/// @dev MessageProcessor is used to process messages published by signup users.
/// It will process message by batch due to large size of messages.
/// After it finishes processing, the sbCommitment will be used for Tally and Subsidy contracts.
contract MessageProcessor is Ownable, SnarkCommon, Hasher, CommonUtilities, IMessageProcessor, DomainObjs {
  /// @notice custom errors
  error NoMoreMessages();
  error StateNotMerged();
  error InvalidProcessMessageProof();
  error NumSignUpsTooLarge();
  error CurrentMessageBatchIndexTooLarge();
  error BatchEndIndexTooLarge();

  /// @inheritdoc IMessageProcessor
  bool public processingComplete;

  /// @notice  The number of batches processed
  uint256 public numBatchesProcessed;

  /// @notice The current message batch index
  uint256 public currentBatchIndex;

  /// @inheritdoc IMessageProcessor
  uint256 public sbCommitment;

  IPoll public immutable poll;
  IVerifier public immutable verifier;
  IVkRegistry public immutable vkRegistry;
  Mode public immutable mode;

  /// @notice Create a new instance
  /// @param _verifier The Verifier contract address
  /// @param _vkRegistry The VkRegistry contract address
  /// @param _poll The Poll contract address
  /// @param _mpOwner The owner of the MessageProcessor contract
  /// @param _mode Voting mode
  constructor(
    address _verifier,
    address _vkRegistry,
    address _poll,
    address _mpOwner,
    Mode _mode
  ) payable Ownable(_mpOwner) {
    verifier = IVerifier(_verifier);
    vkRegistry = IVkRegistry(_vkRegistry);
    poll = IPoll(_poll);
    mode = _mode;
    currentBatchIndex = 1;
  }

  /// @notice Update the Poll's currentSbCommitment if the proof is valid.
  /// @param _newSbCommitment The new state root and ballot root commitment
  ///                         after all messages are processed
  /// @param _proof The zk-SNARK proof
  function processMessages(uint256 _newSbCommitment, uint256[8] calldata _proof) external onlyOwner {
    // ensure the voting period is over
    _votingPeriodOver(poll);

    // There must be unprocessed messages
    if (processingComplete) {
      revert NoMoreMessages();
    }

    (, uint8 voteOptionTreeDepth) = poll.treeDepths();
    uint8 messageBatchSize = poll.messageBatchSize();

    uint256[] memory batchHashes;
    // Copy the state and ballot commitment and set the batch index if this
    // is the first batch to process
    if (numBatchesProcessed == 0) {
      uint256 currentSbCommitment = poll.currentSbCommitment();
      sbCommitment = currentSbCommitment;

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

    (, uint256 numMessages) = poll.numSignUpsAndMessages();

    updateMessageProcessingData(_newSbCommitment, numMessages <= messageBatchSize * (numBatchesProcessed + 1));
  }

  /// @inheritdoc IMessageProcessor
  function getPublicCircuitInputs(
    uint256 _currentMessageBatchIndex,
    uint256 _newSbCommitment,
    uint256 _outputBatchHash
  ) public view override returns (uint256[] memory publicInputs) {
    uint256 coordinatorPubKeyHash = poll.coordinatorPubKeyHash();
    uint8 messageBatchSize = poll.messageBatchSize();
    (uint256 numSignUps, uint256 numMessages) = poll.numSignUpsAndMessages();
    uint256 batchEndIndex = _currentMessageBatchIndex * messageBatchSize;

    if (batchEndIndex > numMessages) {
      batchEndIndex = numMessages - (_currentMessageBatchIndex - 1) * messageBatchSize;
    }

    uint256 batchStartIndex = batchEndIndex > messageBatchSize ? batchEndIndex - messageBatchSize : 0;

    publicInputs = new uint256[](9);
    publicInputs[0] = numSignUps;
    publicInputs[1] = _outputBatchHash;
    publicInputs[2] = poll.actualStateTreeDepth();
    publicInputs[3] = coordinatorPubKeyHash;
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

    // Get the verifying key from the VkRegistry
    VerifyingKey memory vk = vkRegistry.getProcessVk(
      maci.stateTreeDepth(),
      _voteOptionTreeDepth,
      _messageBatchSize,
      mode
    );

    isValid = verifier.verify(_proof, vk, publicCircuitInputs);
  }

  /// @notice update message processing state variables
  /// @param _newSbCommitment sbCommitment to be updated
  /// @param _processingComplete update flag that indicate processing is finished or not
  function updateMessageProcessingData(uint256 _newSbCommitment, bool _processingComplete) internal {
    sbCommitment = _newSbCommitment;
    processingComplete = _processingComplete;
    currentBatchIndex -= 1;
    numBatchesProcessed++;
  }
}
