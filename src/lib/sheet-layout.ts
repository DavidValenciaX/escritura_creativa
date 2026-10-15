// All presentations lay out at this width before scaling the complete sheet.
export const SHEET_WIDTH = 820;
export const SHEET_PADDING_X = 60;
export const SHEET_PADDING_Y = 55;
export function letterDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}
