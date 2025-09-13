import { type CreateKernelAccountReturnType, type KernelAccountClient } from "@zerodev/sdk";
import { type BundlerClient } from "viem/account-abstraction";

import type { Chain, HttpTransport, PublicClient, Transport } from "viem";

export type KernelClientType = KernelAccountClient<Transport, Chain, CreateKernelAccountReturnType>;

export type BundlerClientType = BundlerClient;

export type PublicClientType = PublicClient<Transport, Chain>;

export type PublicClientHTTPType = PublicClient<HttpTransport, Chain>;
