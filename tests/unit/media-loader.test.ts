import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadMediaAsBase64 } from "@/src/server/media-loader";

const tempPaths: string[] = [];

afterEach(() => {
  while (tempPaths.length > 0) {
    const filePath = tempPaths.pop();
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

describe("loadMediaAsBase64", () => {
  it("sniffs a jpeg mime type for local files without an image extension", async () => {
    const filePath = path.join(os.tmpdir(), `media-loader-${Date.now()}.bin`);
    tempPaths.push(filePath);

    fs.writeFileSync(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]));
    const loaded = await loadMediaAsBase64(filePath);

    expect(loaded.mimeType).toBe("image/jpeg");
    expect(loaded.base64).toBe(Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]).toString("base64"));
  });
});
