---
title: Tally Smart Contract
description: Tally smart contract
sidebar_label: Tally
sidebar_position: 5
---

:::info
Code location: [Tally.sol](https://github.com/privacy-scaling-explorations/maci/blob/main/packages/contracts/contracts/Tally.sol)
:::

The `Tally` contract is used by the coordinator to submit commitments to the tally results via the `tallyVotes` function. This is done in batches and the final commitment can be used by the users to verify the validity of the results.

This contract should be deployed alongside a `Poll`, with the constructor accepting the following parameters:

```ts
  constructor(
    address _verifier,
    address _verifyingKeysRegistry,
    address _poll,
    address _mp,
    address _tallyOwner,
    Mode _mode
  ) payable {
    verifier = IVerifier(_verifier);
    vkRegistry = IVkRegistry(_verifyingKeysRegistry);
    poll = IPoll(_poll);
    messageProcessor = IMessageProcessor(_mp);
    mode = _mode;
  }
```

- `verifier` - The address of the verifier contract
- `vkRegistry` - The address of the vkRegistry contract
- `poll` - The address of the poll contract
- `messageProcessor` - The address of the messageProcessor contract
- `mode` - The mode of the tally contract - depending on this, the commitments will be processed differently, and it must equal the Poll mode (quadratic vs non quadratic vs full credits voting)

Users can use the verification functions to verify the Tally results. These are as follows:

- `verifySpentVoiceCredits` - Verifies the spent voice credits
- `verifyPerVOSpentVoiceCredits` - Verifies the spent voice credits per vote option
- `verifyTallyResult` - Verifies the tally result
