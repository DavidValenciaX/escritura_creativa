"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Printer, ArrowLeft, BookOpen } from "lucide-react";
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
      <header className="reader-header">
        <Link href={token ? "/" : "/received"} className="text-button">
          <ArrowLeft size={15} /> {token ? "Escritura Creativa" : "Volver"}
        </Link>
        <div className="actions">
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
