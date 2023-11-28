---
title: Installing MACI
description: How to install MACI
sidebar_label: Installation
sidebar_position: 2
---

# Installation

## Requirements

You need the following to use MACI:

- Node.js: use [`nvm`](https://github.com/nvm-sh/nvm) to install it. MACI has
  been tested with Node 14, 16 and 18. We do however recommend to use Node 18 as Node 14 is deprecated and Node 16 will soon be deprecated too.
- The [`rapidsnark`](https://github.com/iden3/rapidsnark) tool if running on an intel chip (this allows for faster proof generation vs snarkjs).

> Note that MACI works on Linux and MacOS. It has not been tested on Windows, however it should work on Windows Subsystem for Linux (WSL). Keep in mind that when using MACI e2e on a non intel chip, you will not be able to use rapidsnark and will have to use snarkjs instead. This will result in slower proof generation.

## Installation

### Install `rapidsnark` (if on an intel chip)

First, install dependencies:

```bash
sudo apt-get install build-essential libgmp-dev libsodium-dev nasm git
```

Next, clone `rapidsnark` and build it:

```bash
git clone https://github.com/iden3/rapidsnark.git && \
cd rapidsnark && \
git checkout 1c13721de4a316b0b254c310ccec9341f5e2208e

npm install && \
git submodule init && \
git submodule update && \
npx task createFieldSources && \
npx task buildProver
```

Note the location of the `rapidsnark` binary (e.g.
`/home/user/rapidsnark/build/prover`).

### Install circom v2:

https://docs.circom.io/

Note the location of the `circom` binary (e.g. `$HOME/.cargo/bin/circom`), as you will need it later.

### Install MACI

```bash
git clone https://github.com/privacy-scaling-explorations/maci.git && \
cd maci && \
npm i && \
npm run bootstrap && \
npm run build
```

<!--  check if these are needed on a fresh ubuntu VM -->

Install dependencies for and `zkey-manager`:

```bash
sudo apt-get install libgmp-dev nlohmann-json3-dev nasm g++
```

### Configure zkey-manager

Edit `cli/zkeys.config.yml` to include the relative path to the
circom binary.

```yml
---
circomPath: "RELATIVE_PATH_TO_CIRCOM"
```

### Download `.zkey` files

MACI has two main zk-SNARK circuits (plus an optional Subsidy circuit). Each circuit is parameterised. There should one
`.zkey` file for each circuit and set of parameters.

Unless you wish to generate a fresh set of `.zkey` files, you should obtain
them from someone who has performed a multi-party trusted setup for said
circuits. For more details on which artifacts have undergone a trusted setup, please refer to the [Trusted Setup](https://maci.pse.dev/docs/trusted-setup) page.

Note the locations of the `.zkey` files as the CLI requires them as
command-line flags.

### Generate `.zkey` files

If you wish to generate `.zkey` files from scratch, first navigate to `cli/`
and edit `zkeys.config.yml`. Set the parameters you need.

Next, run the following to compile the circuits with parameters you specified:

```bash
npx zkey-manager compile -c zkeys.config.yml
```

Next, download the `.ptau` file:

```bash
npx zkey-manager downloadPtau -c zkeys.config.yml
```

Finally, generate the `.zkey` files. This may require a lot of memory and time.

```bash
npx zkey-manager genZkeys -c zkeys.config.yml
```
