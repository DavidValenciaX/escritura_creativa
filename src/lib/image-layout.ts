import { z } from "zod";
import type { ContentNode } from "./model";

// Coordinates and width use hundredths of the sheet's content width (CSS cqw).
// They remain proportional when a letter is viewed on a different screen.
export const imageLayoutSchema = z.object({
  x: z.number().finite().min(0).max(300),
  y: z.number().finite().min(0).max(10000),
  width: z.number().finite().min(4).max(100),
  rotation: z.number().finite().min(-180).max(180),
  ratio: z.number().finite().min(0.01).max(100),
});
export type ImageLayout = z.infer<typeof imageLayoutSchema>;
export const newImageLayout: ImageLayout = {
  x: 10,
  y: 32,
  width: 40,
  rotation: 0,
  ratio: 1,
};
export function readImageLayout(value: unknown): ImageLayout | null {
  const parsed = imageLayoutSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function imageStyle(layout: ImageLayout) {
  return {
    left: `${layout.x}cqw`,
    top: `${layout.y}cqw`,
    width: `${layout.width}cqw`,
    aspectRatio: String(layout.ratio),
    transform: `rotate(${layout.rotation}deg)`,
  };
}
export function rotatedSize(layout: ImageLayout) {
  const radians = (layout.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: layout.width * (cos + sin / layout.ratio),
    height: layout.width * (sin + cos / layout.ratio),
  };
}
export function fitImage(
  layout: ImageLayout,
  width: number,
  height: number,
): ImageLayout {
  const bounds = rotatedSize(layout);
  const scale = Math.min(1, width / bounds.width, height / bounds.height);
  const fitted = { ...layout, width: Math.max(4, layout.width * scale) };
  const size = rotatedSize(fitted);
  const dx = (size.width - fitted.width) / 2;
  const dy = (size.height - fitted.width / fitted.ratio) / 2;
  return {
    ...fitted,
    x: Math.max(Math.max(0, dx), Math.min(width - fitted.width - dx, fitted.x)),
    y: Math.max(
      Math.max(0, dy),
      Math.min(height - fitted.width / fitted.ratio - dy, fitted.y),
    ),
  };
}
export function imageBottom(node: ContentNode): number {
  const layout =
    node.type === "image" ? readImageLayout(node.attrs?.layout) : null;
  const bottom = layout
    ? layout.y +
      layout.width / layout.ratio / 2 +
      rotatedSize(layout).height / 2
    : 0;
  return Math.max(bottom, ...(node.content?.map(imageBottom) ?? []));
}
