import { extractVkToFile } from "../commands/extractVkToFile";
import { genKeyPair } from "../commands/genKeyPair";
import { genMaciPubKey } from "../commands/genPubKey";
import { mergeMessages } from "../commands/mergeMessages";
import { mergeSignups } from "../commands/mergeSignups";
import { getPoll } from "../commands/poll";
import { publish, publishBatch } from "../commands/publish";
import { signup, isRegisteredUser } from "../commands/signup";
import { verify } from "../commands/verify";

export {
  genKeyPair,
  genMaciPubKey,
  publish,
  publishBatch,
  signup,
  isRegisteredUser,
  verify,
  getPoll,
  extractVkToFile,
  mergeSignups,
  mergeMessages,
};

export type { ISnarkJSVerificationKey } from "maci-circuits";

export {
  linkPoseidonLibraries,
  Deployment,
  ContractStorage,
  EContracts,
  EMode,
  type IVerifyingKeyStruct,
} from "maci-contracts";

export * from "maci-contracts/typechain-types";

export { VerifyingKey, PubKey, type IVkObjectParams } from "maci-domainobjs";

export type {
  TallyData,
  PublishArgs,
  SignupArgs,
  ISignupData,
  VerifyArgs,
  IGetPollArgs,
  IGetPollData,
  IRegisteredUserArgs,
  IPublishBatchArgs,
  IGenKeypairArgs,
  IPublishBatchData,
  IPublishMessage,
} from "../utils";
