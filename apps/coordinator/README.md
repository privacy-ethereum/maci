# Coordinator service

Please refer to [Offchain relayer service documentation](https://maci.pse.dev/docs/category/offchain-relayer) for more information.

## Requirements

1. [Node.js](https://nodejs.org/en) version 20.0.0.
2. [pnpm](https://pnpm.io/installation) package manager.
3. [rapidsnark](https://github.com/iden3/rapidsnark) program.
4. (Optional) [Redis](https://redis.io/docs/latest/operate/oss_and_stack/install/archive/install-redis/) database if you want to use the scheduler module.

- Please note that the build process might fail in a Windows environment. If you are using Windows, it is recommended to use Windows Subsystem for Linux (WSL) or a virtual machine with a Linux distribution.

## Install and build it from source

1. Install dependencies and build the project

```bash
pnpm install
pnpm run build
```

2. Install Redis database (if the scheduler module is going to be used) using [the official guide](https://redis.io/docs/latest/operate/oss_and_stack/install/archive/install-redis/)

3. Download the zkeys

```bash
pnpm run download-zkeys:test
# for production zkeys
# pnpm run download-zkeys:ceremony
```

4. Move to the coordinator service directory

```bash
cd apps/coordinator
```

5. Generate the RSA key pair to encrypt values throughout the communication workflow

```bash
pnpm run generate-keypair
```

6. Setup .env file (see `.env.example` for reference)

```bash
cp .env.example .env
```

7. Run the NestJS application

```bash
pnpm run start
# or
pnpm run start:prod
```

## Docker

Remember to run it from the monorepo root directory.

```bash
# Build docker
docker compose -f apps/coordinator/docker-compose.yml build

# Run container detached
docker compose -f apps/coordinator/docker-compose.yml up -d

# Enter the container
docker compose -f apps/coordinator/docker-compose.yml exec coordinator-service /bin/sh

# Stop container
docker compose -f apps/coordinator/docker-compose.yml down
```

## Subgraph deployment

It is possible to deploy subgraph using coordinator service.

First, you need to setup subgraph and create a project. [Subgraph dashboard](https://thegraph.com/studio/).

Then, set env variables:

```
# Subgraph name
SUBGRAPH_NAME="maci-subgraph"

# Subgraph provider url
SUBGRAPH_PROVIDER_URL=https://api.studio.thegraph.com/deploy/

# Subgraph deploy key
SUBGRAPH_DEPLOY_KEY=*******

# Subgraph project folder
SUBGRAPH_FOLDER=../subgraph
```

After deployment, subgraph url will be available in studio dashboard and you can use this type of url to get latest deployed version in your application:

```
https://api.studio.thegraph.com/.../{SUBGRAPH_NAME}/version/latest
```
