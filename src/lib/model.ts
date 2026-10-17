import { z } from "zod";
import { imageLayoutSchema } from "./image-layout";
export const papers = [
  { key: "cream", name: "Marfil", note: "Fondo marfil con textura suave" },
  { key: "cotton", name: "Algodón", note: "Textura de papel de algodón" },
  { key: "lined", name: "Cuaderno", note: "Papel con líneas horizontales" },
  {
    key: "vintage",
    name: "Papel antiguo",
    note: "Textura de papel envejecido",
  },
  { key: "rose", name: "Rosa suave", note: "Fondo rosa claro" },
  {
    key: "botanical",
    name: "Botánico",
    note: "Fondo verde con detalles botánicos",
  },
  { key: "grid", name: "Cuadrícula", note: "Papel con cuadrícula" },
  { key: "white", name: "Editorial", note: "Fondo blanco liso" },
];
export const fonts = [
  { key: "caveat", name: "Caveat", family: "Caveat", kind: "Manuscrita" },
  {
    key: "dancing",
    name: "Dancing Script",
    family: "Dancing Script",
    kind: "Manuscrita",
  },
  { key: "kalam", name: "Kalam", family: "Kalam", kind: "Manuscrita" },
  {
    key: "patrick",
    name: "Patrick Hand",
    family: "Patrick Hand",
    kind: "Manuscrita",
  },
  {
    key: "courier",
    name: "Courier Prime",
    family: "Courier Prime",
    kind: "Máquina",
  },
  {
    key: "elite",
    name: "Special Elite",
    family: "Special Elite",
    kind: "Máquina",
  },
  { key: "lora", name: "Lora", family: "Lora", kind: "Lectura" },
  {
    key: "garamond",
    name: "EB Garamond",
    family: "EB Garamond",
    kind: "Lectura",
  },
];
export const defaultAppearance = {
  paper: "cream",
  titleFont: "caveat",
  bodyFont: "lora",
  fontSize: 18,
  lineHeight: 1.8,
  ink: "#34312d",
};
export const emptyContent: ContentNode = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
export type ContentNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: ContentNode[];
};
const paperKey = z
  .string()
  .refine(
    (v) => papers.some((p) => p.key === v) || z.uuid().safeParse(v).success,
    "Papel inválido",
  );
const fontKey = z
  .string()
  .refine(
    (v) => fonts.some((f) => f.key === v) || z.uuid().safeParse(v).success,
    "Fuente inválida",
  );
export const appearanceSchema = z.object({
  paper: paperKey,
  titleFont: fontKey,
  bodyFont: fontKey,
  fontSize: z.number().min(12).max(32),
  lineHeight: z.number().min(1.2).max(2.5),
  ink: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
const allowedTypes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "hardBreak",
  "horizontalRule",
  "image",
]);
const allowedMarks = new Set([
  "bold",
  "italic",
  "strike",
  "code",
  "underline",
  "link",
]);
export function validateContent(value: unknown): value is ContentNode {
  let count = 0;
  function visit(node: unknown, depth: number): boolean {
    if (++count > 10000 || depth > 20 || !node || typeof node !== "object")
      return false;
    const n = node as ContentNode;
    if (
      !allowedTypes.has(n.type) ||
      (n.text !== undefined && typeof n.text !== "string")
    )
      return false;
    if (n.type === "text" && typeof n.text !== "string") return false;
    if (
      n.marks &&
      (!Array.isArray(n.marks) ||
        !n.marks.every(
          (m) =>
            !!m &&
            typeof m === "object" &&
            allowedMarks.has(m.type) &&
            (m.type !== "link" ||
              (typeof m.attrs?.href === "string" &&
                /^https?:\/\//i.test(m.attrs.href))),
        ))
    )
      return false;
    if (
      n.type === "image" &&
      !z.uuid().safeParse(n.attrs?.assetId).success &&
      !z.uuid().safeParse(n.attrs?.resourceId).success
    )
      return false;
    if (
      n.type === "image" &&
      n.attrs?.layout != null &&
      !imageLayoutSchema.safeParse(n.attrs.layout).success
    )
      return false;
    if (
      n.attrs?.textAlign &&
      !["left", "center", "right", "justify"].includes(
        String(n.attrs.textAlign),
      )
    )
      return false;
    if (n.type === "heading" && ![1, 2, 3].includes(Number(n.attrs?.level)))
      return false;
    return (
      !n.content ||
      (Array.isArray(n.content) &&
        n.content.every((child) => visit(child, depth + 1)))
    );
  }
  return (
    !!value &&
    typeof value === "object" &&
    (value as ContentNode).type === "doc" &&
    JSON.stringify(value).length <= 500000 &&
    visit(value, 0)
  );
}
export const draftSchema = z.object({
  title: z.string().min(1).max(200),
  written_on: z.iso.date(),
  content: z.custom<ContentNode>(validateContent, "Contenido inválido"),
  appearance: appearanceSchema,
  // Retained for compatibility with existing database records and old clients.
  signature: z.string().max(500).default(""),
  notebook_id: z.uuid().nullable(),
  position: z.number().int().min(0).max(100000),
});
export type Appearance = z.infer<typeof appearanceSchema>;
// A recovery can contain temporarily empty fields while the author is typing.
export const recoverySchema = draftSchema.extend({
  title: z.string().max(200),
  written_on: z.union([z.literal(""), z.iso.date()]),
});
export type Draft = z.infer<typeof draftSchema>;
export function contentWithLegacySignature(
  content: ContentNode,
  signature = "",
): ContentNode {
  if (!signature) return content;
  return {
    ...content,
    content: [
      ...(content.content ?? []),
      ...signature.split(/\r?\n/).map((line): ContentNode => ({
        type: "paragraph",
        ...(line ? { content: [{ type: "text", text: line }] } : {}),
      })),
    ],
  };
}
export function withoutSignature<
  T extends Pick<Draft, "content" | "signature">,
>(writing: T): T {
  return {
    ...writing,
    content: contentWithLegacySignature(writing.content, writing.signature),
    signature: "",
  };
}
export type Document = Draft & {
  id: string;
  owner_id: string;
  revision: number;
  updated_at: string;
  created_at: string;
};
export type Publication = Omit<Draft, "notebook_id" | "position"> & {
  document_id: string;
  owner_id: string;
  is_public: boolean;
  published_at: string;
  updated_at: string;
};
export type Notebook = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
};
export type Resource = {
  id: string;
  owner_id?: string | null;
  kind: "paper" | "font" | "image";
  name: string;
  author: string;
  source: string;
  license: string;
  description: string;
  tags: string[];
  builtin_key: string | null;
  hidden: boolean;
};
export function textContent(node: ContentNode): string {
  return node.text ?? node.content?.map(textContent).join(" ") ?? "";
}
export function imageIds(
  node: ContentNode,
  key: "assetId" | "resourceId",
): string[] {
  return [
    ...new Set([
      ...(node.type === "image" && typeof node.attrs?.[key] === "string"
        ? [node.attrs[key] as string]
        : []),
      ...(node.content?.flatMap((n) => imageIds(n, key)) ?? []),
    ]),
  ];
}
export function referencesResource(
  pick: Pick<Draft, "content" | "appearance">,
  id: string,
) {
  return (
    Object.values(pick.appearance).includes(id) ||
    imageIds(pick.content, "resourceId").includes(id)
  );
}
export function family(key: string) {
  return fonts.find((f) => f.key === key)?.family ?? `resource-${key}`;
}
