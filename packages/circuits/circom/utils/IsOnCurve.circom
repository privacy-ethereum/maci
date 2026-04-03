pragma circom 2.0.0;

// zk-kit imports
include "./comparators.circom";

/**
 * Returns 0 or 1 depending on if the point is on the BabyJubJub curve or not. The point is on the
 * BabyJubJub curve if the following equation is true: a*x^2 + y^2 == 1 + d*x^2*y^2
 * This template is identical to the BabyCheck template from circomlib, but it returns 0 or 1
 * instead of having a hard constraint.
 * Based on: https://github.com/iden3/circomlib/blob/master/circuits/babyjub.circom
 */
template IsOnCurve() {
    // x coordinate of the point on the BabyJubJub curve.
    signal input x;
    // y coordinate of the point on the BabyJubJub curve.
    signal input y;
    // True when the point (x, y) satisfies the BabyJubJub curve equation.
    signal output isValid;

    // x^2 and y^2 intermediate values.
    signal x2;
    signal y2;
    // x^2 * y^2 intermediate value.
    signal x2y2;

    // BabyJubJub curve parameters.
    var a = 168700;
    var d = 168696;

    // Compute x^2 and y^2.
    x2 <== x * x;
    y2 <== y * y;

    // Compute x^2 * y^2.
    x2y2 <== x2 * y2;

    // Check if a*x^2 + y^2 == 1 + d*x^2*y^2.
    isValid <== IsEqual()([a * x2 + y2, 1 + d * x2y2]);
}
