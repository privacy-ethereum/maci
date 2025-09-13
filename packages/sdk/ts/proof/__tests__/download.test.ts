import { generateProofSnarkjs } from "@maci-protocol/contracts";

import { type TCircuitInputs } from "../../utils/types";
import { downloadPollJoiningArtifactsBrowser } from "../download";

/**
 * The inputs for the proof generation
 */
const inputs = {
  privateKey: "1259082279488355278660453796037744749156697484507442909424227073450806091599",
  pollPublicKey: [
    "4604149953291977424931588219098726306922992659857425248363017596008978179462",
    "1911350329545195833133079763781611226710101140694516439580176096139978229522",
  ],
  siblings: [
    ["1309255631273308531193241901289907343161346846555918942743921933037802809814"],
    ["0"],
    ["0"],
    ["0"],
    ["0"],
    ["0"],
    ["0"],
    ["0"],
    ["0"],
    ["0"],
  ],
  index: 1,
  nullifier: "5960968591926285526739882209300764345427591192846309606519433839944864771425",
  stateRoot: "19853258600018552129206808764461795697997153860385513081821578400505176714352",
  actualStateTreeDepth: "1",
  pollId: "0",
};

describe("downloadPollJoiningArtifactsBrowser", () => {
  it("should allow to generate a proof using the downloaded artifacts", async () => {
    const { zKey, wasm } = await downloadPollJoiningArtifactsBrowser({
      testing: true,
      stateTreeDepth: 10,
    });

    expect(zKey).toBeDefined();
    expect(wasm).toBeDefined();

    const { proof } = await generateProofSnarkjs({
      inputs: inputs as unknown as TCircuitInputs,
      zkeyPath: zKey as unknown as string,
      wasmPath: wasm as unknown as string,
    });

    expect(proof).toBeDefined();
    expect(proof.protocol).toBe("groth16");
    expect(proof.pi_a.length).toBe(3);
    expect(proof.pi_b.length).toBe(3);
    expect(proof.pi_c.length).toBe(3);
    expect(proof.curve).toBe("bn128");
  });
});
