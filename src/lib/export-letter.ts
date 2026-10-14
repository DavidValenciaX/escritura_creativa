import { cardSlices, type TextBand } from "./social-layout";
export async function exportLetter(letter: HTMLElement) {
  const { toCanvas, getFontEmbedCSS } = await import("html-to-image");
  const fontElements = letter.querySelectorAll<HTMLElement>(
    ".letter-title,.letter-content,.letter-signature",
  );
  try {
    await Promise.all(
      Array.from(fontElements, (element) => {
        const style = getComputedStyle(element);
        return document.fonts.load(
          `${style.fontSize} ${style.fontFamily}`,
          element.textContent ?? "",
        );
      }),
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
  const scale = 1080 / bounds.width;
  const pageHeight = Math.floor(1350 / scale);
  const bands: TextBand[] = [];
  const walker = document.createTreeWalker(letter, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(walker.currentNode);
    for (const rect of range.getClientRects())
      bands.push({
        top: rect.top - bounds.top,
        bottom: rect.bottom - bounds.top,
      });
  }
  for (const image of letter.querySelectorAll("figure")) {
    const rect = image.getBoundingClientRect();
    bands.push({
      top: rect.top - bounds.top,
      bottom: rect.bottom - bounds.top,
    });
  }
  const slices = cardSlices(Math.ceil(bounds.height), pageHeight, bands);
  const options = {
    pixelRatio: scale,
    preferredFontFormat: "woff2",
    fetchRequestInit: { credentials: "same-origin" as const },
  };
  const fontEmbedCSS = await getFontEmbedCSS(letter, options);
  const full = await toCanvas(letter, { ...options, fontEmbedCSS });
  // Render the same paper without content to fill the unused part of each card.
  const paper = letter.cloneNode(false) as HTMLElement;
  paper.style.height = `${pageHeight}px`;
  paper.style.minHeight = `${pageHeight}px`;
  letter.parentElement!.appendChild(paper);
  let background: HTMLCanvasElement;
  try {
    background = await toCanvas(paper, { ...options, fontEmbedCSS });
  } finally {
    paper.remove();
  }
  return slices.map((slice) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no permite generar imágenes.");
    context.drawImage(background, 0, 0, 1080, 1350);
    const y = Math.round(slice.top * scale);
    const height = Math.min(
      full.height - y,
      Math.round((slice.top + slice.height) * scale) - y,
    );
    context.drawImage(full, 0, y, full.width, height, 0, 0, 1080, height);
    return canvas.toDataURL("image/jpeg", 0.92);
  });
}
