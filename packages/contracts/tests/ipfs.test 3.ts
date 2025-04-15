import chai from "chai";
import chaiAsPromised from "chai-as-promised";

import { IpfsService } from "../ts/ipfs";

chai.use(chaiAsPromised);

const { expect } = chai;

describe("IpfsService", () => {
  let ipfsService: IpfsService;

  beforeEach(() => {
    ipfsService = IpfsService.getInstance();
  });

  it("should read data properly", async () => {
    const data = await ipfsService.read("bafybeibro7fxpk7sk2nfvslumxraol437ug35qz4xx2p7ygjctunb2wi3i");

    expect(data).to.deep.equal({ Title: "sukuna", Description: "gambare gambare 🔥" });
  });

  it("should return null if can't read data", async () => {
    const data = await ipfsService.read("invalid");

    expect(data).to.eq(null);
  });
});
