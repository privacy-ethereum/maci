// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { PoseidonT3 } from "../crypto/PoseidonT3.sol";

/// @notice A struct that holds a LazyIMT data
struct LazyIMTData {
  uint40 maxIndex;
  uint40 numberOfLeaves;
  mapping(uint256 => uint256) elements;
}

/// @notice Custom errors
error DefaultZeroBadIndex();
error DepthTooLarge();
error NumberOfLeavesCannotBeZero();

/// @title InternalLazyIMT
/// @dev A LazyIMT with Zeroes value set to the hash of
/// a MACI Blank State Leaf
/// @notice This implementation is taken from zk-kit
/// https://github.com/privacy-scaling-explorations/zk-kit/blob/main/packages/imt.sol
/// and modified to work with MACI.
library InternalLazyIMT {
  uint256 internal constant MAX_DEPTH = 32;

  uint40 internal constant MAX_INDEX = (1 << 32) - 1;

  uint256 internal constant Z_0 = 11672248758340751985123309654953904206381780234474872690580702076708041504880;
  uint256 internal constant Z_1 = 19331652342509548919759736046837708337654745411782648764289887782687120014303;
  uint256 internal constant Z_2 = 18519476485775495785243637794680967176074958346742730499486256277910758615950;
  uint256 internal constant Z_3 = 9253233849380840352686159591459001593974324654530951637356937482726051049955;
  uint256 internal constant Z_4 = 10008057475275407721464510218327511033274186183546595274082294419551333876278;
  uint256 internal constant Z_5 = 15276174844323421024329399066736221296663144569254850535842419823050726099024;
  uint256 internal constant Z_6 = 1663370527555021269392314605382694643870089495718054678084009438746272917438;
  uint256 internal constant Z_7 = 5399301852449787938729592959767758598837764764280654401872291245798482437544;
  uint256 internal constant Z_8 = 4866075081400981690778814020960726840573964310176395723518004517625390292575;
  uint256 internal constant Z_9 = 21512971799783438919165771504125986132021995840913348675037432712428503908741;
  uint256 internal constant Z_10 = 6813201029531886832110450552606730226830795691661971814974043269824622075721;
  uint256 internal constant Z_11 = 4282197328275431102793102423164292973246002971886176475154495114411725560932;
  uint256 internal constant Z_12 = 4474097095427155576994331666490221311906734708164928024389577211354798674284;
  uint256 internal constant Z_13 = 16303501423444667524550016135096177645956734575071733778212692442175638800868;
  uint256 internal constant Z_14 = 11834883125877480658180154495924219797246595906174241554714912178063903473495;
  uint256 internal constant Z_15 = 21752763454383755716790608888286452627387137767804799155682605808857836412055;
  uint256 internal constant Z_16 = 5878491137934378204024001705840900760190921316730664578336270829522539347503;
  uint256 internal constant Z_17 = 5014169026659671119884698238031833512856466216917734960735991065161008496132;
  uint256 internal constant Z_18 = 19311600495894300621072958324859482654455117060885576559343547805624725018136;
  uint256 internal constant Z_19 = 15368932622333818975708067041455298688523851424706672901025003972939725872614;
  uint256 internal constant Z_20 = 5036099980660379136110597812587879597471706149812314478284605042832832209846;
  uint256 internal constant Z_21 = 13357394670026084987191778289003504081004998235964966603087766793745546987193;
  uint256 internal constant Z_22 = 10438489465213364257193984932323726432391881657287944078083426815937403593118;
  uint256 internal constant Z_23 = 7249486105363175453605253492686896570526177409238866753310555472228694202538;
  uint256 internal constant Z_24 = 3655860097030420750733077755877709404735101461268298220597674245871361918711;
  uint256 internal constant Z_25 = 8513603446469303221334237659899242027113512772967711874924053158098904862108;
  uint256 internal constant Z_26 = 20090988852621915117779997764070319964153217931865684414898070571363916272441;
  uint256 internal constant Z_27 = 10793812588625892452403148694406198611998933881740947225990083504329635168286;
  uint256 internal constant Z_28 = 16378705679850173561776752226215101393834638101684915380663369948813310285412;
  uint256 internal constant Z_29 = 3171958789403408022771249347350805982761602523060076841322587336513700629277;
  uint256 internal constant Z_30 = 4317066530930547221334165656982465935294601583223716527310928098276220702182;
  uint256 internal constant Z_31 = 10941045499345182703430039707419795077832259731433536712773883025687941209296;
  uint256 internal constant Z_32 = 7782953605310617292941028720001655024539110273642468830753550483253450421111;

  /// @notice Returns the default zero value for a given index
  /// @param index The index of the zero value
  /// @return The zero value
  function _defaultZero(uint8 index) internal pure returns (uint256) {
    if (index == 0) return Z_0;
    if (index == 1) return Z_1;
    if (index == 2) return Z_2;
    if (index == 3) return Z_3;
    if (index == 4) return Z_4;
    if (index == 5) return Z_5;
    if (index == 6) return Z_6;
    if (index == 7) return Z_7;
    if (index == 8) return Z_8;
    if (index == 9) return Z_9;
    if (index == 10) return Z_10;
    if (index == 11) return Z_11;
    if (index == 12) return Z_12;
    if (index == 13) return Z_13;
    if (index == 14) return Z_14;
    if (index == 15) return Z_15;
    if (index == 16) return Z_16;
    if (index == 17) return Z_17;
    if (index == 18) return Z_18;
    if (index == 19) return Z_19;
    if (index == 20) return Z_20;
    if (index == 21) return Z_21;
    if (index == 22) return Z_22;
    if (index == 23) return Z_23;
    if (index == 24) return Z_24;
    if (index == 25) return Z_25;
    if (index == 26) return Z_26;
    if (index == 27) return Z_27;
    if (index == 28) return Z_28;
    if (index == 29) return Z_29;
    if (index == 30) return Z_30;
    if (index == 31) return Z_31;
    if (index == 32) return Z_32;
    revert DefaultZeroBadIndex();
  }

  /// @notice Initializes the LazyIMT
  /// @param self The LazyIMTData
  /// @param depth The depth of the tree
  function _init(LazyIMTData storage self, uint8 depth) internal {
    if (depth > MAX_DEPTH) {
      revert DepthTooLarge();
    }
    self.maxIndex = uint40((1 << depth) - 1);
    self.numberOfLeaves = 0;
  }

  /// @notice Returns the index for a given level and index
  /// @param level The level
  /// @param index The index
  /// @return The index for the element
  function _indexForElement(uint8 level, uint40 index) internal pure returns (uint40) {
    // store the elements sparsely
    return (uint40(level) << 32) - level + index;
  }

  /// @notice Inserts a leaf into the LazyIMT
  /// @param self The LazyIMTData
  /// @param leaf The leaf to insert
  function _insert(LazyIMTData storage self, uint256 leaf) internal returns (uint256) {
    uint40 index = self.numberOfLeaves;

    self.numberOfLeaves = index + 1;

    uint256 hash = leaf;

    for (uint8 i = 0; ; ) {
      self.elements[_indexForElement(i, index)] = hash;
      // it's a left element so we don't hash until there's a right element
      if (index & 1 == 0) break;
      uint40 elementIndex = _indexForElement(i, index - 1);
      hash = PoseidonT3.poseidon([self.elements[elementIndex], hash]);
      unchecked {
        index >>= 1;
        i++;
      }
    }

    return hash;
  }

  /// @notice Returns the root of the LazyIMT
  /// @param self The LazyIMTData
  /// @return The root of the LazyIMT
  function _root(LazyIMTData storage self) internal view returns (uint256) {
    // this will always short circuit if self.numberOfLeaves == 0
    uint40 numberOfLeaves = self.numberOfLeaves;
    // dynamically determine a depth
    uint8 depth = 1;
    while (uint40(1 << depth) < numberOfLeaves) {
      depth++;
    }
    return _root(self, numberOfLeaves, depth);
  }

  /// @notice Returns the root of the LazyIMT
  /// @dev Here it's assumed that the depth value is valid.
  /// If it is either 0 or > 2^8-1 this function will panic.
  /// @param self The LazyIMTData
  /// @param numberOfLeaves The number of leaves
  /// @param depth The depth of the tree
  /// @return The root of the LazyIMT
  function _root(LazyIMTData storage self, uint40 numberOfLeaves, uint8 depth) internal view returns (uint256) {
    if (depth > MAX_DEPTH) {
      revert DepthTooLarge();
    }
    // this should always short circuit if self.numberOfLeaves == 0
    if (numberOfLeaves == 0) return _defaultZero(depth);
    uint256[] memory levels = new uint256[](depth + 1);
    _levels(self, numberOfLeaves, depth, levels);
    return levels[depth];
  }

  /// @notice Updates the levels of the LazyIMT
  /// @param self The LazyIMTData
  /// @param numberOfLeaves The number of leaves
  /// @param depth The depth of the tree
  /// @param levels The levels of the tree
  function _levels(
    LazyIMTData storage self,
    uint40 numberOfLeaves,
    uint8 depth,
    uint256[] memory levels
  ) internal view {
    if (depth > MAX_DEPTH) {
      revert DepthTooLarge();
    }
    if (numberOfLeaves == 0) {
      revert NumberOfLeavesCannotBeZero();
    }

    // this should always short circuit if self.numberOfLeaves == 0
    uint40 index = numberOfLeaves - 1;

    if (index & 1 == 0) {
      levels[0] = self.elements[_indexForElement(0, index)];
    } else {
      levels[0] = _defaultZero(0);
    }

    for (uint8 i = 0; i < depth; ) {
      if (index & 1 == 0) {
        levels[i + 1] = PoseidonT3.poseidon([levels[i], _defaultZero(i)]);
      } else {
        uint256 levelCount = (numberOfLeaves) >> (i + 1);
        if (levelCount > index >> 1) {
          uint256 parent = self.elements[_indexForElement(i + 1, index >> 1)];
          levels[i + 1] = parent;
        } else {
          uint256 sibling = self.elements[_indexForElement(i, index - 1)];
          levels[i + 1] = PoseidonT3.poseidon([sibling, levels[i]]);
        }
      }
      unchecked {
        index >>= 1;
        i++;
      }
    }
  }
}
