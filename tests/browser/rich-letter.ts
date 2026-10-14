import { defaultAppearance, type ContentNode } from "../../src/lib/model";
const paragraph = (text: string): ContentNode => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const sentence =
  "Un escrito puede combinar enlaces, palabras destacadas y varias líneas. Cada palabra debe conservarse completa al pasar a la imagen siguiente. ";
export const richLetter = {
  document_id: "11111111-1111-4111-8111-111111111111",
  owner_id: "owner",
  title: "Prueba de párrafos y listas",
  written_on: "2026-10-14",
  signature: "Firma completa",
  appearance: { ...defaultAppearance, paper: "cream", fontSize: 20 },
  is_public: false,
  published_at: "2026-10-14",
  updated_at: "2026-10-14",
  notebook_id: null,
  content: {
    type: "doc",
    content: [
      ...Array.from({ length: 3 }, () => ({
        type: "paragraph",
        content: [
          { type: "text", text: "Una imagen ", marks: [{ type: "bold" }] },
          {
            type: "text",
            text: "puede incluir enlaces",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
          {
            type: "text",
            text: " y palabras en cursiva. ",
            marks: [{ type: "italic" }],
          },
          { type: "text", text: sentence.repeat(7) },
        ],
      })),
      {
        type: "bulletList",
        content: Array.from({ length: 3 }, (_, i) => ({
          type: "listItem",
          content: [paragraph(`Elemento ${i + 1}. ${sentence}`)],
        })),
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Lista numerada" }],
      },
      {
        type: "orderedList",
        content: Array.from({ length: 8 }, (_, i) => ({
          type: "listItem",
          content: [
            paragraph(
              `Número ${i + 1}. Esta entrada no debe perder su numeración ni quedar cortada al cambiar de página.`,
            ),
          ],
        })),
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: sentence.repeat(6) },
          { type: "text", text: sentence.repeat(8), marks: [{ type: "bold" }] },
          {
            type: "text",
            text: sentence.repeat(4),
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
        ],
      },
      {
        type: "blockquote",
        content: [paragraph("Una cita completa después del párrafo extenso.")],
      },
    ],
  } as ContentNode,
};
