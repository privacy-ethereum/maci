---
slug: maci-coordinator-service
title: MACI Coordinator Service
description: Announcing our coordinator service for MACI
authors:
  - name: ctrlc03
    title: MACI former team lead
    url: https://x.com/ctrlc03
    image_url: https://avatars.githubusercontent.com/u/93448202?v=4c
  - name: NicoSerranoP
    title: MACI team member
    url: https://x.com/NicoSerranoP
    image_url: https://avatars.githubusercontent.com/u/38594836?v=4
tags: [voting, security, anonymity, MACI, coordinator]
excerpt: "A MACI plugin for Aragon OSx to enable private voting in DAOs"
---

Hey Anon,

Welcome back to our MACI blog.

Today, we are excited to officially announce something we have referenced frequently: the Coordinator Service.

If you ever used MACI, for instance to run a Retroactive Public Goods Funding (RPGF) or Quadratic Funding (QF) round, you might be aware of how tedious it was to operate. The manual process of running scripts to finalise a round and calculate the tally as well as all of the zk-SNARK proofs could require some time and technical expertise. All these steps had to be done in the terminal and you needed to be familiar with MACI's inner workings to understand the process.

**Fear no more - the coordinator service is here to make your life easier.**

## The vision: MACI for everyone

Our goal is ambitious, yet simple: **completely eliminate the need for any technical knowledge to use MACI**. No more terminal commands, no more manual proof generation, no more complex scripts. Just configure once, run inside a Docker container on your server, and enjoy the full power of MACI's privacy-preserving voting infrastructure.

## Technical implementation

The service was built with the following technologies for reliability and scalability:

- TypeScript for type-safe, maintainable code
- Nest.js framework for enterprise-grade architecture
- REST API for standard CRUD operations
- WebSocket endpoints for real-time updates during intensive computations
- MACI SDK package to have all the logic and functions ready to use
- Docker-ready for simple deployment anywhere

The core functionalities of the service are as follows:

- Deploy a MACI [subgraph](https://github.com/privacy-scaling-explorations/maci/tree/dev/apps/coordinator/ts/subgraph) to query on-chain data easily
- [Deploy](https://github.com/privacy-scaling-explorations/maci/tree/dev/apps/coordinator/ts/deployer) the MACI smart contracts, including polls
- [Finalise](https://github.com/privacy-scaling-explorations/maci/tree/dev/apps/coordinator/ts/proof) polls by processing votes and tallying the results
- [Schedule](https://github.com/privacy-scaling-explorations/maci/tree/main/apps/coordinator/ts/scheduler) polls for automatic finalization when the voting period ends
- [Health](https://github.com/privacy-scaling-explorations/maci/tree/main/apps/coordinator/ts/health) endpoint to check everything is setup and working

Let's dive into more details in the following sections.

### Subraph deployment

The endpoint to deploy a subgraph requires some configuration in the `.env` file, as well as an HTTP request to the endpoint responsible for this `https://coordinator.maci.vote/v1/subgraph/deploy`. Make sure you have an account in [The Graph](https://thegraph.com/studio/) to setup your `.env` file before starting the coordinator service.

### Contracts deployment

There are two endpoints in this module: deploy maci (`https://coordinator.maci.vote/v1/deploy/maci`) and deploy poll (`https://coordinator.maci.vote/v1/deploy/poll`). This will take care of all contracts deployment and configuration. It is worth pointing out that you should read the [coordinator service API documentation](https://coordinator.maci.vote/api) and the [MACI guides](https://maci.pse.dev/docs/core-concepts/workflow) to understand the roles of each contract (MACI, poll, policy, initialVoiceCredit).

You can deploy one MACI contract (and its internal smart contracts) that will have one gatekeeper policy (e.g. FreeForAll) for all voters to sign up. After that you can deploy multiple polls with different settings (start date, end date, gatekeeper policy, etc). Each voter will have to join each poll to be eligible to participate in. The poll's gatekeeper will check the voter eligibility to join the poll.

### Finalisation

This step includes three separate actions:

1. Merge - calculate the state merkle tree root and store a commitment to its root (`https://coordinator.maci.vote/v1/proof/merge`)
2. Process - fetch all smart contracts events to reconstruct the state locally and process all votes. This includes decrypting votes, checking validity, and finally tallying them. zk-SNARK proofs are generated for each batch of votes processed (`https://coordinator.maci.vote/v1/proof/generate`)
3. Submit - submitting all of the zk-SNARK proofs on chain to prove that the poll was processed correctly. Finally, submit the tally results on chain so that they can be seen by everyone (`https://coordinator.maci.vote/v1/proof/submit`)

We chose to separate each action into its own endpoint to avoid long-running computations that could lead to network errors or timeouts.

### Schedule

After finishing up the finalisation module, we realized that it would be a lot easier for users to create polls and schedule the finalization process. This removes the need for users to manually call the finalization endpoints described above.

1. To schedule a deployed poll you can use `https://coordinator.maci.vote/v1/scheduler/register`.
2. To check if a poll is scheduled you can use `https://coordinator.maci.vote/v1/scheduler/status`
3. To delete a scheduled poll you can use `https://coordinator.maci.vote/v1/scheduler/delete`

## How to use

### Run it from source

1. Clone the MACI repository: [https://github.com/privacy-scaling-explorations/maci](https://github.com/privacy-scaling-explorations/maci)
2. Install dependencies and build the project

```bash
pnpm install
pnpm run build
```

3. Download the zkeys for the coordinator

```bash
pnpm run download-zkeys:ceremony:coordinator
```

4. Generate a coordinator MACI keypair. Remember to store those values for later.

```bash
pnpm run generate-maci-keypair
```

5. Move to the coordinator service directory

```bash
cd apps/coordinator
```

6. Configure your `.env` file. Make sure to configure it with your own secure values. The coordinator MACI private key from the previous step should be set here

```bash
cp .env.example .env
```

7. Start the service

```bash
pnpm run start
# or
pnpm run start:prod
```

### Run it with Docker

1. Clone the MACI repository: [https://github.com/privacy-scaling-explorations/maci](https://github.com/privacy-scaling-explorations/maci)
2. Go inside the project directory

```bash
cd maci
```

3. Build the docker image and run the container

```bash
# Build docker
docker compose -f apps/coordinator/docker-compose.yml build

# Run container detached
docker compose -f apps/coordinator/docker-compose.yml up -d
```

## Usage notes

1. You can check out the documentation while the service is running in [http://localhost:3001/api](http://localhost:3001/api)

2. We have a [e2e.deploy.test.ts](https://github.com/privacy-scaling-explorations/maci/blob/main/apps/coordinator/tests/e2e.deploy.test.ts) file that performs a complete process: deployment, voting and finalization. You can use it to guide yourself.

## Future work

We are researching about different cryptographic methods to decentralize the coordinator. The idea is to eliminate reliance on a single centralized service for finalizing polls. A group of people would be able to spin up their own coordinator services and finalize the poll in a multi-party computation. For more info check out our MACI v4 research.

## Conclusion

The MACI Coordinator Service represents a significant leap forward in making MACI accessible to everyone. Whether you're running a small community poll or a large-scale funding round, the coordinator service handles the complexity so you can focus on what matters - empowering your community with private, secure voting.

Ready to get started? Head over to our documentation and deploy your first MACI round today!

Please reach out if you would like to integrate the service into your frontend.

## References

- [MACI repo](https://github.com/privacy-scaling-explorations/maci)
- [Sample frontend](https://github.com/privacy-scaling-explorations/maci-aragon-osx-gov-app) using the coordinator service
- [Code examples](https://github.com/privacy-scaling-explorations/maci-aragon-osx-gov-app/blob/main/plugins/maciVoting/contexts/CoordinatorContext.tsx)
- [Documentation](https://maci.pse.dev/docs/category/coordinator-service)
