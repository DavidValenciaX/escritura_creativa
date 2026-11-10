import { AllSelection, TextSelection, type Command } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";

// A paragraph boundary occupies two document positions; a hardBreak occupies one.
// Work backwards so that each pending position still refers to the original doc.
export function convertSelectedBreaks(target: "soft" | "paragraph"): Command {
  return (state, dispatch) => {
    const { selection, schema, doc } = state;
    if (
      !(
        selection instanceof TextSelection || selection instanceof AllSelection
      ) ||
      !schema.nodes.hardBreak
    )
      return false;

    const positions: number[] = [];
    const includes = (from: number, to: number) =>
      selection.empty
        ? selection.from === from || selection.from === to
        : selection.from <= from && selection.to >= to;

    doc.descendants((node, pos, parent, index) => {
      if (
        target === "paragraph" &&
        node.type.name === "hardBreak" &&
        parent?.type.name === "paragraph" &&
        includes(pos, pos + node.nodeSize)
      )
        positions.push(pos);

      if (
        target === "soft" &&
        node.type.name === "paragraph" &&
        parent?.maybeChild(index + 1)?.type.name === "paragraph"
      ) {
        const end = pos + node.nodeSize - 1;
        if (includes(end, end + 2)) positions.push(end);
      }
    });

    if (!positions.length) return false;
    // Between consecutive breaks, prefer the one immediately before the caret.
    if (selection.empty && positions.length > 1) {
      const width = target === "soft" ? 2 : 1;
      const previous = positions.find((pos) => pos + width === selection.from);
      positions.splice(0, positions.length, previous ?? positions[0]);
    }
    if (!dispatch) return true;
    const tr = state.tr;
    for (const pos of positions.sort((a, b) => b - a)) {
      if (target === "soft") {
        tr.join(pos + 1);
        tr.insert(pos, schema.nodes.hardBreak.create());
      } else {
        tr.delete(pos, pos + 1);
        tr.split(pos);
      }
    }
    dispatch(closeHistory(tr).scrollIntoView());
    return true;
  };
}
