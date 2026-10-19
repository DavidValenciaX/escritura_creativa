import { paginateLetter } from "./paginate-letter";
export async function exportLetter(letter: HTMLElement) {
  const { toCanvas, getFontEmbedCSS } = await import("html-to-image");
  // Offscreen exports also need bold/italic faces ready before measuring.
  // Waiting only for the container's normal font can change the line wrapping.
  const fonts = new Map<string, string>();
  const walker = document.createTreeWalker(letter, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent ?? "";
    const element = walker.currentNode.parentElement;
    if (!element || !text.trim()) continue;
    const style = getComputedStyle(element);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    fonts.set(font, (fonts.get(font) ?? "") + text);
  }
  try {
    await Promise.all(
      Array.from(fonts, ([font, text]) => document.fonts.load(font, text)),
    );
  } catch {
    throw new Error(
      "No se pudieron cargar las fuentes del escrito. Comprueba tu conexión e inténtalo de nuevo.",
    );
  }
  await document.fonts.ready;
  const paperImage = /url\(["']?(.*?)["']?\)/.exec(
    getComputedStyle(letter).backgroundImage,
  );
  if (paperImage) {
    const image = new Image();
    image.src = paperImage[1];
    try {
      await image.decode();
    } catch {
      throw new Error("No se pudo cargar el papel del escrito.");
    }
  }
  for (const image of letter.querySelectorAll("img")) {
    try {
      await image.decode();
    } catch {
      throw new Error("No se pudo cargar una imagen del escrito.");
    }
    if (!image.naturalWidth)
      throw new Error("No se pudo cargar una imagen del escrito.");
  }
  const bounds = letter.getBoundingClientRect();
  const scale = 2160 / bounds.width;
  const pageHeight = bounds.width;
  const margin = 55;
  const options = {
    pixelRatio: scale,
    fetchRequestInit: { credentials: "same-origin" as const },
    // Preserve exact fonts and automatic flow sizes. Copying resolved heights
    // changes margin collapse in paragraphs/list items inside the exported SVG.
    includeStyleProperties: Array.from(
      getComputedStyle(document.documentElement),
    ).filter(
      (property) => !["font-size", "height", "block-size"].includes(property),
    ),
  };
  // Do not set preferredFontFormat: its shared regex state can omit a font
  // when this library embeds multiple families, changing their line widths.
  const fontEmbedCSS = await getFontEmbedCSS(letter, options);
  const images: string[] = [];
  const pages = paginateLetter(letter, pageHeight, margin);
  try {
    for (const page of pages) {
      for (const element of [
        page,
        ...page.querySelectorAll<HTMLElement>("*"),
      ]) {
        element.style.setProperty(
          "font-size",
          getComputedStyle(element).fontSize,
          "important",
        );
      }
      const canvas = await toCanvas(page, { ...options, fontEmbedCSS });
      images.push(canvas.toDataURL("image/png"));
    }
  } finally {
    pages.forEach((page) => page.remove());
  }
  return images;
}
