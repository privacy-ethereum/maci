import { EMode, ESupportedChains } from "@maci-protocol/sdk";
import { HttpException, HttpStatus } from "@nestjs/common";

import { type IdentityScheduledPollDto, type SchedulePollWithSignerDto } from "../dto";
import { SchedulerController } from "../scheduler.controller";
import { type SchedulerService } from "../scheduler.service";

const scheduledPoll: SchedulePollWithSignerDto = {
  maciAddress: "0x0",
  pollId: 5,
  mode: EMode.NON_QV,
  chain: ESupportedChains.OptimismSepolia,
  deploymentBlockNumber: 1,
};

const identityScheduledPoll = {
  maciAddress: scheduledPoll.maciAddress,
  pollId: scheduledPoll.pollId,
  chain: scheduledPoll.chain,
} as IdentityScheduledPollDto;

describe("SchedulerController", () => {
  let service: jest.Mocked<SchedulerService>;

  let controller: SchedulerController;

  beforeEach(() => {
    service = {
      registerPoll: jest.fn().mockResolvedValue({ isScheduled: true }),
      isPollScheduled: jest.fn().mockResolvedValue({ isScheduled: true }),
      deleteScheduledPoll: jest.fn().mockResolvedValue({ isScheduled: false }),
    } as unknown as jest.Mocked<SchedulerService>;

    controller = new SchedulerController(service);
  });

  describe("register", () => {
    test("should register a poll for finalization", async () => {
      const { isScheduled } = await controller.register(scheduledPoll);

      expect(isScheduled).toBe(true);
    });

    test("should throw an error if registration fails", async () => {
      const errorMessage = "Registration failed";
      service.registerPoll.mockRejectedValueOnce(new Error(errorMessage));

      await expect(controller.register(scheduledPoll)).rejects.toThrow(
        new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });
  });

  describe("status", () => {
    test("should return scheduled poll status", async () => {
      const { isScheduled } = await controller.status(identityScheduledPoll);

      expect(isScheduled).toBe(true);
    });

    test("should throw an error if checking status fails", async () => {
      const errorMessage = "checking status failed";
      service.isPollScheduled.mockRejectedValueOnce(new Error(errorMessage));

      await expect(controller.status(scheduledPoll)).rejects.toThrow(
        new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });
  });

  describe("delete", () => {
    test("should delete a scheduled poll", async () => {
      await controller.register(scheduledPoll);

      const { isScheduled } = await controller.delete(identityScheduledPoll);

      expect(isScheduled).toBe(false);
    });

    test("should throw an error if checking status fails", async () => {
      const errorMessage = "Delete failed";
      service.deleteScheduledPoll.mockRejectedValueOnce(new Error(errorMessage));

      await expect(controller.delete(scheduledPoll)).rejects.toThrow(
        new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });
  });
});
