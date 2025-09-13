/* eslint-disable @typescript-eslint/no-shadow */
import { Body, Controller, Get, HttpException, HttpStatus, Logger, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from "@nestjs/swagger";

import type { IGenerateData, IMergeArgs } from "./types";
import type { ITallyData } from "@maci-protocol/sdk";

import { mapErrorToHttpStatus } from "../common/http";
import { FileService } from "../file/file.service";
import { IGetPublicKeyData } from "../file/types";

import { GenerateProofDto, MergeTreesDto, SubmitProofsDto } from "./dto";
import { ProofGeneratorService } from "./proof.service";

@ApiTags("v1/proof")
@ApiBearerAuth()
@Controller("v1/proof")
export class ProofController {
  /**
   * Logger
   */
  private readonly logger = new Logger(ProofController.name);

  /**
   * Initialize ProofController
   *
   * @param proofGeneratorService - proof generator service
   * @param fileService - file service
   */
  constructor(
    private readonly proofGeneratorService: ProofGeneratorService,
    private readonly fileService: FileService,
  ) {}

  /**
   * Generate proofs api method
   *
   * @param args - generate proof dto
   * @returns generated proofs and tally data
   */
  @ApiBody({ type: GenerateProofDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: "The proofs have been successfully generated" })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Invalid approval signature" })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Unsupported input (network/policy/voice credit proxy)" })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Operation cannot proceed due to state conflict (e.g., poll already tallied or trees not merged)",
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: "Proof generation failed (encryption/decryption or merge failure)",
  })
  @Post("generate")
  async generate(@Body() args: GenerateProofDto): Promise<IGenerateData> {
    return this.proofGeneratorService.generate(args).catch((error: Error) => {
      this.logger.error(`Error:`, error);
      throw new HttpException(error.message, mapErrorToHttpStatus(error));
    });
  }

  /**
   * Merge trees api method
   *
   * @param args - merge args
   * @returns whether the trees were successfully merged
   */
  @ApiBody({ type: MergeTreesDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: "The proofs have been successfully merged" })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Invalid approval signature" })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid input" })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Operation cannot proceed due to state conflict (e.g., trees not ready/merged)",
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: "Merge failed (failed to merge state or message trees)",
  })
  @Post("merge")
  async merge(@Body() args: IMergeArgs): Promise<boolean> {
    return this.proofGeneratorService.merge(args).catch((error: Error) => {
      this.logger.error(`Error:`, error);
      throw new HttpException(error.message, mapErrorToHttpStatus(error));
    });
  }

  /**
   * Submit proofs on-chain api method
   * @param args - submit proofs on-chain args
   */
  @ApiBody({ type: SubmitProofsDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: "The proofs have been successfully submitted" })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Invalid approval signature" })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid input" })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Operation cannot proceed due to state conflict (e.g., poll already tallied)",
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: "On-chain submission failed (verifying keys/contract interaction errors)",
  })
  @Post("submit")
  async submit(@Body() args: SubmitProofsDto): Promise<ITallyData> {
    return this.proofGeneratorService.submit(args).catch((error: Error) => {
      this.logger.error(`Error:`, error);
      throw new HttpException(error.message, mapErrorToHttpStatus(error));
    });
  }

  /**
   * Get RSA public key for authorization setup
   *
   * @returns RSA public key
   */
  @ApiResponse({ status: HttpStatus.OK, description: "Public key was successfully returned" })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid request" })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: "Failed to read or generate public key" })
  @Get("publicKey")
  async getPublicKey(): Promise<IGetPublicKeyData> {
    return this.fileService.getPublicKey().catch((error: Error) => {
      this.logger.error(`Error:`, error);
      throw new HttpException(error.message, mapErrorToHttpStatus(error));
    });
  }
}
