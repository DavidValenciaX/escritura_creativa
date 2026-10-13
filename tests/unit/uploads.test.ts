import { describe, it, expect } from "vitest";
import {
  verifyFile,
  prepareUpload,
  prepareAvatar,
} from "../../src/lib/uploads";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("upload validation", () => {
  it("resizes and compresses a large avatar to a bounded WebP without metadata", async () => {
    const original = await sharp(randomBytes(1600 * 1000 * 3), {
      raw: { width: 1600, height: 1000, channels: 3 },
    })
      .jpeg({ quality: 95 })
      .withMetadata()
      .toBuffer();
    const avatar = await prepareAvatar(original, "image/jpeg");
    const metadata = await sharp(avatar.bytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(avatar.bytes.length).toBeLessThan(original.length);
    expect(avatar.bytes.length).toBeLessThanOrEqual(256 * 1024);
  });
  it("rejects oversized and malformed avatars", async () => {
    await expect(
      prepareAvatar(new Uint8Array(4 * 1024 * 1024 + 1), "image/png"),
    ).rejects.toThrow("4 MB");
    await expect(
      prepareAvatar(new Uint8Array([255, 216, 255, 0]), "image/jpeg"),
    ).rejects.toThrow("dañada");
  });
  it("accepts a real WOFF2 font from the bundled catalogue", () => {
    const font = readFileSync(
      join(
        process.cwd(),
        "node_modules/@fontsource/caveat/files/caveat-latin-400-normal.woff2",
      ),
    );
    expect(verifyFile(font, "font", "font/woff2").extension).toBe("woff2");
  });
  it("decodes images and rejects header-only forged uploads", async () => {
    await expect(
      prepareUpload(new Uint8Array([255, 216, 255, 0]), "image", "image/jpeg"),
    ).rejects.toThrow("dañada");
    const original = await sharp({
      create: { width: 12, height: 8, channels: 3, background: "#ffccaa" },
    })
      .png()
      .toBuffer();
    const result = await prepareUpload(original, "image", "image/png");
    expect(result.mime).toBe("image/webp");
    expect((await sharp(result.bytes).metadata()).width).toBe(12);
  });
  it("rejects executable formats disguised as images", () =>
    expect(() =>
      verifyFile(
        new TextEncoder().encode('<svg onload="alert(1)"/>'),
        "image",
        "image/png",
      ),
    ).toThrow());
  it("rejects mismatched MIME types", () =>
    expect(() =>
      verifyFile(new Uint8Array([255, 216, 255, 0]), "image", "image/png"),
    ).toThrow());
  it("enforces image and font size limits", () => {
    expect(() =>
      verifyFile(new Uint8Array(10 * 1024 * 1024 + 1), "image", "image/png"),
    ).toThrow();
    expect(() =>
      verifyFile(new Uint8Array(2 * 1024 * 1024 + 1), "font", "font/woff2"),
    ).toThrow();
  });
  it("rejects truncated and inconsistent WOFF2 headers", () => {
    expect(() =>
      verifyFile(new TextEncoder().encode("wOF2"), "font", "font/woff2"),
    ).toThrow();
    const bytes = new Uint8Array(48);
    bytes.set(new TextEncoder().encode("wOF2"));
    expect(() => verifyFile(bytes, "font", "font/woff2")).toThrow();
  });
});
