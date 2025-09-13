import { ContractStorage, Deployment, type EContracts } from "@maci-protocol/sdk";

import fs from "fs";

import type { IReadContractAddressesArgs, IStoreContractsArgs } from "./interfaces";

/**
 * Read a JSON file from disk
 * @param path - the path of the file
 * @returns the JSON object
 */
export const readJSONFile = async <T = Record<string, Record<string, string> | undefined>>(
  path: string,
): Promise<T> => {
  const isExists = fs.existsSync(path);

  if (!isExists) {
    throw new Error(`File ${path} does not exist`);
  }

  return fs.promises.readFile(path).then((res) => JSON.parse(res.toString()) as T);
};

/**
 * Store a contract address to the local address store file
 * @param args the store contract addresses arguments
 */
export const storeContractAddresses = async ({ data, signer }: IStoreContractsArgs): Promise<void> => {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const contractStorage = ContractStorage.getInstance();
  const deployment = Deployment.getInstance();
  const network = await signer.provider?.getNetwork().then(({ name }) => name);

  const contracts = await Promise.all(
    Object.entries(data).map(([name, { address, key }]) =>
      deployment.getContract({ name: name as EContracts, address, key, signer }),
    ),
  );

  await Promise.all(
    Object.entries(data).map(([id, { key, args }], index) =>
      contractStorage.register({
        id,
        key,
        contract: contracts[index],
        args,
        network: network ?? "hardhat",
      }),
    ),
  );
};

/**
 * Read a contract addresses from the local address store file
 * @param args the read contract addresses arguments
 * @returns the contract addresses
 */
export const readContractAddresses = ({
  contractNames,
  network = "hardhat",
  keys = [],
  defaultAddresses = [],
}: IReadContractAddressesArgs): string[] => {
  const contractStorage = ContractStorage.getInstance();

  return contractStorage
    .getAddresses(contractNames, network, keys)
    .map((address, index) => defaultAddresses[index] || address || "");
};

/**
 * Delete the content of the contract address file
 *
 * @param network the network
 */
export const resetContractAddresses = (network = "hardhat"): void => {
  const contractStorage = ContractStorage.getInstance();
  contractStorage.cleanup(network);
};
