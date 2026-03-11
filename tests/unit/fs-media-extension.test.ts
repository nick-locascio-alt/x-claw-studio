import { describe, expect, it } from "vitest";
import { inferMediaExtension, inferMediaExtensionFromBuffer } from "@/src/lib/fs";

describe("inferMediaExtension", () => {
  it("prefers the native file type from content-type headers", () => {
    expect(
      inferMediaExtension(
        "https://pbs.twimg.com/media/abc123?name=orig",
        "image/jpeg"
      )
    ).toBe(".jpg");

    expect(
      inferMediaExtension(
        "https://video.twimg.com/ext_tw_video/123/pu/vid/avc1/720x720/file",
        "video/mp4; charset=binary"
      )
    ).toBe(".mp4");
  });

  it("falls back to X format hints when the URL has no filename extension", () => {
    expect(
      inferMediaExtension(
        "https://pbs.twimg.com/media/abc123?format=png&name=small",
        null
      )
    ).toBe(".png");
  });

  it("returns null when neither headers nor url hints identify a native type", () => {
    expect(
      inferMediaExtension(
        "https://pbs.twimg.com/media/abc123?name=orig",
        null
      )
    ).toBeNull();
  });

  it("can infer native types from file signatures when metadata is missing", () => {
    expect(inferMediaExtensionFromBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xdb]))).toBe(".jpg");
    expect(
      inferMediaExtensionFromBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]))
    ).toBe(".png");
    expect(inferMediaExtensionFromBuffer(Buffer.from("GIF89a", "ascii"))).toBe(".gif");
    expect(
      inferMediaExtensionFromBuffer(Buffer.from("RIFF0000WEBP", "ascii"))
    ).toBe(".webp");
    expect(
      inferMediaExtensionFromBuffer(Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]))
    ).toBe(".mp4");
  });
});
