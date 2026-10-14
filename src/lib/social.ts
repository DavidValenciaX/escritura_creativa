import sharp from "sharp";
import { join } from "node:path";
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
  const heading = wrapCardText(title.replace(/\s+/g, " ").trim(), 42);
  const start = Math.max(290, 140 + heading.length * 36);
  const linesPerCard = Math.min(
    24,
    Math.max(1, Math.floor((1250 - start) / 39)),
  );
  const count = Math.max(1, Math.ceil(lines.length / linesPerCard));
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
  const fontfile = join(process.cwd(), "assets/fonts/Lora.ttf");
  const cards: Buffer[] = [];
  for (let page = 0; page < count; page++) {
    const entries = [
      ...heading.map((line, i) => ({ line, top: 72 + i * 36, size: 32 })),
      ...lines
        .slice(page * linesPerCard, (page + 1) * linesPerCard)
        .map((line, i) => ({ line, top: start + i * 39, size: 30 })),
      { line: `${page + 1} / ${count}`, top: 1280, size: 22 },
    ].filter(({ line }) => line.trim());
    // Pango loads the bundled font explicitly; generic SVG fonts depend on
    // fonts installed on the host, which may be absent in serverless runtimes.
    const layers = await Promise.all(
      entries.map(async ({ line, top, size }) => ({
        input: await sharp({
          text: {
            text: `<span foreground="${color}">${escaped(line)}</span>`,
            font: `Lora ${size}`,
            fontfile,
            dpi: 72,
            rgba: true,
          },
        })
          .resize({
            width: 936,
            height: size + 8,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer(),
        left: 72,
        top,
      })),
    );
    cards.push(
      await sharp({
        create: {
          width: 1080,
          height: 1350,
          channels: 3,
          background: "#f7f4ec",
        },
      })
        .composite(layers)
        .jpeg({ quality: 85 })
        .toBuffer(),
    );
  }
  return cards;
}
