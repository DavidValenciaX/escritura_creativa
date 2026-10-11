import { HttpError } from "./errors";
import sharp from "sharp";
export function verifyFile(
  bytes: Uint8Array,
  kind: "image" | "font",
  reportedType: string,
) {
  const limit = kind === "font" ? 2 * 1024 * 1024 : 10 * 1024 * 1024;
  if (!bytes.length || bytes.length > limit)
    throw new HttpError(
      400,
      kind === "font"
        ? "La fuente debe pesar hasta 2 MB."
        : "La imagen debe pesar hasta 10 MB.",
    );
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  if (kind === "font") {
    if (bytes.length < 48 || ascii(0, 4) !== "wOF2")
      throw new HttpError(400, "Solo se admiten fuentes WOFF2 válidas.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (
      view.getUint32(8) !== bytes.length ||
      view.getUint16(12) === 0 ||
      view.getUint16(12) > 256 ||
      view.getUint16(14) !== 0 ||
      view.getUint32(16) > 20 * 1024 * 1024 ||
      view.getUint32(16) < 12 ||
      view.getUint32(20) === 0 ||
      view.getUint32(20) > bytes.length - 48
    )
      throw new HttpError(400, "Cabecera WOFF2 inválida.");
    return { mime: "font/woff2", extension: "woff2" };
  }
  let mime = "",
    extension = "";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    mime = "image/jpeg";
    extension = "jpg";
  } else if (
    bytes
      .slice(0, 8)
      .every((b, i) => b === [137, 80, 78, 71, 13, 10, 26, 10][i]) &&
    bytes.length >= 24
  ) {
    mime = "image/png";
    extension = "png";
  } else if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    mime = "image/webp";
    extension = "webp";
  }
  if (!mime || mime !== reportedType)
    throw new HttpError(400, "Usa una imagen JPEG, PNG o WebP válida.");
  return { mime, extension };
}
export async function prepareUpload(
  bytes: Uint8Array,
  kind: "image" | "font",
  reportedType: string,
) {
  const verified = verifyFile(bytes, kind, reportedType);
  if (kind === "font") return { ...verified, bytes };
  try {
    const normalized = await sharp(bytes, {
      limitInputPixels: 24000000,
      failOn: "warning",
    })
      .rotate()
      .webp({ quality: 90 })
      .toBuffer();
    if (normalized.length > 10 * 1024 * 1024) throw new Error("too large");
    return { mime: "image/webp", extension: "webp", bytes: normalized };
  } catch {
    throw new HttpError(
      400,
      "La imagen está dañada o supera el límite de 24 megapíxeles.",
    );
  }
}
