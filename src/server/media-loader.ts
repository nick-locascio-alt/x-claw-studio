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

function inferMimeTypeFromBuffer(buffer: Buffer): string | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (buffer.length >= 6) {
    const gifHeader = buffer.subarray(0, 6).toString("ascii");
    if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
      return "image/gif";
    }
  }

  if (buffer.length >= 12) {
    const riffHeader = buffer.subarray(0, 4).toString("ascii");
    const webpHeader = buffer.subarray(8, 12).toString("ascii");
    if (riffHeader === "RIFF" && webpHeader === "WEBP") {
      return "image/webp";
    }
  }

  if (
    buffer.length >= 8 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return "video/mp4";
  }

  return null;
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
    mimeType = inferMimeTypeFromBuffer(buffer) ?? inferMimeTypeFromPath(source);
  }

  return {
    base64: buffer.toString("base64"),
    mimeType
  };
}
