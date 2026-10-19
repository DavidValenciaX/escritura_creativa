"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import {
  MoreHorizontal,
  Bold,
  Italic,
  Underline,
  Heading2,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Undo2,
  Redo2,
  ImagePlus,
  Palette,
  Type,
  Info,
  Eye,
  PenLine,
  Printer,
  Share2,
  ArrowLeft,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Modal } from "./ui";
import { appDialog } from "@/lib/dialog";

type Panel = "Opciones del editor" | "Formato" | "Apariencia" | "Detalles";

export function EditorTools({
  editor,
  preview,
  blocked,
  localMode,
  shareDisabled,
  soundEnabled,
  onToggleSound,
  appearance,
  details,
  onPreview,
  onImage,
  onPrint,
  onShare,
  onBack,
}: {
  editor: Editor | null;
  preview: boolean;
  blocked: boolean;
  localMode: boolean;
  shareDisabled: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  appearance: ReactNode;
  details: ReactNode;
  onPreview: () => void;
  onImage: () => void;
  onPrint: () => void;
  onShare: () => void;
  onBack: () => void;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  // Subscribe to selection and stored marks, including changes without typing.
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            from: editor.state.selection.from,
            to: editor.state.selection.to,
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            underline: editor.isActive("underline"),
            heading: editor.isActive("heading", { level: 2 }),
            bullet: editor.isActive("bulletList"),
            ordered: editor.isActive("orderedList"),
            quote: editor.isActive("blockquote"),
            left: editor.isActive({ textAlign: "left" }),
            center: editor.isActive({ textAlign: "center" }),
            right: editor.isActive({ textAlign: "right" }),
            undo: editor.can().undo(),
            redo: editor.can().redo(),
          }
        : null,
  });

  const restoreEditor = useCallback(() => {
    if (!preview && editor && !editor.isDestroyed) {
      editor.view.focus();
    } else toggle.current?.focus({ preventScroll: true });
  }, [editor, preview]);

  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const top = viewport?.offsetTop ?? 0;
        const bottom = top + (viewport?.height ?? innerHeight);
        const left = viewport?.offsetLeft ?? 0;
        const width = viewport?.width ?? innerWidth;
        const root = toggle.current?.closest<HTMLElement>(".focus-editor");
        root?.style.setProperty("--editor-viewport-top", `${top}px`);
        root?.style.setProperty(
          "--editor-viewport-height",
          `${bottom - top}px`,
        );
        const selection = editor.state.selection;
        const active = document.activeElement;
        const focused =
          editor.view.hasFocus() ||
          !!(active && bubble.current?.contains(active));
        if (
          preview ||
          blocked ||
          panel ||
          linkOpen ||
          !focused ||
          editor.view.composing ||
          selection instanceof NodeSelection ||
          selection.empty
        ) {
          setPosition(null);
          return;
        }
        const start = editor.view.coordsAtPos(selection.from);
        const end = editor.view.coordsAtPos(selection.to);
        if (end.bottom < top || start.top > bottom) {
          setPosition(null);
          return;
        }
        const toolbarWidth = bubble.current?.offsetWidth || 240;
        const toolbarHeight = bubble.current?.offsetHeight || 52;
        const mobile = matchMedia(
          "(max-width: 700px), (hover: none) and (pointer: coarse)",
        ).matches;
        setPosition({
          left: mobile
            ? left + width / 2
            : Math.max(
                left + toolbarWidth / 2 + 8,
                Math.min(
                  left + width - toolbarWidth / 2 - 8,
                  (start.left + end.right) / 2,
                ),
              ),
          top: mobile
            ? bottom - toolbarHeight - 12
            : Math.max(
                top + 8,
                Math.min(
                  bottom - toolbarHeight - 8,
                  start.top - toolbarHeight - 8 >= top + 8
                    ? start.top - toolbarHeight - 8
                    : end.bottom + 8,
                ),
              ),
        });
      });
    };
    const revealCaret = () => {
      update();
      // Browser scrolling alone is unreliable when the virtual keyboard resizes.
      if (
        !editor.view.hasFocus() ||
        !editor.state.selection.empty ||
        editor.view.composing
      )
        return;
      const viewport = window.visualViewport;
      if (!viewport) return;
      const caret = editor.view.coordsAtPos(editor.state.selection.from);
      const bottom = viewport.offsetTop + viewport.height - 64;
      if (caret.bottom > bottom) window.scrollBy(0, caret.bottom - bottom);
      else if (caret.top < viewport.offsetTop + 64)
        window.scrollBy(0, caret.top - viewport.offsetTop - 64);
    };
    editor.on("transaction", update);
    editor.on("focus", update);
    editor.on("blur", update);
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", revealCaret);
    window.visualViewport?.addEventListener("resize", revealCaret);
    window.visualViewport?.addEventListener("scroll", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      editor.off("transaction", update);
      editor.off("focus", update);
      editor.off("blur", update);
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", revealCaret);
      window.visualViewport?.removeEventListener("resize", revealCaret);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [editor, preview, blocked, panel, linkOpen]);

  async function editLink() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    setLinkOpen(true);
    setPanel(null);
    try {
      // Let the format panel release its focus trap before opening the link dialog.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      if (editor.isDestroyed) return;
      const result = await appDialog.fire<string>({
        titleText: "Añadir enlace",
        text: "Pega una dirección web. Deja el campo vacío para quitar el enlace.",
        input: "text",
        inputLabel: "Dirección del enlace",
        inputPlaceholder: "https://…",
        inputValue: editor.getAttributes("link").href ?? "",
        inputAttributes: {
          autocapitalize: "off",
          autocomplete: "url",
          inputmode: "url",
          spellcheck: "false",
        },
        showCancelButton: true,
        confirmButtonText: "Guardar enlace",
        inputValidator: (value) => {
          if (value && !/^https?:\/\//i.test(value))
            return "El enlace debe comenzar con https:// o http://.";
        },
      });
      if (editor.isDestroyed) return;
      const chain = editor.chain().focus().setTextSelection({ from, to });
      if (result.isConfirmed) {
        if (result.value) chain.setLink({ href: result.value }).run();
        else chain.unsetLink().run();
      } else chain.run();
    } finally {
      setLinkOpen(false);
    }
  }

  const actions = [
    {
      label: "Negrita",
      icon: Bold,
      active: state?.bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Cursiva",
      icon: Italic,
      active: state?.italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Subrayado",
      icon: Underline,
      active: state?.underline,
      run: () => editor?.chain().focus().toggleUnderline().run(),
    },
    { label: "Añadir enlace", icon: LinkIcon, run: () => void editLink() },
    {
      label: "Encabezado",
      icon: Heading2,
      active: state?.heading,
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Lista",
      icon: List,
      active: state?.bullet,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Lista numerada",
      icon: ListOrdered,
      active: state?.ordered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Cita",
      icon: Quote,
      active: state?.quote,
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Alinear a la izquierda",
      icon: AlignLeft,
      active: state?.left,
      run: () => editor?.chain().focus().setTextAlign("left").run(),
    },
    {
      label: "Centrar",
      icon: AlignCenter,
      active: state?.center,
      run: () => editor?.chain().focus().setTextAlign("center").run(),
    },
    {
      label: "Alinear a la derecha",
      icon: AlignRight,
      active: state?.right,
      run: () => editor?.chain().focus().setTextAlign("right").run(),
    },
    {
      label: "Deshacer",
      icon: Undo2,
      disabled: !state?.undo,
      run: () => editor?.chain().focus().undo().run(),
    },
    {
      label: "Rehacer",
      icon: Redo2,
      disabled: !state?.redo,
      run: () => editor?.chain().focus().redo().run(),
    },
  ];
  function buttons(compact: boolean) {
    return actions
      .slice(0, compact ? 4 : undefined)
      .map(({ label, icon: Icon, active, disabled, run }) => (
        <button
          key={label}
          type="button"
          className={`icon-button ${active ? "selected" : ""}`}
          title={label}
          aria-label={label}
          aria-pressed={active}
          disabled={!editor || disabled || blocked}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            run();
            if (!compact) setPanel(null);
          }}
        >
          <Icon size={18} />
          {!compact && <span>{label}</span>}
        </button>
      ));
  }
  function navigate(action: () => void) {
    setPanel(null);
    action();
  }

  return (
    <>
      <button
        ref={toggle}
        className="focus-editor-toggle screen-only"
        aria-label="Opciones del editor"
        aria-haspopup="dialog"
        aria-expanded={!!panel}
        onClick={() => setPanel("Opciones del editor")}
      >
        <MoreHorizontal size={24} />
      </button>
      <div
        ref={bubble}
        role="toolbar"
        aria-label="Formato de la selección"
        className="selection-toolbar screen-only"
        hidden={!position || !!panel || preview || blocked || linkOpen}
        style={
          position ? { left: position.left, top: position.top } : undefined
        }
      >
        {buttons(true)}
        <button
          type="button"
          className="icon-button"
          aria-label="Más formato"
          title="Más formato"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setPanel("Formato")}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
      {panel && (
        <Modal
          key={panel}
          title={panel}
          presentation="editor"
          onClose={() => setPanel(null)}
          restoreFocus={
            panel === "Formato"
              ? restoreEditor
              : () => toggle.current?.focus({ preventScroll: true })
          }
        >
          {panel !== "Opciones del editor" && (
            <button
              className="text-button editor-panel-back"
              onClick={() => setPanel("Opciones del editor")}
            >
              <ArrowLeft size={16} /> Opciones
            </button>
          )}
          {panel === "Opciones del editor" && (
            <div className="editor-menu">
              <button
                type="button"
                role="switch"
                aria-checked={soundEnabled}
                aria-label="Sonido de máquina de escribir"
                onClick={onToggleSound}
              >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                <span>Sonido de máquina de escribir</span>
                <span className="editor-sound-state">
                  {soundEnabled ? "Activado" : "Desactivado"}
                </span>
              </button>
              {!preview && (
                <>
                  <button onClick={() => setPanel("Formato")}>
                    <Type size={18} /> Formato
                  </button>
                  <button onClick={() => setPanel("Apariencia")}>
                    <Palette size={18} /> Apariencia
                  </button>
                  <button
                    disabled={localMode || blocked}
                    onClick={() => navigate(onImage)}
                  >
                    <ImagePlus size={18} /> Añadir imagen
                  </button>
                </>
              )}
              <button onClick={() => setPanel("Detalles")}>
                <Info size={18} /> Detalles
              </button>
              <button onClick={() => navigate(onPreview)}>
                {preview ? <PenLine size={18} /> : <Eye size={18} />}
                {preview ? "Editar" : "Vista previa"}
              </button>
              <button onClick={() => navigate(onPrint)}>
                <Printer size={18} /> PDF
              </button>
              <button
                disabled={shareDisabled}
                onClick={() => navigate(onShare)}
              >
                <Share2 size={18} /> Publicar y compartir
              </button>
              <button onClick={() => navigate(onBack)}>
                <ArrowLeft size={18} /> Mi estudio
              </button>
            </div>
          )}
          {panel === "Formato" && (
            <div
              role="toolbar"
              aria-label="Formato del texto"
              className="editor-format-tools"
            >
              {buttons(false)}
            </div>
          )}
          {panel === "Apariencia" && appearance}
          {panel === "Detalles" && details}
        </Modal>
      )}
    </>
  );
}
