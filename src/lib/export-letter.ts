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
  const scale = 2160 / bounds.width;
  const pageHeight = 2700 / scale;
  const margin = 55;
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
  const contentHeight = Math.ceil(Math.max(0, ...bands.map((b) => b.bottom)));
  const protectedBands = bands.map((b) => ({
    top: Math.max(0, b.top - 3),
    bottom: b.bottom + 3,
  }));
  const slices = cardSlices(
    contentHeight + 3,
    pageHeight,
    protectedBands,
    margin,
  );
  const options = {
    pixelRatio: scale,
    preferredFontFormat: "woff2",
    fetchRequestInit: { credentials: "same-origin" as const },
  };
  const fontEmbedCSS = await getFontEmbedCSS(letter, options);
  const images: string[] = [];
  // Capture one page at a time so high resolution does not require a huge
  // full-document canvas, especially on mobile browsers.
  for (const slice of slices) {
    const page = letter.cloneNode(false) as HTMLElement;
    Object.assign(page.style, {
      height: `${pageHeight}px`,
      minHeight: `${pageHeight}px`,
      padding: "0",
      position: "relative",
      overflow: "hidden",
      border: "none",
    });
    const clip = document.createElement("div");
    Object.assign(clip.style, {
      position: "absolute",
      left: "0",
      top: `${slice.inset}px`,
      width: `${bounds.width}px`,
      height: `${slice.height}px`,
      overflow: "hidden",
    });
    const copy = letter.cloneNode(true) as HTMLElement;
    Object.assign(copy.style, {
      height: `${bounds.height}px`,
      minHeight: `${bounds.height}px`,
      transform: `translateY(-${slice.top}px)`,
    });
    clip.appendChild(copy);
    page.appendChild(clip);
    letter.parentElement!.appendChild(page);
    try {
      const canvas = await toCanvas(page, { ...options, fontEmbedCSS });
      images.push(canvas.toDataURL("image/png"));
    } finally {
      page.remove();
    }
  }
  return images;
}
