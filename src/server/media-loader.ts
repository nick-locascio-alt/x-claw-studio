import fs from "node:fs";
import path from "node:path";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4"
};

function inferMimeTypeFromPath(filePath: string): string {
  const extension = path.extname(new URL(filePath, "https://local/").pathname).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export async function loadMediaAsBase64(source: string): Promise<{
  base64: string;
  mimeType: string;
}> {
  let buffer: Buffer;
  let mimeType: string;

  if (source.startsWith("http://") || source.startsWith("https://")) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
    }
    buffer = Buffer.from(await response.arrayBuffer());
    mimeType = response.headers.get("content-type") ?? inferMimeTypeFromPath(source);
  } else {
    buffer = fs.readFileSync(source);
    mimeType = inferMimeTypeFromPath(source);
  }

  return {
    base64: buffer.toString("base64"),
    mimeType
  };
}
