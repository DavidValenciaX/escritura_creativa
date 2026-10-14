"use client";
import Link from "next/link";
import { useEffect, useState, useRef, useId } from "react";
import { Printer, ArrowLeft, BookOpen, Ellipsis, X } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { textContent, type Publication } from "@/lib/model";
import { Letter, PaperStyle, paperStyle } from "./letter";
import { ReportButton } from "./ui";
import { printLetter } from "@/lib/print";

function NotebookEntry({
  publication,
  token,
  offline,
  onClose,
}: {
  publication: Publication;
  token?: string;
  offline: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="notebook-reader focus-reading"
      aria-label={publication.title}
      onCancel={(event) => {
        event.preventDefault();
        if (!event.currentTarget.querySelector(".modal")) onClose();
      }}
    >
      <div className="notebook-reader-actions screen-only">
        <button className="text-button" onClick={onClose} autoFocus>
          <ArrowLeft size={16} /> Volver al cuaderno
        </button>
        <button className="text-button" onClick={() => void printLetter()}>
          <Printer size={16} /> Imprimir / guardar PDF
        </button>
      </div>
      {offline && (
        <p className="notice notebook-reader-notice screen-only" role="status">
          Sin conexión. Esta copia no se puede actualizar hasta que vuelvas a
          conectarte.
        </p>
      )}
      <div className="reader-list">
        <div>
          <Letter {...publication} token={token} />
          <div className="screen-only">
            <ReportButton documentId={publication.document_id} token={token} />
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function Reading({
  initial,
  token,
  notebook,
  author,
}: {
  initial: Publication[];
  token?: string;
  notebook?: { id: string; title: string; description: string };
  author?: { handle: string; display_name: string };
}) {
  const [publications, setPublications] = useState(initial);
  const [unavailable, setUnavailable] = useState(false);
  const [offline, setOffline] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = publications.find((p) => p.document_id === selectedId);
  const controls = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const hideToolbarTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const toolbarId = useId();
  function closeToolbar() {
    clearTimeout(hideToolbarTimer.current);
    setToolbarOpen(false);
  }
  useEffect(() => () => clearTimeout(hideToolbarTimer.current), []);
  useEffect(() => {
    if (!token || !toolbarOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!controls.current?.contains(event.target as Node)) closeToolbar();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeToolbar();
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [token, toolbarOpen]);
  useEffect(() => {
    let active = true;
    let fetching = false;
    const endpoint = token
      ? `/api/link/${token}`
      : notebook
        ? `/api/notebook/${notebook.id}`
        : `/api/read/${initial[0]?.document_id}`;
    async function refresh() {
      if (fetching || document.visibilityState === "hidden") return;
      fetching = true;
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!active) return;
        if (
          response.status === 404 ||
          response.status === 401 ||
          response.status === 403
        ) {
          setUnavailable(true);
          setPublications([]);
          setSelectedId(null);
          return;
        }
        if (!response.ok) throw new Error("No se pudo actualizar");
        const data = await response.json();
        const next: Publication[] =
          token || notebook ? data.publications : [data];
        setPublications(next);
        setSelectedId((id) =>
          next.some((p) => p.document_id === id) ? id : null,
        );
        setUnavailable(false);
        setOffline(false);
      } catch {
        if (active) setOffline(true);
      } finally {
        fetching = false;
      }
    }
    const timer = setInterval(() => void refresh(), 15000);
    const visibility = () => void refresh();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("online", visibility);
    const db = browserSupabase();
    const channel = db
      .channel(`reading-${token ?? notebook?.id ?? initial[0]?.document_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "publications" },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("online", visibility);
      void db.removeChannel(channel);
    };
  }, [token, notebook?.id, initial]);
  return (
    <section className={notebook ? "shared-notebook" : undefined}>
      <div
        ref={controls}
        className={token ? "focus-controls screen-only" : "reader-controls"}
        data-open={toolbarOpen}
        onPointerEnter={(event) => {
          if (
            token &&
            event.pointerType === "mouse" &&
            window.matchMedia("(hover: hover) and (pointer: fine)").matches
          ) {
            clearTimeout(hideToolbarTimer.current);
            setToolbarOpen(true);
          }
        }}
        onPointerLeave={(event) => {
          if (
            token &&
            event.pointerType === "mouse" &&
            !event.currentTarget.querySelector(".reader-header :focus-visible")
          ) {
            clearTimeout(hideToolbarTimer.current);
            hideToolbarTimer.current = setTimeout(() => {
              setToolbarOpen(false);
            }, 320);
          }
        }}
        onFocus={() => clearTimeout(hideToolbarTimer.current)}
        onBlur={(event) => {
          if (token && !event.currentTarget.contains(event.relatedTarget))
            closeToolbar();
        }}
      >
        {token && (
          <button
            ref={toggle}
            className="focus-controls-toggle"
            aria-label={
              toolbarOpen
                ? "Ocultar opciones de lectura"
                : "Mostrar opciones de lectura"
            }
            title="Opciones de lectura"
            aria-expanded={toolbarOpen}
            aria-controls={toolbarId}
            onClick={() => {
              clearTimeout(hideToolbarTimer.current);
              setToolbarOpen((open) => !open);
            }}
          >
            {toolbarOpen ? <X size={18} /> : <Ellipsis size={18} />}
          </button>
        )}
        <header
          id={toolbarId}
          className="reader-header"
          inert={!!token && !toolbarOpen}
        >
          <Link href={token ? "/" : "/received"} className="text-button">
            <ArrowLeft size={15} /> {token ? "Escritura Creativa" : "Volver"}
          </Link>
          <div className="actions">
            {token && (
              <button
                className="text-button"
                onClick={async () => {
                  setShareMessage("");
                  try {
                    const url = window.location.href;
                    if (navigator.share)
                      await navigator.share({
                        title:
                          notebook?.title ??
                          publications[0]?.title ??
                          "Escritura Creativa",
                        url,
                      });
                    else {
                      await navigator.clipboard.writeText(url);
                      setShareMessage("Enlace copiado.");
                    }
                  } catch (e) {
                    if ((e as Error).name !== "AbortError")
                      setShareMessage(
                        "Puedes copiar el enlace desde la barra del navegador.",
                      );
                  }
                }}
              >
                Compartir enlace
              </button>
            )}
            {shareMessage && <span role="status">{shareMessage}</span>}
            {author && (
              <Link href={`/writers/${author.handle}`}>
                Por {author.display_name}
              </Link>
            )}
            <button className="text-button" onClick={() => void printLetter()}>
              <Printer size={16} /> Imprimir / guardar PDF
            </button>
          </div>
        </header>
      </div>
      {notebook && (
        <div className="reader-heading">
          <h1>{notebook.title}</h1>
          <p className="muted">{notebook.description}</p>
        </div>
      )}
      {offline && (
        <p className="notice screen-only" role="status">
          Sin conexión. Esta copia no se puede actualizar hasta que vuelvas a
          conectarte.
        </p>
      )}
      {unavailable ? (
        <div className="empty-state">
          <BookOpen size={32} />
          <h2>Este contenido ya no está disponible</h2>
          <p>El autor pudo retirar la publicación o revocar el acceso.</p>
        </div>
      ) : notebook ? (
        <>
          <div className="document-grid screen-only">
            {publications.map((p) => (
              <article className="document-card" key={p.document_id}>
                <PaperStyle appearance={p.appearance} token={token} />
                <button
                  className="notebook-card-button"
                  aria-label={`Leer ${p.title}`}
                  aria-haspopup="dialog"
                  onClick={() => {
                    closeToolbar();
                    setSelectedId(p.document_id);
                  }}
                >
                  <div
                    className={`paper-thumbnail paper-${p.appearance.paper}`}
                    style={paperStyle(p.appearance, token)}
                  >
                    <span className="eyebrow">
                      {new Date(`${p.written_on}T12:00:00Z`).toLocaleDateString(
                        "es-CO",
                        {
                          day: "numeric",
                          month: "long",
                          timeZone: "America/Bogota",
                        },
                      )}
                    </span>
                    <h3>{p.title}</h3>
                    <p>{textContent(p.content) || "Texto vacío"}</p>
                  </div>
                  <span className="card-meta">
                    Leer escrito <BookOpen size={15} />
                  </span>
                </button>
              </article>
            ))}
            {!publications.length && (
              <div className="empty-state">
                <BookOpen size={32} />
                <h2>Sin entradas publicadas</h2>
                <p>Este cuaderno todavía no tiene entradas publicadas.</p>
              </div>
            )}
          </div>
          <div className="reader-list print-only notebook-print">
            {publications.map((p) => (
              <Letter key={p.document_id} {...p} token={token} />
            ))}
          </div>
          {selected && (
            <NotebookEntry
              key={selected.document_id}
              publication={selected}
              token={token}
              offline={offline}
              onClose={() => setSelectedId(null)}
            />
          )}
        </>
      ) : (
        <div className="reader-list">
          {publications.map((p) => (
            <div key={p.document_id}>
              <Letter {...p} token={token} />
              <div
                className="screen-only"
                style={{
                  maxWidth: 820,
                  margin: "15px auto 0",
                  textAlign: "right",
                }}
              >
                <ReportButton documentId={p.document_id} token={token} />
              </div>
            </div>
          ))}
          {!publications.length && (
            <div className="empty-state">
              <BookOpen size={32} />
              <h2>Sin entradas publicadas</h2>
              <p>Este cuaderno todavía no tiene entradas publicadas.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
