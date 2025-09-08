---
title: Usage
description: Learn how to interact with a running MACI coordinator service instance.
sidebar_label: Usage
sidebar_position: 3
---

After setting up and running the MACI coordinator service, you can interact with it through its RESTful API. The service provides various endpoints for deployment and finalization of polls. Please refer to the API documentation at [https://coordinator.maci.vote/api](https://coordinator.maci.vote/api) for the exact request format and required parameters for all endpoint calls described below.

# Authentication

The coordinator service uses a custom signature authentication mechanism to guard the deploy endpoints. To interact with these endpoints, you need to:

1. Make sure you have run the command to set up and generate the RSA keypair, as described in the instructions section.

2. Ensure that your Ethereum public key is set in the `.env` file under the `COORDINATOR_ADDRESSES` variable.

3. Get the RSA public key from the coordinator service with [https://coordinator.maci.vote/v1/proof/publicKey](https://coordinator.maci.vote/v1/proof/publicKey).

4. Sign a message such as "authenticate-me" using the coordinator's Ethereum private key.

5. Encrypt both the message (also called digest) and its signature using the RSA public key. For example, you can use RSA public-key encryption in the format:

```javascript
const payload: string = "signature:digest";
```

Then encrypt this payload using the coordinator’s RSA public key.

# Deploy MACI

To deploy the set of MACI smart contracts, you need to call the endpoint [https://coordinator.maci.vote/v1/deploy/maci](https://coordinator.maci.vote/v1/deploy/maci) with a POST request. The request body should include the necessary parameters for the deployment, such as the gatekeeper policy, state tree depth, and voting mode.

# Deploy Poll

To deploy a new poll to an existing MACI instance, you need to call the endpoint [https://coordinator.maci.vote/v1/deploy/poll](https://coordinator.maci.vote/v1/deploy/poll) with a POST request. The request body should include the necessary parameters for the poll deployment, such as the gatekeeper policy, start and end dates, number of options, and voting mode.

# Deploy Subgraph

To deploy a subgraph for a MACI instance and its corresponding polls, you need to call the endpoint [https://coordinator.maci.vote/v1/subgraph/deploy](https://coordinator.maci.vote/v1/subgraph/deploy) with a POST request. The request body should include the necessary parameters for the subgraph deployment, such as the MACI contract address and the subgraph name.

# Finalize Poll

To finalize a poll, you need to follow a series of steps that involve processing messages, merging state trees, generating proofs, and submitting the final tally on-chain. The Coordinator Service provides endpoints for each of these steps.

## Merge

To merge the published messages and create the required state tree, you need to call the endpoint [https://coordinator.maci.vote/v1/proof/merge](https://coordinator.maci.vote/v1/proof/merge) with a POST request. The request body should include the necessary parameters for the merge operation, such as the MACI contract address and the poll ID.

## Generate

Once the Merkle trees are ready, you can generate the zk-SNARK proof for the final tally by calling the endpoint [https://coordinator.maci.vote/v1/proof/generate](https://coordinator.maci.vote/v1/proof/generate) with a POST request. The request body should include the necessary parameters for the proof generation, such as the MACI contract address and the poll ID.

## Submit

After generating the proof, you can submit the final tally on-chain by calling the endpoint [https://coordinator.maci.vote/v1/proof/submit](https://coordinator.maci.vote/v1/proof/submit) with a POST request. The request body should include the necessary parameters for the submission, such as the MACI contract address, poll ID, and the generated proof.

# Schedule Poll

After deploying a poll, you can schedule it to be finalized automatically after it ends. Make sure to set the MACI coordinator private key in the `.env` file. To do so, you need to call the endpoint [https://coordinator.maci.vote/v1/schedule/poll](https://coordinator.maci.vote/v1/schedule/poll) with a POST request. The request body should include the necessary parameters for scheduling the poll, such as the MACI contract address and the poll ID.

# Health

To check that the env variables are set correctly and the service is running, you can call the health endpoint [https://coordinator.maci.vote/v1/health](https://coordinator.maci.vote/v1/health) with a GET request. This endpoint will return a status message indicating the rapidsnark access, redis database connection, zkeys access, and the MACI coordinator address with its funds in each MACI-compatible network.
