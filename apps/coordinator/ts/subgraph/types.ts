import { type ESupportedChains } from "@maci-protocol/sdk";

/**
 * WS events for subgraph
 */
export enum ESubgraphEvents {
  START = "start-deploy",
  PROGRESS = "progress-deploy",
  FINISH = "finish-deploy",
  ERROR = "exception",
}

/**
 * Interface that represents deploy subgraph args
 */
export interface IDeploySubgraphArgs {
  /**
   * MACI contract address
   */
  maciContractAddress: string;

  /**
   * Start block
   */
  startBlock: number;

  /**
   * Network
   */
  network: ESupportedChains;

  /**
   * Subgraph name
   */
  name: string;

  /**
   * Version tag
   */
  tag: string;
}

/**
 * Interface that represents deploy subgraph return data
 */
export interface IDeploySubgraphReturn {
  /**
   * Deployed subgraph url
   */
  url: string;
}

/**
 * Interface that represents progress data
 */
export interface IProgressArgs {
  /**
   * Current step
   */
  current: EProgressStep;

  /**
   * Total steps
   */
  total: number;
}

/**
 * Progress step
 */
export enum EProgressStep {
  SCHEMA,
  NETWORK,
  TEMPLATE,
  CODEGEN,
  BUILD,
  DEPLOY,
}

export const TOTAL_STEPS = Object.keys(EProgressStep).length / 2;

/**
 * Interface that represents websocket hooks for subgraph service
 */
export interface ISubgraphWsHooks {
  /**
   * Websockets progress hook
   *
   * @param params - progress params
   */
  onProgress: ({ current, total }: IProgressArgs) => void;

  /**
   * Websockets error hook
   *
   * @param error - error
   */
  onFail: (error: Error) => void;

  /**
   * Websockets success hook
   *
   * @param url - subgraph url
   */
  onSuccess: (url: string) => void;
}
