import type { ContentNode } from "./model";
export function publicationText(node: ContentNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const content = (node.content ?? []).map(publicationText).join("");
  return ["paragraph", "heading", "listItem", "blockquote"].includes(node.type)
    ? `${content}\n`
    : content;
}
