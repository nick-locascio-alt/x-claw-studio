import fs from "node:fs";
import sharp from "sharp";
import type { MediaFingerprint } from "@/src/lib/types";

export async function computeDifferenceHash(filePath: string): Promise<MediaFingerprint | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const { data, info } = await sharp(filePath)
    .grayscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (data.length === 0) {
    return null;
  }

  const pixels = Array.from(data);
  const bits: string[] = [];

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const left = pixels[row * 9 + column];
      const right = pixels[row * 9 + column + 1];
      bits.push(left > right ? "1" : "0");
    }
  }

  const bitString = bits.join("");
  const hex = BigInt(`0b${bitString}`).toString(16).padStart(16, "0");

  return {
    algorithm: "dhash_8x8",
    hex,
    bitLength: 64,
    width: info.width,
    height: info.height
  };
}

export function hammingDistanceHex(left: string, right: string): number {
  const leftBits = BigInt(`0x${left}`);
  const rightBits = BigInt(`0x${right}`);
  let xor = leftBits ^ rightBits;
  let count = 0;

  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }

  return count;
}
