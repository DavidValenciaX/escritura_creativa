import sharp from "sharp";
import { HttpError } from "./errors";
import type { ContentNode } from "./model";
export function publicationText(node: ContentNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const content = (node.content ?? []).map(publicationText).join("");
  return ["paragraph", "heading", "listItem", "blockquote"].includes(node.type)
    ? `${content}\n`
    : content;
}
export function wrapCardText(text: string, width = 42) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const chunks = Array.from(word);
      while (chunks.length > width) {
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(chunks.splice(0, width).join(""));
      }
      const part = chunks.join("");
      if (Array.from(line + " " + part).length > width && line) {
        lines.push(line);
        line = "";
      }
      line = line ? line + " " + part : part;
    }
    lines.push(line);
  }
  return lines;
}
export async function socialCards(
  title: string,
  text: string,
  ink = "#34312d",
) {
  const lines = wrapCardText(text);
  const count = Math.max(1, Math.ceil(lines.length / 24));
  if (count > 10)
    throw new HttpError(
      400,
      "El texto supera el máximo de diez tarjetas de esta exportación. Crea una versión más breve o comparte el enlace completo.",
    );
  const escaped = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    );
  const color = /^#[0-9a-f]{6}$/i.test(ink) ? ink : "#34312d";
  const cards: Buffer[] = [];
  for (let page = 0; page < count; page++) {
    const heading = wrapCardText(title, 42);
    const fitted = (line: string, size: number) =>
      Array.from(line).reduce(
        (sum, c) =>
          sum +
          (/[WMwm@]/.test(c)
            ? size
            : /[\u0020il.,'!]/.test(c)
              ? size * 0.3
              : c.charCodeAt(0) > 255
                ? size
                : size * 0.65),
        0,
      ) > 936
        ? 'textLength="936" lengthAdjust="spacingAndGlyphs"'
        : "";
    const start = Math.max(290, 140 + heading.length * 36);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#f7f4ec"/><g fill="${color}" font-family="serif">${heading.map((line, i) => `<text x="72" y="${90 + i * 36}" font-size="32" ${fitted(line, 32)}>${escaped(line)}</text>`).join("")}${lines
      .slice(page * 24, (page + 1) * 24)
      .map(
        (line, i) =>
          `<text x="72" y="${start + i * 39}" font-size="30" ${fitted(line, 30)}>${escaped(line)}</text>`,
      )
      .join(
        "",
      )}<text x="72" y="1300" font-size="22">${page + 1} / ${count}</text></g></svg>`;
    cards.push(await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer());
  }
  return cards;
}
