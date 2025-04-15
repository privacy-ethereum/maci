import { expect } from "chai";

import { ERC20VotesInitialVoiceCreditProxy, getDefaultSigner, MockERC20Votes } from "../ts";
import { deployERC20VotesInitialVoiceCreditProxy, deployMockERC20Votes } from "../ts/deploy";

describe("ERC20VotesInitialVoiceCreditsProxy", () => {
  let erc20VotesInitialVoiceCreditProxy: ERC20VotesInitialVoiceCreditProxy;
  let mockERC20Votes: MockERC20Votes;

  const snapshotBlock = 100n;
  const factor = 2n;

  let user: string;

  before(async () => {
    const signer = await getDefaultSigner();
    user = await signer.getAddress();
    mockERC20Votes = await deployMockERC20Votes(signer, true);

    [erc20VotesInitialVoiceCreditProxy] = await deployERC20VotesInitialVoiceCreditProxy(
      {
        snapshotBlock,
        token: await mockERC20Votes.getAddress(),
        factor,
      },
      signer,
      undefined,
      true,
    );
  });

  it("should return the correct voice credits", async () => {
    const votes = 50n;
    await mockERC20Votes.changeVotes(votes);

    const voiceCredits = await erc20VotesInitialVoiceCreditProxy.getVoiceCredits(user, "0x");

    expect(voiceCredits).to.equal(votes / factor);
  });
});
