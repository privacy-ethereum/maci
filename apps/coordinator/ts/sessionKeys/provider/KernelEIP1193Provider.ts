import { type KernelAccountClient } from "@zerodev/sdk";
import { safeCreateCallAddress } from "@zerodev/sdk/constants";
import { encodeFunctionData, parseAbi } from "viem";

import { EventEmitter } from "events";

import type { EIP1193Parameters, EIP1193RequestFn, Hash, Hex, SendTransactionParameters, TypedDataDomain } from "viem";

export const SafeCreateCallAbi = parseAbi([
  "function performCreate(uint256 value, bytes memory deploymentData) public returns (address newContract)",
  "function performCreate2(uint256 value, bytes memory deploymentData, bytes32 salt) public returns (address newContract)",
]);

type EncodeExecuteDelegateCallArgs = Parameters<
  typeof encodeFunctionData<typeof SafeCreateCallAbi, "performCreate">
>[0]["args"];

export const encodeSafeCreateCall = (args: EncodeExecuteDelegateCallArgs): Hex =>
  encodeFunctionData({
    abi: SafeCreateCallAbi,
    functionName: "performCreate",
    args,
  });

export class KernelEIP1193Provider extends EventEmitter {
  private kernelClient: KernelAccountClient;

  constructor(kernelClient: KernelAccountClient) {
    super();
    this.kernelClient = kernelClient;
  }

  async request({ method, params = [] }: EIP1193Parameters): ReturnType<EIP1193RequestFn> {
    switch (method) {
      case "eth_requestAccounts":
        return this.handleEthRequestAccounts();
      case "eth_accounts":
        return this.handleEthAccounts();
      case "eth_sendTransaction":
        return this.handleEthSendTransaction(params);
      case "eth_sign":
        return this.handleEthSign(params as [string, string]);
      case "personal_sign":
        return this.handlePersonalSign(params as [string, string]);
      case "eth_signTypedData":
      case "eth_signTypedData_v4":
        return this.handleEthSignTypedDataV4(params as [string, string]);
      default:
        return this.kernelClient.transport.request({ method, params });
    }
  }

  private handleEthRequestAccounts(): string[] {
    if (!this.kernelClient.account) {
      return [];
    }

    return [this.kernelClient.account.address];
  }

  private handleEthAccounts(): string[] {
    if (!this.kernelClient.account) {
      return [];
    }

    return [this.kernelClient.account.address];
  }

  private async handleEthSendTransaction(params: unknown): Promise<Hash> {
    const [tx] = params as [SendTransactionParameters];

    if (!("to" in tx) && tx.data) {
      // contract deployment
      tx.data = encodeSafeCreateCall([0n, tx.data]);
      tx.to = safeCreateCallAddress;

      return this.kernelClient.sendTransaction(tx);
    }

    // eth transaction (function call or eth transfer)
    return this.kernelClient.sendTransaction(tx);
  }

  private async handleEthSign(params: [string, string]): Promise<string> {
    if (!this.kernelClient.account) {
      throw new Error("account not connected!");
    }

    const [address, message] = params;

    if (address.toLowerCase() !== this.kernelClient.account.address.toLowerCase()) {
      throw new Error("cannot sign for address that is not the current account");
    }

    return this.kernelClient.signMessage({
      message,
      account: this.kernelClient.account,
    });
  }

  private async handlePersonalSign(params: [string, string]): Promise<string> {
    if (!this.kernelClient.account) {
      throw new Error("account not connected!");
    }

    const [message, address] = params;

    if (address.toLowerCase() !== this.kernelClient.account.address.toLowerCase()) {
      throw new Error("cannot sign for address that is not the current account");
    }

    return this.kernelClient.signMessage({
      message,
      account: this.kernelClient.account,
    });
  }

  private async handleEthSignTypedDataV4(params: [string, string]): Promise<string> {
    if (!this.kernelClient.account) {
      throw new Error("account not connected!");
    }

    const [address, typedDataJSON] = params;

    const typedData = JSON.parse(typedDataJSON) as {
      domain: TypedDataDomain;
      types: Record<string, unknown>;
      message: Record<string, unknown>;
      primaryType: string;
    };

    if (address.toLowerCase() !== this.kernelClient.account.address.toLowerCase()) {
      throw new Error("cannot sign for address that is not the current account");
    }

    return this.kernelClient.signTypedData({
      account: this.kernelClient.account,
      domain: typedData.domain,
      types: typedData.types,
      message: typedData.message,
      primaryType: typedData.primaryType,
    });
  }
}
