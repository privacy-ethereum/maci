import * as tar from "tar";

import fs from "fs";
import https from "https";
import path from "path";

const ZKEY_PATH = path.resolve(process.argv.slice(3)[0]);
const ZKEYS_URLS = {
  test: "https://maci-develop-fra.s3.eu-central-1.amazonaws.com/v3.0.0/maci_artifacts_v3.0.0_test.tar.gz",
  prod: "https://maci-develop-fra.s3.eu-central-1.amazonaws.com/v3.0.0/maci_artifacts_prod.tar.gz",
  large: "https://maci-develop-fra.s3.eu-central-1.amazonaws.com/v3.0.0/maci_artifacts_large.tar.gz",
};
const ARCHIVE_NAME = path.resolve(ZKEY_PATH, "maci_keys.tar.gz");

export async function downloadZkeys(): Promise<void> {
  const [type] = process.argv.slice(2).map((arg) => arg.trim() as keyof typeof ZKEYS_URLS);

  if (!Object.keys(ZKEYS_URLS).includes(type)) {
    throw new Error(`${type} doesn't exist`);
  }

  const isExists = fs.existsSync(ZKEY_PATH);

  if (!isExists) {
    await fs.promises.mkdir(ZKEY_PATH);
  }

  const file = fs.createWriteStream(ARCHIVE_NAME);

  https
    .get(ZKEYS_URLS[type], (response) => {
      const totalSize = Number(response.headers["content-length"] ?? 0);

      if (totalSize) {
        let downloadedSize = 0;

        response.on("data", (chunk) => {
          downloadedSize += chunk.length;
          const percentage = ((downloadedSize / totalSize) * 100).toFixed(0);
          process.stdout.write(`\rDownloading... ${percentage}%`);
        });
      }

      response.pipe(file);

      file
        .on("finish", () => {
          process.stdout.write("\n");
          console.log("Download complete - extracting files");
          file.close();

          tar.x({ f: ARCHIVE_NAME, C: ZKEY_PATH, strip: 1 }).then(() => fs.promises.rm(ARCHIVE_NAME));
        })
        .on("error", () => fs.promises.unlink(ARCHIVE_NAME));
    })
    .on("error", () => fs.promises.unlink(ARCHIVE_NAME));
}

downloadZkeys();
