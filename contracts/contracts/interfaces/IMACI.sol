// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IVerifier } from "./IVerifier.sol";
import { IVkRegistry } from "./IVkRegistry.sol";
import { DomainObjs } from "../utilities/DomainObjs.sol";

/// @title IMACI
/// @notice MACI interface
interface IMACI {
  /// @notice Get the depth of the state tree
  /// @return The depth of the state tree
  function stateTreeDepth() external view returns (uint8);

  /// @notice Return the main root of the StateAq contract
  /// @return The Merkle root
  function getStateTreeRoot() external view returns (uint256);

  /// @notice Return the state root when the '_index' user signed up
  /// @param _index The serial number when the user signed up
  /// @return The Merkle root
  function getStateRootOnIndexedSignUp(uint256 _index) external view returns (uint256);

  /// @notice Get the number of signups
  /// @return numsignUps The number of signups
  function numSignUps() external view returns (uint256);
}
