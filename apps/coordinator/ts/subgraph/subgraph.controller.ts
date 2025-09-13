/* eslint-disable @typescript-eslint/no-shadow */
import { Body, Controller, HttpException, HttpStatus, Logger, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from "@nestjs/swagger";

import type { IDeploySubgraphReturn } from "./types";

import { AccountSignatureGuard } from "../auth/AccountSignatureGuard.service";
import { mapErrorToHttpStatus } from "../common/http";

import { DeploySubgraphDto } from "./dto";
import { SubgraphService } from "./subgraph.service";

@ApiTags("v1/subgraph")
@ApiBearerAuth()
@Controller("v1/subgraph")
@UseGuards(AccountSignatureGuard)
export class SubgraphController {
  /**
   * Logger
   */
  private readonly logger = new Logger(SubgraphController.name);

  /**
   * Initialize SubgraphController
   *
   * @param subgraphService - subgraph service
   */
  constructor(private readonly subgraphService: SubgraphService) {}

  /**
   * Generate proofs api method
   *
   * @param args - generate proof dto
   * @returns generated proofs and tally data
   */
  @ApiBody({ type: DeploySubgraphDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: "The subgraph was successfully deployed" })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Invalid approval signature" })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid input" })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: "Subgraph deployment failed or deploy key missing",
  })
  @Post("deploy")
  async deploy(@Body() args: DeploySubgraphDto): Promise<IDeploySubgraphReturn> {
    return this.subgraphService.deploy(args).catch((error: Error) => {
      this.logger.error(`Error:`, error);
      throw new HttpException(error.message, mapErrorToHttpStatus(error));
    });
  }
}
