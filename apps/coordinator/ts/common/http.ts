import { HttpStatus } from "@nestjs/common";

import { ErrorCodes } from "./errors";

/**
 * Map a thrown error (usually containing ErrorCodes) to an appropriate HTTP status
 */
export function mapErrorToHttpStatus(error: Error): HttpStatus {
  const { message } = error;

  switch (message) {
    case ErrorCodes.UNSUPPORTED_NETWORK.toString():
    case ErrorCodes.UNSUPPORTED_VOICE_CREDIT_PROXY_FACTORY.toString():
    case ErrorCodes.UNSUPPORTED_VOICE_CREDIT_PROXY.toString():
    case ErrorCodes.UNSUPPORTED_POLICY.toString():
      return HttpStatus.BAD_REQUEST;

    case ErrorCodes.INVALID_APPROVAL.toString():
      return HttpStatus.FORBIDDEN;

    case ErrorCodes.SESSION_KEY_NOT_FOUND.toString():
    case ErrorCodes.POLL_NOT_FOUND.toString():
      return HttpStatus.NOT_FOUND;

    case ErrorCodes.POLL_ALREADY_SCHEDULED.toString():
    case ErrorCodes.POLL_ALREADY_TALLIED.toString():
    case ErrorCodes.NOT_MERGED_STATE_TREE.toString():
    case ErrorCodes.NOT_MERGED_MESSAGE_TREE.toString():
      return HttpStatus.CONFLICT;

    case ErrorCodes.MACI_NOT_DEPLOYED.toString():
    case ErrorCodes.VERIFIER_NOT_DEPLOYED.toString():
    case ErrorCodes.VERIFYING_KEYS_REGISTRY_NOT_DEPLOYED.toString():
      return HttpStatus.PRECONDITION_FAILED;

    case ErrorCodes.FILE_NOT_FOUND.toString():
    case ErrorCodes.SUBGRAPH_DEPLOY_KEY_NOT_FOUND.toString():
    case ErrorCodes.SUBGRAPH_DEPLOY.toString():
    case ErrorCodes.PRIVATE_KEY_MISMATCH.toString():
    case ErrorCodes.DECRYPTION.toString():
    case ErrorCodes.ENCRYPTION.toString():
    case ErrorCodes.COORDINATOR_RPC_URL_NOT_SET.toString():
    case ErrorCodes.FAILED_TO_MERGE_STATE_TREE.toString():
    case ErrorCodes.FAILED_TO_MERGE_MESSAGE_SUBTREES.toString():
    case ErrorCodes.FAILED_TO_MERGE_MESSAGE_TREE.toString():
    case ErrorCodes.FAILED_TO_SET_VERIFYING_KEYS.toString():
    case ErrorCodes.FAILED_TO_DEPLOY_CONTRACT.toString():
    case ErrorCodes.FAILED_TO_SET_MACI_INSTANCE_ON_POLICY.toString():
    case ErrorCodes.FAILED_TO_DEPLOY_MACI.toString():
    case ErrorCodes.FAILED_TO_DEPLOY_POLL.toString():
    case ErrorCodes.FAILED_TO_UPDATE_SCHEDULED_POLL.toString():
      return HttpStatus.INTERNAL_SERVER_ERROR;

    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
