import fs from "node:fs";
import path from "node:path";
import { ensureDir, slugify, writeJson } from "@/src/lib/fs";
import type { MemeTemplateRecord } from "@/src/lib/meme-template";

const projectRoot = process.cwd();
const memeTemplateDir = path.join(projectRoot, "data", "analysis", "meme-templates");
const memeTemplateIndexPath = path.join(memeTemplateDir, "index.json");
const memeTemplateAssetDir = path.join(memeTemplateDir, "assets");

export function readMemeTemplates(): MemeTemplateRecord[] {
  if (!fs.existsSync(memeTemplateIndexPath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(memeTemplateIndexPath, "utf8")) as MemeTemplateRecord[];
}

export function writeMemeTemplates(records: MemeTemplateRecord[]): void {
  writeJson(memeTemplateIndexPath, records);
}

export function upsertMemeTemplate(record: MemeTemplateRecord): MemeTemplateRecord {
  const current = readMemeTemplates();
  const index = current.findIndex((entry) => entry.key === record.key);
  const next = [...current];

  if (index === -1) {
    next.push(record);
  } else {
    next[index] = {
      ...next[index],
      ...record,
      importedAt: next[index].importedAt,
      updatedAt: record.updatedAt
    };
  }

  next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  writeMemeTemplates(next);
  return next.find((entry) => entry.key === record.key) as MemeTemplateRecord;
}

export function buildMemeTemplateId(label: string): string {
  return slugify(label) || `meme-template-${Date.now()}`;
}

export function ensureMemeTemplateAssetDir(templateId: string): string {
  const dir = path.join(memeTemplateAssetDir, templateId);
  ensureDir(dir);
  return dir;
}
