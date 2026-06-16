---
title: MACI Security Audits
description: Overview of MACI audit history with references to audit reports.
sidebar_label: Security audits
sidebar_position: 1
---

# MACI Security Audits

## Full reports

- Audit by HashCloak 2026/03 [report](/audit_reports/20260317_Hashcloak_audit_report.pdf)
- Audit by PSE Audit 2024/07 [report](/audit_reports/20240731_PSE_Audit_audit_report.pdf)
- Audit by PSE Audit 2024/02 [report](/audit_reports/20240223_PSE_Audit_audit_report.pdf)
- Audit by HashCloak 2022/09 [report](/audit_reports/202220930_Hashcloak_audit_report.pdf)
- Audit by HashCloak 2021/09 [report](/audit_reports/20210922_Hashcloak_audit_report.pdf)

## PSE audit 2024/07

In July 2024 the PSE Audit team audited the MACI codebase with a focus on the smart contracts, TypeScript core, and Circom circuits. Nothing serious was found but we made some optimizations to the codebase.

Please see the [PSE Audit report](/audit_reports/20240731_PSE_Audit_audit_report.pdf) for details.

## PSE audit 2024/02

In February 2024 the PSE Audit team audited the MACI codebase with a focus on the smart contracts, TypeScript core, and Circom circuits Three critical bugs were found: two within the Circom circuits and one in the smart contracts. All three of these have been fixed.

Please see the [PSE Audit report](/audit_reports/20240223_PSE_Audit_audit_report.pdf) for details.

## Veridise disclosure 2023

In March 2023, Veridise responsibly disclosed a number of issues to the MACI team, which were identified using their new [tool](https://twitter.com/VeridiseInc/status/1630806464695791616?s=20) for catching ZK circuit bugs.

Out of five issues disclosed, only three were relevant and have been since fixed by the MACI team. The other two issues were disregarded as they were present in older version of code which is not in use anymore.

We would like to thank the Veridise team for their effort in keeping open source projects safe.

### Issue 1

**Description**

In the template `QuinarySelector`, if you want to confirm the input signal index is a valid integer less than 2\*\*3, you should add Num2bits(3) to check it.

**Code Location**

[`incrementalQuinTree.circom`](https://github.com/privacy-scaling-explorations/maci/blob/78609349aecd94186216ac8743d61b1cb81a097f/circuits/circom/trees/incrementalQuinTree.circom#L30)

**Fix**

[Code location](https://github.com/chaosma/maci/blob/60727d4d10406edda32ad28e53d399d41d45ed88/circuits/circom/trees/incrementalQuinTree.circom#L37)

```javascript
// Ensure that index < choices
component lessThan = SafeLessThan(3);
```

This was fixed by adding a new Template, `SafeLesThan` which uses `Num2Bits` as further check on the signals:

```javascript
// the implicit assumption of LessThan is both inputs are at most n bits
// so we need to add range check for both inputs
template SafeLessThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;

    component n2b1 = Num2Bits(n);
    n2b1.in  <== in[0];
    component n2b2 = Num2Bits(n);
    n2b2.in  <== in[1];

    component n2b = Num2Bits(n+1);

    n2b.in <== in[0]+ (1<<n) - in[1];

    out <== 1-n2b.out[n];
}
```

### Issue 2

**Description**

This issue is the same issue number 1, this time for the input signal index.

**Code Location**

[`incrementalQuinTree.circom`](https://github.com/privacy-scaling-explorations/maci/blob/78609349aecd94186216ac8743d61b1cb81a097f/circuits/circom/trees/incrementalQuinTree.circom#L64)

**Fix**

[PR with fix](https://github.com/privacy-scaling-explorations/maci/pull/646/files#diff-f3ad1f61e9b95b88929664b67c873325fdf70cb8569c2a96da4b0e9f02710391)

As with issue number 1, a new template `SafeGreaterThan` was added:

```javascript
// N is the number of bits the input have.
// The MSF is the sign bit.
template SafeGreaterThan(n) {
    signal input in[2];
    signal output out;

    component lt = SafeLessThan(n);

    lt.in[0] <== in[1];
    lt.in[1] <== in[0];
    lt.out ==> out;
}
```

And then used it to constrain the [`index` input signal](https://github.com/chaosma/maci/blob/2d7a3a0efd33dfc3a5f4d3f95bec3adda7abb963/circuits/circom/trees/incrementalQuinTree.circom#L115-L117):

```javascript
greaterThan[i] = SafeGreaterThan(3);
greaterThan[i].in[0] <== i;
greaterThan[i].in[1] <== index;
```

### Issue 3

**Description**

In the template `QuinaryGeneratePathIndices`, the constraints of the `signal n[levels + 1]` don't perform well for division and modulo counting.

**Code Location**

[`incrementalQuinTree.circom`](https://github.com/privacy-scaling-explorations/maci/blob/7c1b3743ea753786011289a356eaa45ba72f9ca1/circuits/circom/trees/incrementalQuinTree.circom#L228-L242)

**Fix**

The [updated code](https://github.com/chaosma/maci/blob/2d7a3a0efd33dfc3a5f4d3f95bec3adda7abb963/circuits/circom/trees/incrementalQuinTree.circom#L285-L290) uses the `SafeLessThen` template, as shown below:

```javascript
for (var i = 0; i < levels; i++) {
    // Check that each output element is less than the base
    leq[i] = SafeLessThan(3);
    leq[i].in[0] <== out[i];
    leq[i].in[1] <== BASE;
    leq[i].out === 1;

    // Re-compute the total sum
    sum.nums[i] <== out[i] * (BASE ** i);
}
```

## HashCloak audit 2022

In the summer of 2022, MACI v1 was audited by HashCloak. The audit covered both the zk-SNARK circuits and the Solidity smart contracts.

This audit revealed a number of high severity issues which have been remediated by the MACI development team. All issues were successfully fixed and reflected in MACI v1.1.1.

Please see the [HashCloak report](/audit_reports/202220930_Hashcloak_audit_report.pdf) for details.

## HashCloak audit 2021

From July 5th, 2021 to August 2nd, 2021, the Ethereum Foundation’s Applied ZKPs team engaged HashCloak for an audit of the MACI protocol. The audit was conducted with 3 auditors over 15 person weeks.

The following packages were in scope:

- Circuits
- Contracts
- Core
- Crypto
- Domainobjs

From August 18, 2021 to September 22, 2021, Hashcloak assisted the MACI team in resolving the issues.

Please see the [HashCloak report](/audit_reports/20210922_Hashcloak_audit_report.pdf) for details.
