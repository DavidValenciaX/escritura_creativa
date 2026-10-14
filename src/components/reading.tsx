"use client";
import Link from "next/link";
import { useEffect, useState, useRef, useId } from "react";
import { Printer, ArrowLeft, BookOpen, Ellipsis, X } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import type { Publication } from "@/lib/model";
import { Letter } from "./letter";
import { ReportButton } from "./ui";
import { printLetter } from "@/lib/print";
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
  const controls = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const toolbarId = useId();
  useEffect(() => {
    if (!token || !toolbarOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!controls.current?.contains(event.target as Node))
        setToolbarOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setToolbarOpen(false);
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
          return;
        }
        if (!response.ok) throw new Error("No se pudo actualizar");
        const data = await response.json();
        setPublications(token || notebook ? data.publications : [data]);
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
    <section>
      <div
        ref={controls}
        className={token ? "focus-controls screen-only" : "reader-controls"}
        data-open={toolbarOpen}
        onPointerEnter={(event) => {
          if (
            token &&
            event.pointerType === "mouse" &&
            window.matchMedia("(hover: hover) and (pointer: fine)").matches
          )
            setToolbarOpen(true);
        }}
        onPointerLeave={(event) => {
          if (
            token &&
            event.pointerType === "mouse" &&
            !event.currentTarget.querySelector(".reader-header :focus-visible")
          )
            setToolbarOpen(false);
        }}
        onBlur={(event) => {
          if (token && !event.currentTarget.contains(event.relatedTarget))
            setToolbarOpen(false);
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
            onClick={() => setToolbarOpen((open) => !open)}
          >
            {toolbarOpen ? <X size={18} /> : <Ellipsis size={18} />}
          </button>
        )}
        <header id={toolbarId} className="reader-header">
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
