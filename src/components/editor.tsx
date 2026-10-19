"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { LetterImage } from "./letter-image";
import { imageBottom, newImageLayout } from "@/lib/image-layout";
import { letterDate } from "@/lib/sheet-layout";
import { SheetFrame, SheetField } from "./sheet-frame";
import TextAlign from "@tiptap/extension-text-align";
import { EditorTools } from "./editor-tools";
import {
  recoverySchema,
  appearanceSchema,
  withoutSignature,
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
import { stableJson } from "@/lib/stable-json";
const asDraft = (doc: Document): Draft =>
  withoutSignature({
    title: doc.title,
    written_on: doc.written_on,
    content: doc.content,
    appearance: appearanceSchema.parse(doc.appearance),
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
  initialResource,
  resources,
  localMode = false,
  onBack,
  onSaved,
  onRefresh,
  notebooks,
}: {
  initial: Document;
  initialResource?: Resource;
  resources: Resource[];
  localMode?: boolean;
  onBack: () => void;
  onSaved: (doc: Document) => void;
  onRefresh: () => void;
  notebooks: { id: string; title: string }[];
}) {
  const [draft, setDraft] = useState<Draft>(() => asDraft(initial));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const revision = useRef(initial.revision);
  const clean = useRef("");
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
  const recoveryRef = useRef(recovery);
  recoveryRef.current = recovery;
  const recoveryRevision = useRef(initial.revision);
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
    content: editorContent(draft.content),
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
  const fingerprint = useCallback(
    (value: Draft) => {
      value = withoutSignature(value);
      return stableJson({
        ...value,
        appearance: appearanceSchema.parse(value.appearance),
        // Tiptap supplies default attributes and runtime image URLs. Compare
        // both versions using its schema, not their original JSON encoding.
        content: editor
          ? editor.schema.nodeFromJSON(editorContent(value.content)).toJSON()
          : value.content,
      });
    },
    [editor],
  );
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
    if (recoveryRef.current) {
      setError(
        "Elige recuperar el borrador local o usar la versión guardada antes de continuar.",
      );
      return null;
    }
    saving.current = Promise.resolve().then(async () => {
      let result: Document | null = null;
      try {
        do {
          const snapshot = draftRef.current;
          const serialized = fingerprint(snapshot);
          const pending = serialized !== clean.current;
          store(snapshot, pending);
          if (localMode) {
            clean.current = serialized;
            setStatus("Guardado en este navegador");
            store(snapshot, false);
            return { ...initial, ...snapshot, revision: revision.current };
          }
          if (!pending) {
            setStatus("Guardado");
            return (
              result ?? { ...initial, ...snapshot, revision: revision.current }
            );
          }
          if (!navigator.onLine) {
            setStatus("Sin conexión · copia local");
            return null;
          }
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
          store(draftRef.current, serialized !== fingerprint(draftRef.current));
          if (conflictRef.current) return null;
        } while (fingerprint(draftRef.current) !== clean.current);
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
  }, [initial, localMode, onSaved, store, fingerprint]);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    mounted.current = true;
    if (!editor) return;
    if (!initialized.current) {
      initialized.current = true;
      tab.current = crypto.randomUUID();
      clean.current = fingerprint(asDraft(initial));
      try {
        const stored = JSON.parse(localStorage.getItem(key) ?? "null");
        const recovered = recoverySchema.safeParse(stored?.draft);
        if (recovered.success) {
          stored.draft = withoutSignature(recovered.data);
          if (localMode) {
            setDraft(stored.draft);
            draftRef.current = stored.draft;
            // React node views must mount after this effect has committed.
            queueMicrotask(() => {
              if (!editor.isDestroyed)
                editor.commands.setContent(
                  editorContent(stored.draft.content),
                  {
                    emitUpdate: false,
                  },
                );
            });
            clean.current = fingerprint(stored.draft);
            setStatus("Guardado en este navegador");
          } else if (
            stored.pending &&
            fingerprint(stored.draft) !== clean.current
          ) {
            recoveryRevision.current = stored.revision;
            setRecovery(stored.draft);
            if (stored.revision !== initial.revision) {
              setStatus("La recuperación tiene una revisión anterior");
            }
          }
        }
      } catch {
        /* Corrupt recovery data is ignored; the server copy stays intact. */
      }
      setHydrated(true);
      try {
        // Session selections belong only to the standalone local preview.
        // The signed-in studio passes the choice for this document explicitly.
        const resourceKey = localMode
          ? sessionStorage.getItem("ec:apply-resource")
          : null;
        const resource =
          initialResource ??
          (resourceKey
            ? resources.find(
                (r) => r.id === resourceKey || r.builtin_key === resourceKey,
              )
            : undefined);
        const builtinPaper = papers.find((p) => p.key === resourceKey);
        const builtinFont = fonts.find((f) => f.key === resourceKey);
        if (
          resource?.kind === "paper" ||
          resource?.kind === "font" ||
          builtinPaper ||
          builtinFont
        ) {
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
        }
        // Also discard stale selections left by older studio sessions.
        sessionStorage.removeItem("ec:apply-resource");
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
        if (
          other.tab !== tab.current &&
          recoverySchema.safeParse(other.draft).success &&
          !(
            other.revision === revision.current &&
            fingerprint(other.draft) === clean.current
          )
        ) {
          conflictRef.current = true;
          setConflict(true);
          setStatus("Cambios desde otra pestaña");
        }
      } catch {}
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (
        !recoveryRef.current &&
        fingerprint(draftRef.current) !== clean.current &&
        !localMode
      ) {
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
  }, [key, localMode, editor, store, fingerprint]);
  useEffect(() => {
    if (!hydrated || recovery) return;
    const pending = fingerprint(draft) !== clean.current;
    store(draft, pending);
    if (!pending) {
      if (!conflictRef.current)
        setStatus(localMode ? "Guardado en este navegador" : "Guardado");
      return;
    }
    if (!conflictRef.current)
      setStatus(
        localMode
          ? "Guardando en este navegador…"
          : navigator.onLine
            ? "Cambios sin guardar"
            : "Sin conexión · copia local",
      );
    const timer = setTimeout(() => void saveRef.current(), 850);
    return () => clearTimeout(timer);
  }, [draft, store, recovery, hydrated, fingerprint]);
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
    editor?.commands.setContent(editorContent(value.content), {
      emitUpdate: false,
    });
    recoveryRef.current = null;
    setRecovery(null);
    setError("");
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
      let attrs: Record<string, unknown> = {
        alt,
        layout: { ...newImageLayout },
      };
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
    <section
      className={`focus-editor paper-${draft.appearance.paper}`}
      style={paperStyle(draft.appearance)}
      onClick={(event) => {
        if (preview || actionBusy || !hydrated) return;
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target === event.currentTarget ||
            target.matches(".editor-page, .sheet-frame, .sheet-canvas"))
        )
          editor?.commands.focus();
      }}
    >
      <EditorTools
        editor={editor}
        preview={preview}
        blocked={!hydrated || actionBusy || imageModal || sharing || !!remote}
        localMode={localMode}
        shareDisabled={localMode || conflict || actionBusy}
        onBack={() => void leave()}
        onPreview={() => setPreview(!preview)}
        onImage={() => setImageModal(true)}
        onPrint={() => void printLetter()}
        onShare={() => {
          setActionBusy(true);
          void save()
            .then((saved) => {
              if (saved) setSharing(true);
            })
            .finally(() => setActionBusy(false));
        }}
        appearance={
          <div className="editor-appearance">
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
                  <optgroup label="Fuentes incluidas">
                    {fonts.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.name} · {f.kind}
                      </option>
                    ))}
                  </optgroup>
                  {fontResources.length > 0 && (
                    <optgroup label="Fuentes aportadas">
                      {fontResources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} · Aportada
                        </option>
                      ))}
                    </optgroup>
                  )}
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
              Tamaño del cuerpo · {draft.appearance.fontSize}px
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
          </div>
        }
        details={
          <div>
            <p className="save-status">{status}</p>
            {localMode && (
              <p className="notice">
                Editor local de prueba. El texto se guarda solo en este
                navegador; las cuentas, imágenes y publicaciones requieren
                Supabase. <a href="/studio">Configurar el estudio</a>
              </p>
            )}
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
              Selecciona una imagen para moverla, escalarla o girarla. También
              puedes usar las flechas en sus controles.
              <br />
              Tu borrador es privado. Publica una versión cuando esté listo.
            </p>
          </div>
        }
      />
      <span className="sr-only" role="status">
        {status}
      </span>
      {status.startsWith("Sin") && (
        <div className="notice focus-editor-notice screen-only">{status}</div>
      )}
      {recovery && (
        <div className="notice focus-editor-notice screen-only">
          <span>Hay un borrador local que no llegó a guardarse.</span>
          <div className="recovery-controls">
            <button
              className="button"
              onClick={() => {
                if (recoveryRevision.current !== revision.current) {
                  conflictRef.current = true;
                  setConflict(true);
                  setStatus("La recuperación tiene una revisión anterior");
                }
                loadDraft(recovery);
              }}
            >
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
                const saved = asDraft(initial);
                loadDraft(saved);
                store(saved, false);
                if (!conflictRef.current) setStatus("Guardado");
              }}
            >
              Usar versión guardada
            </button>
          </div>
        </div>
      )}
      {conflict && (
        <div className="notice focus-editor-notice screen-only">
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
      <div className="focus-editor-notice screen-only">
        <ErrorMessage message={error} />
      </div>
      {preview ? (
        <div className="screen-only">
          <Letter {...draft} />
        </div>
      ) : (
        <div className="editor-layout">
          <div className="edit-panel">
            <PaperStyle appearance={draft.appearance} />
            <SheetFrame>
              <div
                className={`editor-page sheet-document paper-${draft.appearance.paper}`}
                style={paperStyle(draft.appearance)}
              >
                <div
                  className="image-sheet-extent"
                  aria-hidden="true"
                  style={{ height: `${imageBottom(draft.content)}cqw` }}
                />
                <label className="editor-date letter-date">
                  <span className="sr-only">Fecha del texto</span>
                  <span>{letterDate(draft.written_on)}</span>
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
                <SheetField
                  className="letter-title"
                  label="Título del texto"
                  disabled={actionBusy || !hydrated}
                  maxLength={200}
                  value={draft.title}
                  onChange={(value) => change("title", value)}
                  onBlur={() => {
                    if (!draft.title.trim()) change("title", "Sin título");
                  }}
                  placeholder="Título del texto"
                />
                <EditorContent editor={editor} />
                <div className="letter-end">✦</div>
              </div>
            </SheetFrame>
          </div>
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
                placeholder="Opcional"
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
                clean.current = fingerprint(asDraft(remote));
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
