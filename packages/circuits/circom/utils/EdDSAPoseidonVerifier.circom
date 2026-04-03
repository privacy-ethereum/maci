pragma circom 2.0.0;

// circomlib imports
include "./compconstant.circom";
include "./comparators.circom";
include "./pointbits.circom";
include "./bitify.circom";
include "./escalarmulany.circom";
include "./escalarmulfix.circom";
// local imports
include "./PoseidonHasher.circom";
include "./IsOnCurve.circom";

/**
 * Variant of the EdDSAPoseidonVerifier template from circomlib
 * https://github.com/iden3/circomlib/blob/master/circuits/eddsa.circom
 */
template EdDSAPoseidonVerifier() {
    // The prime subgroup order.
    var SUBGROUP_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041;

    // The base point of the BabyJubJub curve.
    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    // The x and y coordinates of the public key.
    signal input publicKeyX;
    signal input publicKeyY;
    // Signature scalar.
    signal input signatureScalar;
    // The x and y coordinates of the signature point.
    signal input signaturePointX;
    signal input signaturePointY;
    // Message hash.
    signal input messageHash;
    // Output signal for the validity of the signature.
    signal output isValid;

    // Verify the public key and signature point are on the BabyJubJub curve.
    var computedIsPkOnCurve = IsOnCurve()(publicKeyX, publicKeyY);
    var computedIsSpOnCurve = IsOnCurve()(signaturePointX, signaturePointY);

    // Ensure signatureScalar<Subgroup Order.
    // convert the signature scalar signatureScalar into its binary representation.
    var computedNum2Bits[254] = Num2Bits_strict()(signatureScalar);

    var computedCompConstantIn[254] = computedNum2Bits;
    computedCompConstantIn[253] = 0;

    // A component that ensures signatureScalar is within a valid range, 
    // comparing it against a constant representing the subgroup order.
    var computedCompConstant = CompConstant(SUBGROUP_ORDER - 1)(computedCompConstantIn);

    // Calculate the h = H(R, A, msg).
    var computedH2Bits[254] = Num2Bits_strict()(PoseidonHasher(5)([
      signaturePointX,
      signaturePointY,
      publicKeyX,
      publicKeyY,
      messageHash
    ]));

    // These components perform point doubling operations on the public key
    // to align it within the correct subgroup as part of the verification process.
    var (computedDouble1XOut, computedDouble1YOut) = BabyDbl()(publicKeyX, publicKeyY);
    var (computedDouble2XOut, computedDouble2YOut) = BabyDbl()(computedDouble1XOut, computedDouble1YOut);
    var (computedDouble3XOut, computedDouble3YOut) = BabyDbl()(computedDouble2XOut, computedDouble2YOut);

    // A component that performs scalar multiplication of the 
    // adjusted public key by the hash output, essential for the verification calculation.
    var computedEscalarMulAny[2] = EscalarMulAny(254)(computedH2Bits, [computedDouble3XOut, computedDouble3YOut]);

    // Compute the right side: right =  R8 + right2.
    var (computedAddRightXOut, computedAddRightYOut) = BabyAdd()(signaturePointX, signaturePointY, computedEscalarMulAny[0], computedEscalarMulAny[1]);
    
    // Fixed-base scalar multiplication of a base point by signatureScalar.
    var computedEscalarMulFix[2] = EscalarMulFix(254, BASE8)(computedNum2Bits);

    // Components to check the equality of x and y coordinates 
    // between the computed and expected points of the signature.
    var computedIsRightValid = IsEqual()([computedEscalarMulFix[0], computedAddRightXOut]);
    var computedIsLeftValid = IsEqual()([computedEscalarMulFix[1], computedAddRightYOut]);
    var computedIsLeftRightValid = IsEqual()([computedIsRightValid + computedIsLeftValid, 2]);

    // Components to handle edge cases and ensure that all conditions 
    // for a valid signature are met, including the 
    // public key not being zero and other integrity checks.
    var computedIsAxZero = IsZero()(computedDouble3XOut);
    var computedIsAxEqual = IsEqual()([computedIsAxZero, 0]);
    var computedIsCcZero = IsZero()(computedCompConstant);
    var computedIsValid = IsEqual()([computedIsLeftRightValid + computedIsAxEqual + computedIsCcZero + computedIsPkOnCurve + computedIsSpOnCurve, 5]);

    isValid <== computedIsValid;
}
