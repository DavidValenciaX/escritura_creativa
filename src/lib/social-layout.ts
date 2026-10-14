export type TextBand = { top: number; bottom: number };
export function cardSlices(
  height: number,
  pageHeight: number,
  bands: TextBand[],
  margin = 0,
) {
  const slices: { top: number; height: number; inset: number }[] = [];
  let top = 0;
  while (top < height) {
    const inset = slices.length ? margin : 0;
    let end = Math.min(top + pageHeight - margin - inset, height);
    while (true) {
      const crossing = bands.filter((b) => b.top < end && b.bottom > end);
      if (!crossing.length) break;
      end = Math.floor(Math.min(...crossing.map((b) => b.top)) - 3);
      if (end <= top)
        throw new Error(
          "Un elemento es demasiado alto para una tarjeta. Reduce el tamaño de la imagen o comparte el enlace.",
        );
    }
    slices.push({ top, height: end - top, inset });
    if (slices.length > 10)
      throw new Error(
        "El escrito supera el máximo de diez tarjetas. Comparte el enlace completo o crea una versión más breve.",
      );
    top = end;
  }
  return slices;
}
