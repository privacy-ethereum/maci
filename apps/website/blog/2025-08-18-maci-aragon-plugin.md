---
slug: maci-aragon-plugin
title: MACI Aragon Plugin
description: A MACI plugin for Aragon OSx to enable private voting in DAOs
authors:
  - name: ctrlc03
    title: MACI former team lead
    url: https://x.com/ctrlc03
    image_url: https://avatars.githubusercontent.com/u/93448202?v=4
  - name: John Guilding
    title: MACI team lead
    url: https://x.com/john_guilding
    image_url: https://pbs.twimg.com/profile_images/1629144990914945024/C6_xsK78_400x400.jpg
  - name: NicoSerranoP
    title: MACI team member
    url: https://x.com/NicoSerranoP
    image_url: https://avatars.githubusercontent.com/u/38594836?v=4
tags: [voting, security, anonymity, Aragon, MACI, development]
excerpt: "A MACI plugin for Aragon OSx to enable private voting in DAOs"
---

Hey Anon,

Welcome to another MACI blogpost. Today we are going to be looking at a voting plugin we have been developing to work with the [Aragon OSx stack](https://www.aragon.org/osx).

As mentioned in our [latest roadmap blog post](https://maci.pse.dev/blog/2025-Roadmap#2025---what-will-we-focus-the-rest-of-the-year), our team decided to focus on supporting governance projects by integrating with tooling providers such as [Aragon](https://www.aragon.org/). Look out for further announcements over the next month. We're working on some exciting additions to the roadmap to accelerate private governance on Ethereum.

So why integrate MACI with Aragon OSx? Our thesis is simple: \***\*private voting will increase voter participation and protect those voting. It will also lead to more honest and accurate outcomes as people can vote more honestly.\*\***

Current public voting systems create barriers to honest participation. Voters face social pressure, fear of retaliation, and concerns about how their choices might affect future opportunities. Private voting removes these barriers, enabling DAOs to capture the true preferences of their communities.

We chose to integrate with Aragon because their OSx platform provides an excellent foundation for custom DAO governance, and as a reputable team building in the open, they're the perfect partner for this integration.

### The real cost of public voting

While transparency is often celebrated in crypto, public voting creates serious barriers to honest participation that threaten the legitimacy of DAO governance.

**Fear of retaliation keeps voters silent.** Large token holders can pressure smaller voters by threatening to exclude them from future opportunities, airdrops, or partnerships. When voting records are public, retaliation becomes easy to execute, leading many to abstain rather than risk consequences.

**Social pressure distorts genuine preferences.** Voters often wait to see how others vote before casting their own ballot, leading to herding behavior that doesn't reflect genuine preferences. Some even [say](https://x.com/LefterisJP/status/1921562225333916094) governance voting has devolved into a game of politics. The "follow the whale" mentality and politics involved undermine the democratic ideals DAOs strive for.

**Vote verification enables problematic markets.** When votes are public, it also creates conditions where governance power can be openly [traded](https://www.tronweekly.com/arbitrum-vote-buying-scandal-how-5-eth-shook/), as buyers can verify they received what they paid for.

**Public real time results can enable whales intervention.** If the votes are public and visible in real time while the voting period is happening, whales (or users through token loans) could influence the decision by using their voting power to overpower the community decision.

### Why MACI

MACI (Minimal Anti Collusion Infrastructure) is a private voting protocol that aims to reduce collusion and coercion with receipt freeness - this makes it the logical next step for DAOs that really care about the problems highlighted above.

In more detail, every vote is encrypted and can only be decrypted for tallying, by a trusted entity referred to as the coordinator. Voters can override their votes at any point during the voting period, and thus without a clear receipt for their vote, they are not able to prove beyond reasonable doubt that they actually voted for an option. This discourages bribers from buying votes and other voters from attempting to collude.

While the coordinator can decrypt votes, they cannot produce an incorrect tally or censor votes, thanks to zero knowledge proofs and smart contracts.

For more details about MACI and how it works, we recommend reading our other blogposts such as this introductory [article](https://maci.pse.dev/blog/maci-for-beginners) and our comprehensive documentation [website](https://maci.pse.dev/docs/introduction).

### How does Aragon OSx work

Aragon OSx is a smart contract framework that works on EVM compatible chains. DAOs can easily deploy custom governance stacks using Aragon OSx, and can benefit from several plugins to extend their functionality over time. This plugin architecture allows DAOs to customise their governance without rebuilding from scratch.

A plugin is a smart contract with custom governance logic, limited in scope, and with single-purpose logic that can be used to extend OSx-based organisations. Examples include [token voting](https://docs.aragon.org/token-voting/1.x/index.html) and [multisig](https://docs.aragon.org/multisig/1.x/index.html), and now.. privacy-preserving voting through MACI.

### How does the MACI plugin work

The plugin allows DAO members to create new proposals by calling a smart contract function: `createProposal`. The function checks that the caller has enough governance tokens - this minimum amount is set by the DAO at deployment time. The plugin creates a new MACI poll that hosts the encrypted private votes for that particular proposal.

The plugin then captures the current block number (minus one) as a snapshot to determine voter eligibility. Once they decide to vote, they can register their interest to vote via their DAO frontend (in MACI's context we call this process _join a poll_), and their voting power is determined by their token balance at the time of proposal creation. Voters can use their real wallet holding their tokens to register themselves by publishing a MACI public key created on their devices. After that, the voter can use any wallet to submit an encrypted message containing the registered public key and their selected option.

Voters are then able to vote using their full voting power by choosing one of the options available, which at this time are Yes, No or Abstain. Voting is completely handled by MACI’s smart contracts, therefore voters do not actually ever interact with the DAO plugin.

Once the proposal ends, MACI’s backend service (the [coordinator service](https://github.com/privacy-scaling-explorations/maci/tree/dev/apps/coordinator)), starts processing the votes, and generate zk-SNARK proofs to be validated on chain. Voters can be sure of the correct execution thanks to those proofs verifying on chain. Finally, the results are uploaded and the proposal execution can be triggered.

The full flow can be observed in the diagram below:

![new-flow-maci](https://hackmd.io/_uploads/Sktza18Xge.png)

A proposal execution can range from transferring funds, calling a function on the DAO smart contract itself, calling out an external contract (for instance to initiate a token swap), or setting up a new plugin.

An example proposal shown below, with a proposal requesting users to vote on whether they are happy to convert part of the DAOs USDC reserves to ETH.

![dao1](https://hackmd.io/_uploads/rk7C3dHXll.png)

The familiar voting interface makes privacy seamless - voters simply select their choice without needing to understand the cryptography running behind the scenes.

![voting1](https://hackmd.io/_uploads/H1TR3OHXxg.png)

### Implementation Considerations

- **Network Support:** Currently compatible with all EVM chains such as Ethereum, Arbitrum, Optimism, and some zkEVM networks such as Scroll and Linea. [Here](https://maci.pse.dev/docs/supported-networks/) is a list of all compatible networks.
- **Timeline:** Vote processing is not immediate due to the need to process votes offchain and to generate zk-SNARK proofs of correct execution. The time it takes to process votes can be reduced by using more powerful hardware.
- **Reliance on trusted coordinator:** MACI in its current form relies on a trusted coordinator entity which can decrypt the votes - this is an automated piece of software that can run on a server or a Trusted Execution Environment for more security. The team is working on decentralising the coordinator entity and will soon begin working on an upgraded version that uses homomorphic encryption and threshold encryption to distribute the responsibilities across multiple entities. Please note that while the coordinator can see the votes, they cannot censor users nor provide incorrect results.
- **Costs:** Using MACI can be more costly than traditional blockchain-based voting. While these costs are negligible in layer 2 networks, costs can increase in Ethereum mainnet. Please refer to our [costs](https://maci.pse.dev/docs/supported-networks/costs) section in the documentation website for more details on current benchmarks.

### Next steps

As DAOs evolve from experimental communities to serious organisations managing significant resources, governance systems must evolve too. The current landscape presents an ideal opportunity for DAOs to pioneer MACI, thus we are looking for forward-thinking DAOs to pilot MACI’s governance plugin - especially those facing challenges around voter participation, sensitive decision-making, or community pressure. Ready to be among the first? Reach out at [maci@pse.dev](mailto:maci@pse.dev) or join our [Discord](https://discord.com/invite/sF5CT5rzrR). Governance on Ethereum needs a privacy shake up, stay in the loop if you're interested in hearing what else the team has been working on.

### References and resources

- [MACI repo](https://github.com/privacy-scaling-explorations/maci)
- [MACI voting plugin](https://github.com/privacy-scaling-explorations/maci-voting-plugin-aragon)
- [MACI -Aragon sample frontend](https://github.com/privacy-scaling-explorations/maci-aragon-osx-gov-app)
- [Aragon OSx](https://github.com/aragon/osx)
- [Aragon docs](https://docs.aragon.org/)

## Acknowledgements

Thanks to the Aragon team for review.
