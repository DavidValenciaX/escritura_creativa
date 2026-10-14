"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  BookOpen,
  Feather,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Share2,
  Pencil,
} from "lucide-react";
import {
  defaultAppearance,
  emptyContent,
  textContent,
  type Document,
  type Notebook,
  type Resource,
} from "@/lib/model";
import { PaperStyle, paperStyle } from "./letter";
import { WritingEditor } from "./editor";
import { Sharing } from "./sharing";
import { api, ErrorMessage, Modal } from "./ui";
const localDoc: Document = {
  id: "local",
  owner_id: "local",
  title: "Mi primera página",
  written_on: new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  }),
  content: emptyContent,
  appearance: defaultAppearance,
  signature: "",
  notebook_id: null,
  position: 0,
  revision: 1,
  updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};
export function LocalPreview() {
  return (
    <WritingEditor
      initial={localDoc}
      resources={[]}
      localMode
      notebooks={[]}
      onBack={() => window.location.assign("/")}
      onSaved={() => {}}
      onRefresh={() => {}}
    />
  );
}
export function Studio() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [publications, setPublications] = useState<
    { document_id: string; is_public: boolean }[]
  >([]);
  const [selected, setSelected] = useState<{
    document: Document;
    resource?: Resource;
  } | null>(null);
  const [book, setBook] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bookModal, setBookModal] = useState(false);
  const [editBook, setEditBook] = useState<Notebook | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookDescription, setBookDescription] = useState("");
  const [sharingBook, setSharingBook] = useState<Notebook | null>(null);
  const [moving, setMoving] = useState<Document | null>(null);
  const [destination, setDestination] = useState("");
  const [moveError, setMoveError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "documents" | "notebooks";
    id: string;
    title: string;
  } | null>(null);
  const params = useSearchParams();
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/studio", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDocuments(data.documents);
      setNotebooks(data.notebooks);
      setResources(data.resources);
      setPublications(data.publications);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function operation(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function openDocument(doc: Document) {
    const resource = resources.find(
      (r) => r.id === params.get("resource") && r.kind !== "image",
    );
    // Bind the library choice to this editor only. Reloading the studio or
    // publishing must never queue it again for another document.
    const url = new URL(window.location.href);
    url.searchParams.delete("resource");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    setSelected({ document: doc, resource });
  }
  const saved = useCallback(
    (doc: Document) =>
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d))),
    [],
  );
  if (selected)
    return (
      <WritingEditor
        key={selected.document.id}
        initial={selected.document}
        initialResource={selected.resource}
        resources={resources}
        notebooks={notebooks}
        onBack={() => {
          setSelected(null);
          void load();
        }}
        onSaved={saved}
        onRefresh={() => void load()}
      />
    );
  const visible = documents
    .filter(
      (d) =>
        (book === "all" ||
          (book === "loose" ? !d.notebook_id : d.notebook_id === book)) &&
        `${d.title} ${textContent(d.content)}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      book !== "all" && book !== "loose"
        ? a.position - b.position
        : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  const currentBook = notebooks.find((n) => n.id === book);
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Mi estudio</h1>
        </div>
        <button
          className="button primary"
          disabled={busy || loading}
          onClick={() =>
            void operation(async () => {
              const doc = await api<Document>("documents", {
                action: "create",
                notebook_id: currentBook?.id ?? null,
              });
              setDocuments((prev) => [doc, ...prev]);
              openDocument(doc);
            })
          }
        >
          <Plus size={17} /> Escribir un texto
        </button>
      </div>
      <ErrorMessage message={error} />
      {params.get("resource") && (
        <div className="notice">
          Abre o crea un texto para aplicar el recurso elegido de la biblioteca.
        </div>
      )}
      <div className="toolbar-row">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar mis textos"
            placeholder="Buscar textos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filtrar por cuaderno"
          style={{ width: "auto", maxWidth: 220 }}
          value={book}
          onChange={(e) => setBook(e.target.value)}
        >
          <option value="all">Todos los textos · {documents.length}</option>
          <option value="loose">Sin cuaderno</option>
          {notebooks.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
        <button
          className="text-button"
          disabled={loading}
          onClick={() => {
            setEditBook(null);
            setBookTitle("");
            setBookDescription("");
            setBookModal(true);
          }}
        >
          <Plus size={15} /> Nuevo cuaderno
        </button>
      </div>
      {currentBook && (
        <div className="notebook-bar">
          <div>
            <h3>{currentBook.title}</h3>
            <p>{currentBook.description || "Sin descripción."}</p>
          </div>
          <div className="actions">
            <button
              className="icon-button"
              aria-label="Editar cuaderno"
              onClick={() => {
                setEditBook(currentBook);
                setBookTitle(currentBook.title);
                setBookDescription(currentBook.description);
                setBookModal(true);
              }}
            >
              <Pencil size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Compartir cuaderno"
              onClick={() => setSharingBook(currentBook)}
            >
              <Share2 size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Eliminar cuaderno"
              onClick={() =>
                setDeleteTarget({
                  type: "notebooks",
                  id: currentBook.id,
                  title: currentBook.title,
                })
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <div className="loading" role="status">
          Abriendo tu estudio…
        </div>
      ) : (
        <div className="document-grid">
          {visible.map((doc, i) => {
            const pub = publications.find((p) => p.document_id === doc.id);
            return (
              <article className="document-card" key={doc.id}>
                <PaperStyle appearance={doc.appearance} />
                <button
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                  }}
                  onClick={() => openDocument(doc)}
                >
                  <div
                    className={`paper-thumbnail paper-${doc.appearance.paper}`}
                    style={paperStyle(doc.appearance)}
                  >
                    <span
                      className="eyebrow"
                      style={{ fontSize: 8, marginBottom: 3 }}
                    >
                      {new Date(
                        `${doc.written_on}T12:00:00Z`,
                      ).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "long",
                        timeZone: "America/Bogota",
                      })}
                    </span>
                    <h3>{doc.title}</h3>
                    <p>{textContent(doc.content) || "Texto vacío"}</p>
                  </div>
                </button>
                <div className="card-meta">
                  <span>
                    {pub
                      ? pub.is_public
                        ? "En el muro"
                        : "Versión compartida"
                      : "Borrador privado"}
                  </span>
                  <Feather size={13} />
                </div>
                <div className="card-actions">
                  <button
                    className="text-button"
                    onClick={() => openDocument(doc)}
                  >
                    Seguir escribiendo
                  </button>
                  <div style={{ display: "flex" }}>
                    <button
                      className="text-button move-notebook-button"
                      aria-label={`Mover a cuaderno: ${doc.title}`}
                      disabled={busy}
                      onClick={() => {
                        setMoving(doc);
                        setDestination(doc.notebook_id ?? "");
                        setMoveError("");
                      }}
                    >
                      <BookOpen size={13} /> Mover
                    </button>
                    {currentBook && (
                      <>
                        <button
                          className="icon-button"
                          aria-label={`Subir ${doc.title}`}
                          disabled={i === 0 || busy || !!search}
                          onClick={() =>
                            void operation(async () => {
                              const ids = visible.map((d) => d.id);
                              [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                              await api("notebooks", {
                                action: "order",
                                id: book,
                                ids,
                              });
                              await load();
                            })
                          }
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Bajar ${doc.title}`}
                          disabled={
                            i === visible.length - 1 || busy || !!search
                          }
                          onClick={() =>
                            void operation(async () => {
                              const ids = visible.map((d) => d.id);
                              [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                              await api("notebooks", {
                                action: "order",
                                id: book,
                                ids,
                              });
                              await load();
                            })
                          }
                        >
                          <ArrowDown size={13} />
                        </button>
                      </>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`Duplicar ${doc.title}`}
                      disabled={busy}
                      onClick={() =>
                        void operation(async () => {
                          const copy = await api<Document>("documents", {
                            action: "duplicate",
                            id: doc.id,
                          });
                          setDocuments((prev) => [copy, ...prev]);
                        })
                      }
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Eliminar ${doc.title}`}
                      onClick={() =>
                        setDeleteTarget({
                          type: "documents",
                          id: doc.id,
                          title: doc.title,
                        })
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {!visible.length && (
            <div className="empty-state">
              <BookOpen size={34} />
              <h2>
                {search
                  ? "No se encontraron textos"
                  : "No hay textos en esta vista"}
              </h2>
              <p>
                {search
                  ? "Prueba con otro título o parte del contenido."
                  : "Usa «Escribir un texto» para crear un borrador."}
              </p>
            </div>
          )}
        </div>
      )}
      {moving && (
        <Modal
          title="Mover a cuaderno"
          onClose={() => {
            if (!busy) setMoving(null);
          }}
        >
          <p>{moving.title}</p>
          <p className="muted">
            Elige un cuaderno o «Sin cuaderno» para sacar el escrito. Si ya
            tiene una versión publicada, también cambiará el cuaderno desde el
            que se puede leer; el borrador no se publica.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMoveError("");
              try {
                await api("documents", {
                  action: "move",
                  id: moving.id,
                  revision: moving.revision,
                  notebook_id: destination || null,
                });
                await load();
                setMoving(null);
              } catch (e) {
                setMoveError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Cuaderno de destino
              <select
                value={destination}
                disabled={busy}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Sin cuaderno</option>
                {notebooks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </label>
            <ErrorMessage message={moveError} />
            <button
              className="button primary"
              disabled={busy || destination === (moving.notebook_id ?? "")}
            >
              {busy ? "Moviendo…" : "Mover escrito"}
            </button>
          </form>
        </Modal>
      )}
      {bookModal && (
        <Modal
          title={editBook ? "Editar cuaderno" : "Un cuaderno nuevo"}
          onClose={() => setBookModal(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void operation(async () => {
                if (editBook)
                  await api("notebooks", {
                    action: "update",
                    id: editBook.id,
                    title: bookTitle,
                    description: bookDescription,
                  });
                else {
                  const created = await api<Notebook>("notebooks", {
                    action: "create",
                    title: bookTitle,
                    description: bookDescription,
                  });
                  setBook(created.id);
                }
                await load();
                setBookModal(false);
              });
            }}
          >
            <label>
              Título
              <input
                autoFocus
                required
                maxLength={160}
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="Nombre del cuaderno"
              />
            </label>
            <label>
              Descripción
              <textarea
                maxLength={1000}
                value={bookDescription}
                onChange={(e) => setBookDescription(e.target.value)}
              />
            </label>
            <ErrorMessage message={error} />
            <button className="button primary" disabled={busy}>
              Guardar cuaderno
            </button>
          </form>
        </Modal>
      )}
      {deleteTarget && (
        <Modal
          title={`Eliminar ${deleteTarget.type === "documents" ? "texto" : "cuaderno"}`}
          onClose={() => setDeleteTarget(null)}
        >
          <p>¿Quieres eliminar «{deleteTarget.title}»?</p>
          <p className="muted">
            {deleteTarget.type === "documents"
              ? "Se eliminarán el borrador, su publicación, imágenes personales y accesos."
              : "Los textos se conservarán sin cuaderno. Se eliminarán los permisos y enlaces de este cuaderno."}
          </p>
          <ErrorMessage message={error} />
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void operation(async () => {
                await api(deleteTarget.type, {
                  action: "delete",
                  id: deleteTarget.id,
                });
                if (deleteTarget.type === "documents")
                  try {
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                      const key = localStorage.key(i);
                      if (key?.endsWith(`:${deleteTarget.id}`))
                        localStorage.removeItem(key);
                    }
                  } catch {}
                else setBook("all");
                setDeleteTarget(null);
                await load();
              })
            }
          >
            Eliminar definitivamente
          </button>
        </Modal>
      )}
      {sharingBook && (
        <Sharing
          title={sharingBook.title}
          target={{ document_id: null, notebook_id: sharingBook.id }}
          onClose={() => setSharingBook(null)}
        />
      )}
    </section>
  );
}
