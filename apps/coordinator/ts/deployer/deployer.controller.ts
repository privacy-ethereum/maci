/* eslint-disable @typescript-eslint/no-shadow */
import { Body, Controller, HttpException, HttpStatus, Logger, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from "@nestjs/swagger";

import { AccountSignatureGuard } from "../auth/AccountSignatureGuard.service";
import { mapErrorToHttpStatus } from "../common/http";

import { DeployerService } from "./deployer.service";
import { DeployerServiceDeployMaciDto, DeployerServiceDeployPollDto } from "./dto";

@ApiTags("v1/deploy")
@ApiBearerAuth()
@Controller("v1/deploy")
@UseGuards(AccountSignatureGuard)
export class DeployerController {
  /**
   * Logger
   */
  private readonly logger = new Logger(DeployerController.name);

  /**
   * Initialize DeployerController
   *
   * @param deployerService - deployer service
   */
  constructor(private readonly deployerService: DeployerService) {}

  /**
   * Deploy MACI contracts api method
   *
   * @param args - deploy maci dto
   * @returns maci contract address
   */
  @ApiBody({ type: DeployerServiceDeployMaciDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: "The MACI contracts were successfully deployed" })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Invalid approval signature" })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Unsupported input (network/policy/voice credit proxy)" })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: "Deployment failed or configuration error (e.g., RPC URL not set, contract deployment failed)",
  })
  @Post("maci")
  async deployMACIContracts(@Body() args: DeployerServiceDeployMaciDto): Promise<{ address: string }> {
    return this.deployerService.deployMaci(args).catch((error: Error) => {
      this.logger.error(`Error:`, error);
      throw new HttpException(error.message, mapErrorToHttpStatus(error));
    });
  }

  /**
   * Deploy a poll
   *
   * @param args - deploy poll dto
   * @returns the poll id
   */
  @ApiBody({ type: DeployerServiceDeployPollDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: "The Poll was successfully deployed" })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Invalid approval signature" })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Unsupported input (network/policy/voice credit proxy)" })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_FAILED,
    description: "Required contracts not deployed (MACI/Verifier/VerifyingKeysRegistry)",
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: "Poll deployment failed (failed to deploy poll/set verifying keys/set MACI instance on policy)",
  })
  @Post("poll")
  async deployPoll(@Body() args: DeployerServiceDeployPollDto): Promise<{ pollId: string }> {
    return this.deployerService.deployPoll(args).catch((error: Error) => {
      this.logger.error(`Error:`, error);
      throw new HttpException(error.message, mapErrorToHttpStatus(error));
    });
  }
}
