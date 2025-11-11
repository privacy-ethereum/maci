---
title: Introduction
description: The Offchain Relayer is a service that allows users to vote on MACI polls free of charge.
sidebar_label: Introduction
sidebar_position: 1
---

# Coordinator Service

Welcome to the Offchain Relayer technical reference. Here you will find the technical details of the Offchain Relayer: how to set it up and how to use it.

## Flow Diagram

Below is a high-level diagram illustrating the flow of the Relayer Service:

![MACI Relayer Flow](/img/relayer-diagram.png)

## High-Level Overview of the Relayer:

### Functionality

The Relayer serves as an intermediary between users and the MACI system. It performs the following tasks:

- Allows users to send messages without having to pay gas fees by processing these messages off-chain.
- Receives user messages.
- Prepare messages batches and upload it to IPFS
- Submits the message hashes to the Poll contract with IPFS hash of the batch.

This process ensures that user actions are recorded on-chain without compromising their privacy.

### Privacy Preservation

By verifying the zero-knowledge proofs, the Relayer ensures that only authorized users can send messages.
Users must know the pre-image to a state leaf in the poll state tree.

### Decentralization and Trust

It's recommended that the coordinator only runs this service for now. That is because if the service malfunctions and batch hashes are pushed on chain without the messages actually being stored on ipfs, then polls can't be finalized.

### Integration with MACI Components

The Relayer interacts with other components of the MACI system, such as the **Coordinator** and the on-chain smart contracts:

- The **Coordinator** fetches all the messages stored in IPFS and uses them as regular on-chain messages.
- This ensures that user messages are properly processed and recorded, contributing to the overall functionality and security of the voting protocol.

### Additional Information

For more details, you can read the following post on EthResearch:

[MACI with Mostly Off-Chain Happy Path](https://ethresear.ch/t/maci-with-mostly-off-chain-happy-path/19527)
