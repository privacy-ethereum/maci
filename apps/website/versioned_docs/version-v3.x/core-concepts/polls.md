---
title: MACI Polls
description: Which type of polls you can run on MACI
sidebar_label: Polls
sidebar_position: 9
---

MACI allows to create several concurrent on chain polls, each with their own set of options, duration, and voting mechanism. To start with, each poll needs to be created on chain, and configured with the desired parameters. The user state is not shared between polls, thus spending voting power on one, will not affect the voting power on another.

Currently, you can configure the following parameters for a poll:

- Poll duration, in the form of a unix timestamp for start and end times. This allows polls to be scheduled to start at a certain time, and run for a certain amount of time.
- Vote option - how many vote options are allowed for a poll.
- Vote mode - quadratic, non quadratic, full credits voting. One should be aware that the only distinction between them happens when messages are processed and votes tallied.
- Policy - the Excubiae policy that will be used to gate access to the poll.
- Initial voice credit proxy - the initial voice credit proxy that will be used to assign voice credits to voters.
- Relayer - the list of addresses that will be able to relay messages on behalf of other users (for now this is recommended to be the coordinator only)
- Coordinator pubkey - the public key of the coordinator of this Poll.

The full configuration for a poll looks like this:

```json
"Poll": {
    "pollStartDate": 3600,
    "pollEndDate": 3600,
    "coordinatorPublicKey": "macipk.9a59264310d95cfd8eb7083aebeba221b5c26e77427f12b7c0f50bc1cc35e621",
    "mode": 1,
    "policy": "FreeForAllPolicy",
    "relayers": "0x0000000000000000000000000000000000000000",
    "initialVoiceCreditProxy": "ConstantInitialVoiceCreditProxy",
    "voteOptions": 2
}
```

## Quadratic Voting

MACI has always worked with quadratic voting. Users joining a Poll are assigned a number of voice credits based on certain conditions (enforced by the [initial voice credit proxy contract](https://github.com/privacy-scaling-explorations/maci/blob/main/packages/contracts/contracts/initialVoiceCreditProxy/ConstantInitialVoiceCreditProxy.sol)), and after each vote, the number of voice credits is reduced by the square of the weight of the vote casted. For instance, if the vote weight is 5, a user must have at least 25 voice credits to cast the vote.

To run a poll with quadratic voting, the coordinator must deploy the Poll with the mode set to quadratic voting.

### Using Hardhat tasks

In the deploy-config.json file set the `mode` value to `0`.

```json
"Poll": {
    [...]
    "coordinatorPublicKey": "macipk",
    "mode": 0
}
```

Then run the task to create a poll:

```bash
pnpm deploy-poll:NETWORK
```

## Non Quadratic Voting

The non quadratic voting option is a new feature that has been added to MACI with the v1.2 release. It allows to conduct polls without the quadratic voting mechanism. This means that the number of voice credits is not reduced by the square of the weight of the vote casted. This option is useful for polls where the quadratic voting mechanism is not necessary, and it is also slightly cheaper for coordinators to tally votes, as there are less checks required in the Tally smart contract.

To run a poll with non quadratic voting, the coordinator must set the `mode` parameter to `1` when deploying the poll.

### Using Hardhat tasks

In the deploy-config.json file set the `mode` value to `1`.

```json
"Poll": {
    [...]
    "coordinatorPublicKey": "macipk",
    "mode": 1
}
```

Then run the task to create a poll:

```bash
pnpm deploy-poll:NETWORK
```

## Full Credits Voting

Full Credits Voting is a new feature introduced in MACI v3. This voting mode disables the quadratic voting mechanism and requires participants to allocate their entire voice credit balance to a single option. Unlike quadratic voting, where the cost of votes increases quadratically with the number of votes cast, Full Credits Voting uses a linear model: participants spend all their available voice credits on one chosen option. No splitting across multiple options is allowed. This option is useful for polls where the quadratic voting mechanism is not necessary and where it's important to ensure voters fully commit to a single choice—eliminating fragmented or spread-out voting behavior. It also offers a slight cost advantage for coordinators, as tallying is more efficient with fewer checks required in the Tally smart contract.

To run a poll with full credits voting, the coordinator must set the `mode` parameter to `2` when deploying the poll.

### Using Hardhat tasks

In the deploy-config.json file set the `mode` value to `2`.

```json
"Poll": {
    [...]
    "coordinatorPublicKey": "macipk",
    "mode": 2
}
```

Then run the task to create a poll:

```bash
pnpm deploy-poll:NETWORK
```
