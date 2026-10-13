"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import {
  ArrowLeft,
  Eye,
  PenLine,
  Printer,
  Share2,
  Check,
  WifiOff,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ImagePlus,
  Heading2,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Underline,
} from "lucide-react";
import {
  recoverySchema,
  fonts,
  papers,
  textContent,
  type Draft,
  type Document,
  type Resource,
  type ContentNode,
} from "@/lib/model";
import { Letter, PaperStyle, paperStyle } from "./letter";
import { ErrorMessage, Modal } from "./ui";
import { Sharing } from "./sharing";
import { printLetter } from "@/lib/print";
const LetterImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      assetId: { default: null },
      resourceId: { default: null },
    };
  },
});
const asDraft = (doc: Document): Draft => ({
  title: doc.title,
  written_on: doc.written_on,
  content: doc.content,
  appearance: doc.appearance,
  signature: doc.signature,
  notebook_id: doc.notebook_id,
  position: doc.position,
});
function editorContent(content: ContentNode): ContentNode {
  return {
    ...content,
    ...(content.type === "image"
      ? {
          attrs: {
            ...content.attrs,
            src: content.attrs?.assetId
              ? `/api/media/${content.attrs.assetId}`
              : `/api/resource/${content.attrs?.resourceId}`,
          },
        }
      : {}),
    ...(content.content ? { content: content.content.map(editorContent) } : {}),
  };
}
export function WritingEditor({
  initial,
  resources,
  localMode = false,
  onBack,
  onSaved,
  onRefresh,
  notebooks,
}: {
  initial: Document;
  resources: Resource[];
  localMode?: boolean;
  onBack: () => void;
  onSaved: (doc: Document) => void;
  onRefresh: () => void;
  notebooks: { id: string; title: string }[];
}) {
  const [draft, setDraft] = useState<Draft>(asDraft(initial));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const revision = useRef(initial.revision);
  const clean = useRef(JSON.stringify(asDraft(initial)));
  const saving = useRef<Promise<Document | null> | null>(null);
  const mounted = useRef(true);
  const key = localMode
    ? "ec:preview"
    : `ec:draft:${initial.owner_id}:${initial.id}`;
  const tab = useRef("");
  const [status, setStatus] = useState("Guardado");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef(false);
  conflictRef.current = conflict;
  const [recovery, setRecovery] = useState<Draft | null>(null);
  const [remote, setRemote] = useState<Document | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageModal, setImageModal] = useState(false);
  const [alt, setAlt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [communityImage, setCommunityImage] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const initialized = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: false,
          linkOnPaste: false,
          protocols: ["http", "https"],
        },
      }),
      LetterImage,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: editorContent(initial.content),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Cuerpo del texto",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) =>
      setDraft((prev) => ({
        ...prev,
        content: editor.getJSON() as ContentNode,
      })),
  });
  const store = useCallback(
    (value: Draft, pending: boolean) => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            draft: value,
            revision: revision.current,
            pending,
            tab: tab.current,
          }),
        );
      } catch {
        setError(
          "No queda espacio para la recuperación local. Exporta tu texto y revisa el almacenamiento del navegador.",
        );
      }
    },
    [key],
  );
  const save = useCallback(async (): Promise<Document | null> => {
    if (saving.current) return saving.current;
    if (conflictRef.current) return null;
    saving.current = Promise.resolve().then(async () => {
      let result: Document | null = null;
      try {
        do {
          const snapshot = draftRef.current;
          const serialized = JSON.stringify(snapshot);
          store(snapshot, true);
          if (localMode) {
            clean.current = serialized;
            setStatus("Guardado en este navegador");
            store(snapshot, false);
            return { ...initial, ...snapshot, revision: revision.current };
          }
          if (!navigator.onLine) {
            setStatus("Sin conexión · copia local");
            return null;
          }
          if (serialized === clean.current)
            return (
              result ?? { ...initial, ...snapshot, revision: revision.current }
            );
          setStatus("Guardando…");
          const response = await fetch("/api/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "save",
              id: initial.id,
              revision: revision.current,
              draft: snapshot,
            }),
          });
          const data = await response.json();
          if (response.status === 409) {
            setConflict(true);
            conflictRef.current = true;
            setStatus("Hay cambios en otra pestaña");
            return null;
          }
          if (!response.ok) throw new Error(data.error);
          result = data as Document;
          revision.current = result.revision;
          clean.current = serialized;
          onSaved(result);
          store(
            draftRef.current,
            serialized !== JSON.stringify(draftRef.current),
          );
          if (conflictRef.current) return null;
        } while (JSON.stringify(draftRef.current) !== clean.current);
        if (mounted.current) {
          setStatus("Guardado");
          setError("");
        }
        return result;
      } catch (e) {
        if (mounted.current) {
          setStatus("Error al guardar · copia local");
          setError((e as Error).message);
        }
        return null;
      } finally {
        saving.current = null;
      }
    });
    return saving.current;
  }, [initial, localMode, onSaved, store]);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    mounted.current = true;
    if (!editor) return;
    if (!initialized.current) {
      initialized.current = true;
      tab.current = crypto.randomUUID();
      try {
        const stored = JSON.parse(localStorage.getItem(key) ?? "null");
        if (stored?.draft && recoverySchema.safeParse(stored.draft).success) {
          if (localMode) {
            setDraft(stored.draft);
            draftRef.current = stored.draft;
            editor?.commands.setContent(editorContent(stored.draft.content));
            clean.current = JSON.stringify(stored.draft);
          } else if (
            stored.pending &&
            JSON.stringify(stored.draft) !== clean.current
          ) {
            setRecovery(stored.draft);
            if (stored.revision !== initial.revision) {
              conflictRef.current = true;
              setConflict(true);
              setStatus("La recuperación tiene una revisión anterior");
            }
          }
        }
      } catch {
        /* Corrupt recovery data is ignored; the server copy stays intact. */
      }
      setHydrated(true);
      try {
        const resourceKey = sessionStorage.getItem("ec:apply-resource");
        const resource = resources.find(
          (r) => r.id === resourceKey || r.builtin_key === resourceKey,
        );
        const builtinPaper = papers.find((p) => p.key === resourceKey);
        const builtinFont = fonts.find((f) => f.key === resourceKey);
        if (resource || builtinPaper || builtinFont) {
          setDraft((prev) => ({
            ...prev,
            appearance: {
              ...prev.appearance,
              [resource?.kind === "paper" || builtinPaper
                ? "paper"
                : "bodyFont"]:
                resource?.builtin_key ?? resource?.id ?? resourceKey!,
            },
          }));
          sessionStorage.removeItem("ec:apply-resource");
        }
      } catch {}
    }
    const online = () => {
      void saveRef.current();
    };
    const offline = () => setStatus("Sin conexión · copia local");
    const storage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue || localMode) return;
      try {
        const other = JSON.parse(event.newValue);
        if (other.tab !== tab.current) {
          conflictRef.current = true;
          setConflict(true);
          setStatus("Cambios desde otra pestaña");
        }
      } catch {}
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(draftRef.current) !== clean.current && !localMode) {
        store(draftRef.current, true);
        event.preventDefault();
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("storage", storage);
    window.addEventListener("beforeunload", unload);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("storage", storage);
      window.removeEventListener("beforeunload", unload);
    };
    // Editor initializes after hydration; recover content once it exists.
  }, [key, localMode, editor, store]);
  useEffect(() => {
    if (!hydrated || recovery) return;
    store(draft, true);
    if (!conflictRef.current && JSON.stringify(draft) !== clean.current)
      setStatus(
        localMode
          ? "Guardando en este navegador…"
          : navigator.onLine
            ? "Cambios sin guardar"
            : "Sin conexión · copia local",
      );
    const timer = setTimeout(() => void saveRef.current(), 850);
    return () => clearTimeout(timer);
  }, [draft, store, recovery, hydrated]);
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(hydrated && !actionBusy);
  }, [editor, actionBusy, hydrated]);
  function change<K extends keyof Draft>(name: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [name]: value }));
  }
  function appearance(name: keyof Draft["appearance"], value: string | number) {
    setDraft((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, [name]: value },
    }));
  }
  async function inspectRemote() {
    try {
      const response = await fetch("/api/studio");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const found = data.documents.find((d: Document) => d.id === initial.id);
      if (!found)
        throw new Error(
          "El texto fue eliminado. Tu recuperación local se conserva.",
        );
      setRemote(found);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function loadDraft(value: Draft) {
    setDraft(value);
    draftRef.current = value;
    editor?.commands.setContent(editorContent(value.content));
    setRecovery(null);
  }
  function downloadRecovery(value: Draft) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `borrador-${initial.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function leave() {
    if (localMode) {
      await save();
      onBack();
      return;
    }
    const saved = await save();
    if (saved) onBack();
  }
  async function addImage(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    setError("");
    try {
      let attrs: Record<string, unknown> = { alt };
      if (communityImage) {
        attrs = {
          ...attrs,
          resourceId: communityImage,
          src: `/api/resource/${communityImage}`,
        };
      } else {
        if (!imageFile) throw new Error("Selecciona una imagen.");
        const form = new FormData();
        form.set("file", imageFile);
        form.set("documentId", initial.id);
        const response = await fetch("/api/upload", {
          method: "POST",
          body: form,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        attrs = { ...attrs, assetId: data.id, src: data.url };
      }
      editor?.chain().focus().insertContent({ type: "image", attrs }).run();
      setImageModal(false);
      setImageFile(null);
      setAlt("");
      setCommunityImage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  const fontResources = resources.filter(
    (r) => r.kind === "font" && !r.builtin_key,
  );
  const paperResources = resources.filter(
    (r) => r.kind === "paper" && !r.builtin_key,
  );
  return (
    <section>
      <div className="editor-head screen-only">
        <button className="text-button" onClick={() => void leave()}>
          <ArrowLeft size={16} /> Mi estudio
        </button>
        <div className="actions">
          <span className="save-status" role="status">
            {status.startsWith("Sin") ? (
              <WifiOff size={13} />
            ) : (
              <Check size={13} />
            )}{" "}
            {status}
          </span>
          <button className="button" onClick={() => setPreview(!preview)}>
            {preview ? <PenLine size={15} /> : <Eye size={15} />}{" "}
            {preview ? "Editar" : "Vista previa"}
          </button>
          <button className="button" onClick={() => void printLetter()}>
            <Printer size={15} /> PDF
          </button>
          <button
            className="button primary"
            disabled={localMode || conflict || actionBusy}
            onClick={async () => {
              setActionBusy(true);
              try {
                const saved = await save();
                if (saved) setSharing(true);
              } finally {
                setActionBusy(false);
              }
            }}
          >
            <Share2 size={15} /> Publicar y compartir
          </button>
        </div>
      </div>
      {localMode && (
        <div className="notice screen-only">
          Editor local de prueba. El texto se guarda solo en este navegador; las
          cuentas, imágenes y publicaciones requieren Supabase.
          <a href="/studio">Configurar el estudio</a>
        </div>
      )}
      {recovery && (
        <div className="notice screen-only">
          <span>Hay un borrador local que no llegó a guardarse.</span>
          <div className="recovery-controls">
            <button className="button" onClick={() => loadDraft(recovery)}>
              Recuperar borrador
            </button>
            <button
              className="text-button"
              onClick={() => downloadRecovery(recovery)}
            >
              Descargar recuperación
            </button>
            <button
              className="text-button"
              onClick={() => {
                setRecovery(null);
                store(draft, false);
              }}
            >
              Usar versión guardada
            </button>
          </div>
        </div>
      )}
      {conflict && (
        <div className="notice screen-only">
          <span>
            Otra pestaña cambió este texto. El autoguardado está detenido para
            conservar tus cambios.
          </span>
          <button className="button" onClick={() => void inspectRemote()}>
            Revisar versiones
          </button>
          <button
            className="text-button"
            onClick={() => downloadRecovery(draft)}
          >
            Descargar mi borrador
          </button>
        </div>
      )}
      <div className="screen-only">
        <ErrorMessage message={error} />
      </div>
      {preview ? (
        <div className="screen-only">
          <Letter {...draft} />
        </div>
      ) : (
        <div className="editor-layout">
          <div className="edit-panel">
            <div
              className="editor-toolbar"
              role="toolbar"
              aria-label="Formato del texto"
            >
              {[
                {
                  label: "Negrita",
                  icon: Bold,
                  active: editor?.isActive("bold"),
                  run: () => editor?.chain().focus().toggleBold().run(),
                },
                {
                  label: "Cursiva",
                  icon: Italic,
                  active: editor?.isActive("italic"),
                  run: () => editor?.chain().focus().toggleItalic().run(),
                },
                {
                  label: "Subrayado",
                  icon: Underline,
                  active: editor?.isActive("underline"),
                  run: () => editor?.chain().focus().toggleUnderline().run(),
                },
                {
                  label: "Encabezado",
                  icon: Heading2,
                  active: editor?.isActive("heading", { level: 2 }),
                  run: () =>
                    editor?.chain().focus().toggleHeading({ level: 2 }).run(),
                },
                {
                  label: "Lista",
                  icon: List,
                  active: editor?.isActive("bulletList"),
                  run: () => editor?.chain().focus().toggleBulletList().run(),
                },
                {
                  label: "Lista numerada",
                  icon: ListOrdered,
                  active: editor?.isActive("orderedList"),
                  run: () => editor?.chain().focus().toggleOrderedList().run(),
                },
                {
                  label: "Cita",
                  icon: Quote,
                  active: editor?.isActive("blockquote"),
                  run: () => editor?.chain().focus().toggleBlockquote().run(),
                },
                {
                  label: "Alinear a la izquierda",
                  icon: AlignLeft,
                  run: () => editor?.chain().focus().setTextAlign("left").run(),
                },
                {
                  label: "Centrar",
                  icon: AlignCenter,
                  run: () =>
                    editor?.chain().focus().setTextAlign("center").run(),
                },
                {
                  label: "Alinear a la derecha",
                  icon: AlignRight,
                  run: () =>
                    editor?.chain().focus().setTextAlign("right").run(),
                },
              ].map(({ label, icon: Icon, run, active }) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={!!active}
                  className={`icon-button ${active ? "selected" : ""}`}
                  onClick={run}
                >
                  <Icon size={16} />
                </button>
              ))}
              <span className="toolbar-separator" />
              <button
                className="icon-button"
                title="Añadir enlace"
                aria-label="Añadir enlace"
                onClick={() => {
                  const href = window.prompt("Enlace (https://…)");
                  if (href && /^https?:\/\//i.test(href))
                    editor?.chain().focus().setLink({ href }).run();
                  else if (href)
                    setError("El enlace debe comenzar con https:// o http://.");
                  else if (href === "")
                    editor?.chain().focus().unsetLink().run();
                }}
              >
                <LinkIcon size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Añadir imagen"
                disabled={localMode}
                onClick={() => setImageModal(true)}
              >
                <ImagePlus size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Deshacer"
                onClick={() => editor?.chain().focus().undo().run()}
              >
                <Undo2 size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Rehacer"
                onClick={() => editor?.chain().focus().redo().run()}
              >
                <Redo2 size={16} />
              </button>
            </div>
            <PaperStyle appearance={draft.appearance} />
            <div
              className={`editor-page paper-${draft.appearance.paper}`}
              style={paperStyle(draft.appearance)}
            >
              <label className="editor-date">
                <span className="sr-only">Fecha del texto</span>
                <input
                  type="date"
                  disabled={actionBusy || !hydrated}
                  value={draft.written_on}
                  onChange={(e) => change("written_on", e.target.value)}
                  onBlur={() => {
                    if (!draft.written_on)
                      change(
                        "written_on",
                        new Date().toLocaleDateString("en-CA", {
                          timeZone: "America/Bogota",
                        }),
                      );
                  }}
                />
              </label>
              <input
                className="title-input"
                aria-label="Título del texto"
                disabled={actionBusy || !hydrated}
                maxLength={200}
                value={draft.title}
                onChange={(e) => change("title", e.target.value)}
                onBlur={() => {
                  if (!draft.title.trim()) change("title", "Sin título");
                }}
                placeholder="Título del texto"
              />
              <EditorContent editor={editor} />
              <input
                className="signature-input"
                aria-label="Firma"
                disabled={actionBusy || !hydrated}
                maxLength={500}
                placeholder="Firma (opcional)"
                value={draft.signature}
                onChange={(e) => change("signature", e.target.value)}
              />
            </div>
          </div>
          <aside className="design-panel">
            <h3>Formato del texto</h3>
            <p className="eyebrow">PAPEL</p>
            <div className="paper-picker">
              {papers.map((p) => (
                <button
                  key={p.key}
                  aria-label={p.name}
                  title={p.name}
                  aria-pressed={draft.appearance.paper === p.key}
                  className={`paper-swatch paper-${p.key} ${draft.appearance.paper === p.key ? "selected" : ""}`}
                  onClick={() => appearance("paper", p.key)}
                />
              ))}
            </div>
            {paperResources.length > 0 && (
              <label>
                Papeles de la comunidad
                <select
                  value={
                    paperResources.some((r) => r.id === draft.appearance.paper)
                      ? draft.appearance.paper
                      : ""
                  }
                  onChange={(e) => {
                    if (e.target.value) appearance("paper", e.target.value);
                  }}
                >
                  <option value="">Elegir papel</option>
                  {paperResources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(["titleFont", "bodyFont"] as const).map((name) => (
              <label key={name}>
                {name === "titleFont" ? "Letra del título" : "Letra del cuerpo"}
                <select
                  value={draft.appearance[name]}
                  onChange={(e) => appearance(name, e.target.value)}
                >
                  {fonts.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.name} · {f.kind}
                    </option>
                  ))}
                  {fontResources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                  {!fonts.some((f) => f.key === draft.appearance[name]) &&
                    !fontResources.some(
                      (r) => r.id === draft.appearance[name],
                    ) && (
                      <option value={draft.appearance[name]}>
                        Fuente conservada
                      </option>
                    )}
                </select>
              </label>
            ))}
            <label>
              Tamaño · {draft.appearance.fontSize}px
              <input
                type="range"
                min={12}
                max={32}
                value={draft.appearance.fontSize}
                onChange={(e) => appearance("fontSize", Number(e.target.value))}
              />
            </label>
            <label>
              Interlineado
              <select
                value={draft.appearance.lineHeight}
                onChange={(e) =>
                  appearance("lineHeight", Number(e.target.value))
                }
              >
                {[1.2, 1.5, 1.8, 2, 2.5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tinta
              <input
                type="color"
                value={draft.appearance.ink}
                onChange={(e) => appearance("ink", e.target.value)}
              />
            </label>
            <label>
              Cuaderno
              <select
                value={draft.notebook_id ?? ""}
                onChange={(e) => change("notebook_id", e.target.value || null)}
              >
                <option value="">Sin cuaderno</option>
                {notebooks.map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="editor-help">
              {
                textContent(draft.content).trim().split(/\s+/).filter(Boolean)
                  .length
              }{" "}
              palabras
              <br />
              Tu borrador es privado. Publica una versión cuando esté listo.
            </p>
          </aside>
        </div>
      )}
      <div className="print-only">
        <Letter {...draft} />
      </div>
      {imageModal && (
        <Modal
          title="Una imagen para tu texto"
          onClose={() => setImageModal(false)}
        >
          <form onSubmit={addImage}>
            <label>
              Imagen personal
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  setImageFile(e.target.files?.[0] ?? null);
                  setCommunityImage("");
                }}
              />
            </label>
            <p className="muted">
              Hasta 10 MB. Solo será visible en las versiones donde la incluyas.
            </p>
            <label>
              O una imagen de la comunidad
              <select
                value={communityImage}
                onChange={(e) => {
                  setCommunityImage(e.target.value);
                  setImageFile(null);
                }}
              >
                <option value="">Elegir imagen</option>
                {resources
                  .filter((r) => r.kind === "image")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Descripción de la imagen
              <input
                required
                value={alt}
                maxLength={500}
                onChange={(e) => setAlt(e.target.value)}
              />
            </label>
            <ErrorMessage message={error} />
            <button className="button primary" disabled={uploading}>
              {uploading ? "Subiendo…" : "Insertar imagen"}
            </button>
          </form>
        </Modal>
      )}
      {remote && (
        <Modal
          title="Dos versiones del mismo texto"
          onClose={() => setRemote(null)}
        >
          <h3>Tu borrador local</h3>
          <p>{draft.title}</p>
          <p className="muted">{textContent(draft.content).slice(0, 300)}</p>
          <h3>Última versión guardada</h3>
          <p>{remote.title}</p>
          <p className="muted">{textContent(remote.content).slice(0, 300)}</p>
          <p className="notice">
            Elige explícitamente qué versión quieres conservar.
          </p>
          <div className="hero-actions">
            <button
              className="button"
              onClick={() => {
                revision.current = remote.revision;
                clean.current = JSON.stringify(asDraft(remote));
                loadDraft(asDraft(remote));
                setConflict(false);
                conflictRef.current = false;
                setRemote(null);
                store(asDraft(remote), false);
              }}
            >
              Usar versión remota
            </button>
            <button
              className="button primary"
              onClick={() => {
                revision.current = remote.revision;
                setConflict(false);
                conflictRef.current = false;
                setRemote(null);
                void saveRef.current();
              }}
            >
              Conservar mi borrador
            </button>
          </div>
        </Modal>
      )}
      {sharing && (
        <Sharing
          target={{ document_id: initial.id, notebook_id: null }}
          title={draft.title}
          revision={revision.current}
          onClose={() => {
            setSharing(false);
            onRefresh();
          }}
          onPublished={() => onRefresh()}
        />
      )}
    </section>
  );
}
