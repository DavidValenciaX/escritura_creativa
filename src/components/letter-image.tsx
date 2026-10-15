"use client";
import { useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { closeHistory } from "@tiptap/pm/history";
import { RotateCw, Trash2 } from "lucide-react";
import {
  fitImage,
  imageStyle,
  readImageLayout,
  type ImageLayout,
} from "@/lib/image-layout";

type Gesture = {
  id: number;
  mode: "move" | "resize" | "rotate";
  start: ImageLayout;
  next: ImageLayout;
  x: number;
  y: number;
  unit: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  angle: number;
  moved: boolean;
};
const angle = (x: number, y: number) => (Math.atan2(y, x) * 180) / Math.PI;
const normalize = (degrees: number) => ((degrees + 540) % 360) - 180;

function LetterImageView({
  node,
  editor,
  getPos,
  selected,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [transient, setTransient] = useState<ImageLayout | null>(null);
  const layout = transient ?? readImageLayout(node.attrs.layout);

  function geometry() {
    const element = root.current!;
    const paper = element.closest<HTMLElement>(".editor-page")!;
    const style = getComputedStyle(paper);
    const unit =
      (paper.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight)) /
      100;
    const image = element.querySelector("img")!;
    const rect = image.getBoundingClientRect();
    const page = paper.getBoundingClientRect();
    const start = layout ?? {
      x: (rect.left - page.left - paper.clientLeft) / unit,
      y: (rect.top - page.top - paper.clientTop) / unit,
      width: Math.min(100, image.offsetWidth / unit),
      rotation: 0,
      ratio: image.naturalWidth / image.naturalHeight || 1,
    };
    return {
      start,
      unit,
      width: paper.clientWidth / unit,
      height: paper.clientHeight / unit,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    };
  }
  function commit(value: ImageLayout) {
    if (!editor.isEditable || typeof getPos() !== "number") return;
    editor.view.dispatch(closeHistory(editor.state.tr));
    updateAttributes({ layout: value });
    editor.view.dispatch(closeHistory(editor.state.tr));
  }
  function start(event: PointerEvent, mode: Gesture["mode"]) {
    if (!editor.isEditable || event.button !== 0 || gesture.current) return;
    event.preventDefault();
    event.stopPropagation();
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.commands.setNodeSelection(pos);
    const info = geometry();
    gesture.current = {
      ...info,
      id: event.pointerId,
      mode,
      next: info.start,
      x: event.clientX,
      y: event.clientY,
      angle: angle(event.clientX - info.cx, event.clientY - info.cy),
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    const g = gesture.current;
    if (!g || event.pointerId !== g.id) return;
    const dx = (event.clientX - g.x) / g.unit;
    const dy = (event.clientY - g.y) / g.unit;
    if (!g.moved && Math.hypot(event.clientX - g.x, event.clientY - g.y) < 3)
      return;
    g.moved = true;
    let next = { ...g.start };
    if (g.mode === "move") {
      next.x += dx;
      next.y += dy;
    } else if (g.mode === "resize") {
      // Project the pointer onto the rotated diagonal, preserving proportions.
      const radians = (g.start.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(radians) + dy * Math.sin(radians);
      const localY = -dx * Math.sin(radians) + dy * Math.cos(radians);
      const delta = (localX + localY / next.ratio) / (1 + 1 / next.ratio ** 2);
      next.width = Math.max(4, Math.min(100, next.width + delta));
      // Keep the opposite corner fixed even when the image is rotated.
      const dw = next.width - g.start.width;
      const dh = dw / next.ratio;
      next.x += (dw * Math.cos(radians) - dh * Math.sin(radians) - dw) / 2;
      next.y += (dw * Math.sin(radians) + dh * Math.cos(radians) - dh) / 2;
    } else {
      next.rotation = normalize(
        g.start.rotation +
          angle(event.clientX - g.cx, event.clientY - g.cy) -
          g.angle,
      );
      if (event.shiftKey) next.rotation = Math.round(next.rotation / 15) * 15;
    }
    g.next = fitImage(next, g.width, g.height);
    setTransient(g.next);
  }
  function finish(event: PointerEvent, cancel = false) {
    const g = gesture.current;
    if (!g || event.pointerId !== g.id) return;
    gesture.current = null;
    if (!cancel && g.moved) commit(g.next);
    setTransient(null);
  }
  function key(event: KeyboardEvent, mode: Gesture["mode"]) {
    if (!editor.isEditable) return;
    if (event.key === "Escape") {
      gesture.current = null;
      setTransient(null);
      return;
    }
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const info = geometry();
    const next = { ...info.start };
    const direction = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    const step = event.shiftKey ? 5 : 1;
    if (mode === "rotate")
      next.rotation = normalize(next.rotation + direction * step);
    else if (mode === "resize")
      next.width = Math.max(4, Math.min(100, next.width + direction * step));
    else if (["ArrowLeft", "ArrowRight"].includes(event.key))
      next.x += direction * step;
    else next.y += direction * step;
    commit(fitImage(next, info.width, info.height));
  }
  const controls = selected && editor.isEditable;
  return (
    <NodeViewWrapper
      ref={root}
      contentEditable={false}
      className={`editable-image ${layout ? "floating-image" : "inline-image"} ${controls ? "image-selected" : ""}`}
      style={layout ? imageStyle(layout) : undefined}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={(event: PointerEvent) => finish(event, true)}
      onLostPointerCapture={(event: PointerEvent) => finish(event, true)}
    >
      <div
        className="image-move-target"
        role="button"
        tabIndex={editor.isEditable ? 0 : -1}
        aria-label={`Mover imagen: ${node.attrs.alt || "Sin descripción"}`}
        onPointerDown={(event) => start(event, "move")}
        onKeyDown={(event) => key(event, "move")}
        onFocus={() => {
          const pos = getPos();
          if (editor.isEditable && typeof pos === "number")
            editor.commands.setNodeSelection(pos);
        }}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt ?? ""}
          draggable={false}
          onLoad={(event) => {
            const saved = readImageLayout(node.attrs.layout);
            const image = event.currentTarget;
            const ratio = image.naturalWidth / image.naturalHeight;
            if (
              saved &&
              Number.isFinite(ratio) &&
              ratio >= 0.01 &&
              ratio <= 100 &&
              Math.abs(saved.ratio - ratio) > 0.001
            ) {
              const info = geometry();
              updateAttributes({
                layout: fitImage({ ...saved, ratio }, info.width, info.height),
              });
            }
          }}
        />
      </div>
      {controls && (
        <>
          <button
            type="button"
            className="image-rotate-handle image-control"
            aria-label="Girar imagen"
            title="Arrastra para girar. Mayús: pasos de 15°. Flechas: giro preciso."
            onPointerDown={(event) => start(event, "rotate")}
            onKeyDown={(event) => key(event, "rotate")}
          >
            <RotateCw size={16} />
          </button>
          <button
            type="button"
            className="image-resize-handle image-control"
            aria-label="Cambiar tamaño de imagen"
            title="Arrastra para escalar o usa las flechas"
            onPointerDown={(event) => start(event, "resize")}
            onKeyDown={(event) => key(event, "resize")}
          />
          <button
            type="button"
            className="image-delete image-control"
            aria-label="Eliminar imagen"
            onClick={deleteNode}
          >
            <Trash2 size={15} />
          </button>
        </>
      )}
    </NodeViewWrapper>
  );
}

export const LetterImage = Image.extend({
  draggable: false,
  addAttributes() {
    return {
      ...this.parent?.(),
      assetId: { default: null },
      resourceId: { default: null },
      layout: { default: null, rendered: false },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(LetterImageView);
  },
});
