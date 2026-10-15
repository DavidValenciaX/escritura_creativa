"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, Feather, Heart, ArrowUpRight } from "lucide-react";
import { type Publication } from "@/lib/model";
import { Letter } from "./letter";
import { api, ErrorMessage } from "./ui";
export type PublicEntry = Publication & {
  profile?: { display_name: string; handle: string };
  favorite?: boolean;
};
export function Publications({
  entries,
  canFavorite = false,
  empty = "Todavía no hay textos publicados",
}: {
  entries: PublicEntry[];
  canFavorite?: boolean;
  empty?: string;
}) {
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState(
    new Set(entries.filter((e) => e.favorite).map((e) => e.document_id)),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const visible = entries.filter((e) =>
    `${e.title} ${e.profile?.display_name ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="toolbar-row">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar textos o autores"
            placeholder="Busca un texto o un escritor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="muted">
          {visible.length} {visible.length === 1 ? "texto" : "textos"}
        </span>
      </div>
      <ErrorMessage message={error} />
      <div className="document-grid">
        {visible.map((p) => (
          <article className="document-card" key={p.document_id}>
            <Link href={`/text/${p.document_id}`}>
              <div className="paper-thumbnail">
                <Letter {...p} thumbnail />
              </div>
            </Link>
            <div className="card-meta">
              {p.profile ? (
                <Link href={`/writers/${p.profile.handle}`}>
                  Por {p.profile.display_name}
                </Link>
              ) : (
                <span>Una página compartida</span>
              )}
              <Feather size={13} />
            </div>
            <div className="card-actions">
              <Link className="text-button" href={`/text/${p.document_id}`}>
                Leer el texto <ArrowUpRight size={13} />
              </Link>
              {canFavorite && p.is_public ? (
                <button
                  disabled={busy === p.document_id}
                  aria-label={
                    favorites.has(p.document_id)
                      ? "Quitar de favoritos"
                      : "Guardar en favoritos"
                  }
                  aria-pressed={favorites.has(p.document_id)}
                  className="icon-button"
                  onClick={async () => {
                    setBusy(p.document_id);
                    try {
                      const active = !favorites.has(p.document_id);
                      await api("favorites", { id: p.document_id, active });
                      setFavorites((prev) => {
                        const next = new Set(prev);
                        if (active) next.add(p.document_id);
                        else next.delete(p.document_id);
                        return next;
                      });
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  <Heart
                    size={15}
                    fill={
                      favorites.has(p.document_id) ? "currentColor" : "none"
                    }
                  />
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!visible.length && (
          <div className="empty-state">
            <Feather size={32} />
            <h2>{search ? "No encontramos esos textos" : empty}</h2>
            <p>
              {search
                ? "Prueba otro título o nombre de autor."
                : "Los textos disponibles se mostrarán aquí."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
