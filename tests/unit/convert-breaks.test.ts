import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { history, redo, undo } from "@tiptap/pm/history";
import { convertSelectedBreaks } from "../../src/lib/convert-breaks";

const schema = getSchema([
  StarterKit,
  TextAlign.configure({ types: ["paragraph", "heading"] }),
]);
const text = (value: string) => schema.text(value);
const br = () => schema.nodes.hardBreak.create();
const p = (...children: ReturnType<typeof text>[]) =>
  schema.nodes.paragraph.create(null, children);
const doc = (...children: ReturnType<typeof p>[]) =>
  schema.nodes.doc.create(null, children);

function stateFor(
  content: ReturnType<typeof doc>,
  from = 1,
  to = content.content.size - 1,
) {
  return EditorState.create({
    schema,
    doc: content,
    selection: TextSelection.create(content, from, to),
    plugins: [history()],
  });
}

function convert(state: EditorState, target: "soft" | "paragraph") {
  let next = state;
  const changed = convertSelectedBreaks(target)(state, (tr) => {
    next = state.apply(tr);
  });
  return { state: next, changed };
}

describe("converting existing line and paragraph breaks", () => {
  it("joins selected paragraphs, retains blank lines and preserves inline marks", () => {
    const marked = schema.text("Uno", [schema.marks.bold.create()]);
    const original = doc(p(marked), p(), p(text("Tres")));
    const result = convert(stateFor(original), "soft");
    expect(result.changed).toBe(true);
    expect(result.state.doc.toJSON()).toEqual(
      doc(p(marked, br(), br(), text("Tres"))).toJSON(),
    );
    expect(result.state.selection.empty).toBe(false);
  });

  it("changes only paragraph boundaries fully inside the selection", () => {
    const original = doc(p(text("A")), p(text("B")), p(text("C")));
    const result = convert(stateFor(original, 4, 8), "soft");
    expect(result.state.doc.toJSON()).toEqual(
      doc(p(text("A")), p(text("B"), br(), text("C"))).toJSON(),
    );
  });

  it("splits only selected soft breaks and retains paragraph alignment and marks", () => {
    const marked = schema.text("B", [schema.marks.italic.create()]);
    const original = doc(
      schema.nodes.paragraph.create({ textAlign: "center" }, [
        text("A"),
        br(),
        marked,
        br(),
        text("C"),
      ]),
    );
    const result = convert(stateFor(original, 2, 3), "paragraph");
    expect(result.state.doc.childCount).toBe(2);
    expect(result.state.doc.child(0).attrs.textAlign).toBe("center");
    expect(result.state.doc.child(1).attrs.textAlign).toBe("center");
    expect(result.state.doc.child(1).content.toJSON()).toEqual(
      p(marked, br(), text("C")).content.toJSON(),
    );
  });

  it("round trips consecutive soft breaks including an empty line", () => {
    const original = doc(p(text("A"), br(), br(), text("B")));
    const paragraphs = convert(stateFor(original), "paragraph").state;
    expect(paragraphs.doc.childCount).toBe(3);
    expect(paragraphs.doc.child(1).content.size).toBe(0);
    expect(convert(paragraphs, "soft").state.doc.toJSON()).toEqual(
      original.toJSON(),
    );
  });

  it.each([2, 4])(
    "converts a paragraph boundary beside the caret at %s",
    (pos) => {
      const result = convert(
        stateFor(doc(p(text("A")), p(text("B"))), pos, pos),
        "soft",
      );
      expect(result.changed).toBe(true);
      expect(result.state.doc.toJSON()).toEqual(
        doc(p(text("A"), br(), text("B"))).toJSON(),
      );
    },
  );

  it.each([2, 3])("converts a soft break beside the caret at %s", (pos) => {
    const result = convert(
      stateFor(doc(p(text("A"), br(), text("B"))), pos, pos),
      "paragraph",
    );
    expect(result.changed).toBe(true);
    expect(result.state.doc.toJSON()).toEqual(
      doc(p(text("A")), p(text("B"))).toJSON(),
    );
  });

  it("keeps quote and list containers and never merges separate list items", () => {
    const quote = schema.nodes.blockquote.create(null, [
      p(text("A")),
      p(text("B")),
    ]);
    const list = schema.nodes.bulletList.create(null, [
      schema.nodes.listItem.create(null, p(text("C"))),
      schema.nodes.listItem.create(null, p(text("D"))),
    ]);
    const result = convert(stateFor(doc(quote, list)), "soft");
    expect(result.state.doc.child(0).toJSON()).toEqual(
      schema.nodes.blockquote
        .create(null, p(text("A"), br(), text("B")))
        .toJSON(),
    );
    expect(result.state.doc.child(1).toJSON()).toEqual(list.toJSON());
  });

  it("changes only one break when the caret is between two soft breaks", () => {
    const original = doc(p(text("A"), br(), br(), text("B")));
    const result = convert(stateFor(original, 3, 3), "paragraph");
    expect(result.state.doc.toJSON()).toEqual(
      doc(p(text("A")), p(br(), text("B"))).toJSON(),
    );
  });

  it("changes only the preceding boundary at an empty paragraph", () => {
    const original = doc(p(text("A")), p(), p(text("B")));
    const result = convert(stateFor(original, 4, 4), "soft");
    expect(result.state.doc.toJSON()).toEqual(
      doc(p(text("A"), br()), p(text("B"))).toJSON(),
    );
  });

  it("leaves headings and intervening blocks unchanged", () => {
    const heading = schema.nodes.heading.create({ level: 2 }, [
      text("A"),
      br(),
      text("B"),
    ]);
    const original = doc(
      heading,
      p(text("C")),
      schema.nodes.horizontalRule.create(),
      p(text("D")),
    );
    const state = stateFor(original);
    expect(convert(state, "soft").changed).toBe(false);
    expect(convert(state, "paragraph").changed).toBe(false);
    const nodeState = state.apply(
      state.tr.setSelection(
        NodeSelection.create(original, heading.nodeSize + 3),
      ),
    );
    expect(convert(nodeState, "soft").changed).toBe(false);
  });

  it("disables conversions for a selection containing no convertible break", () => {
    const state = stateFor(doc(p(text("Palabra")), p(text("Otra"))), 1, 4);
    expect(convertSelectedBreaks("soft")(state)).toBe(false);
    expect(convertSelectedBreaks("paragraph")(state)).toBe(false);
    expect(convert(state, "soft").state).toBe(state);
  });

  it("undoes and redoes a multi-break conversion in one step", () => {
    const original = doc(p(text("A")), p(text("B")), p(text("C")));
    let state = convert(stateFor(original), "soft").state;
    const converted = state.doc;
    expect(
      undo(state, (tr) => {
        state = state.apply(tr);
      }),
    ).toBe(true);
    expect(state.doc.toJSON()).toEqual(original.toJSON());
    expect(
      redo(state, (tr) => {
        state = state.apply(tr);
      }),
    ).toBe(true);
    expect(state.doc.toJSON()).toEqual(converted.toJSON());
  });
});
