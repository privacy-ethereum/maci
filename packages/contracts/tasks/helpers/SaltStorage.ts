import fs from "fs";
import { writeFile } from "fs/promises";
import path from "path";

import type { PollSaltsData } from "./types";

import { logMagenta, info } from "../../ts/logger";

const SALTS_DIR = ".maci-salts";
const SALTS_FILE_PREFIX = "poll-salts-";

/**
 * Get the salts file path for a specific poll
 */
function getSaltsFilePath(pollId: string): string {
  if (!fs.existsSync(SALTS_DIR)) {
    fs.mkdirSync(SALTS_DIR, { recursive: true });
  }
  return path.join(SALTS_DIR, `${SALTS_FILE_PREFIX}${pollId}.json`);
}

/**
 * Save salts to disk for a specific poll
 */
export async function saveSalts(pollId: string, salts: PollSaltsData): Promise<void> {
  const filePath = getSaltsFilePath(pollId);
  const dataToSave = { ...salts, lastUpdated: new Date().toISOString() };

  await writeFile(filePath, JSON.stringify(dataToSave, null, 2), "utf8").catch((error: unknown) => {
    logMagenta({ text: info(`Error saving salts: ${String(error)}`) });
  });
}

/**
 * Load salts from disk for a specific poll
 */
export function loadSalts(pollId: string): PollSaltsData | null {
  const filePath = getSaltsFilePath(pollId);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(fileContent) as PollSaltsData;
    return data;
  } catch (error) {
    logMagenta({ text: info(`Error loading salts: ${String(error)}`) });
    return null;
  }
}

/**
 * Delete salts file for a specific poll
 */
export function deleteSalts(pollId: string): void {
  const filePath = getSaltsFilePath(pollId);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      logMagenta({ text: info(`Error deleting salts: ${String(error)}`) });
    }
  }
}

/**
 * Check if salts exist for a specific poll
 */
export function saltsExist(pollId: string): boolean {
  return fs.existsSync(getSaltsFilePath(pollId));
}
