"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { api, ErrorMessage } from "./ui";
export function Settings({
  profile,
  images,
  email,
  siteUrl,
}: {
  profile: {
    id: string;
    display_name: string;
    handle: string;
    bio: string;
    avatar_resource_id: string | null;
    avatar_upload_id: string | null;
  };
  images: { id: string; name: string }[];
  email: string;
  siteUrl: string;
}) {
  const [name, setName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [uploadId, setUploadId] = useState(profile.avatar_upload_id ?? "");
  const [avatar, setAvatar] = useState(
    profile.avatar_upload_id
      ? `upload:${profile.avatar_upload_id}`
      : (profile.avatar_resource_id ?? ""),
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const validHandle = /^[a-z0-9_-]{3,40}$/.test(handle);
  const profilePath = `/writers/${handle}`;
  const profileUrl = `${siteUrl.replace(/\/$/, "")}${profilePath}`;
  const avatarUrl = avatar.startsWith("upload:")
    ? `/api/avatar/${avatar.slice(7)}`
    : avatar
      ? `/api/resource/${avatar}`
      : "";
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Mi perfil</h1>
          <p>{email} · tu correo nunca se muestra en el perfil público.</p>
        </div>
      </div>
      <form
        className="settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setMessage("");
          try {
            await api("profile", {
              display_name: name,
              handle,
              bio,
              avatar_resource_id: avatar.startsWith("upload:")
                ? null
                : avatar || null,
              avatar_upload_id: avatar.startsWith("upload:")
                ? avatar.slice(7)
                : null,
            });
            setMessage("Tu perfil está actualizado.");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="profile-fields">
          <label>
            Nombre visible
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Nombre de usuario público
            <input
              required
              minLength={3}
              maxLength={40}
              pattern="[a-z0-9_-]+"
              placeholder="david-valencia"
              aria-describedby="handle-help handle-address"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </label>
          <p id="handle-help" className="muted">
            Elige un nombre único de 3 a 40 caracteres: letras minúsculas sin
            tildes, números, guiones o guiones bajos. Por ejemplo,
            david-valencia.
          </p>
          <p
            id="handle-address"
            className="muted"
            style={{ overflowWrap: "anywhere" }}
          >
            {validHandle ? (
              <>
                Tu perfil: <span>{profileUrl}</span>
              </>
            ) : (
              "Escribe un nombre válido para ver la dirección de tu perfil."
            )}
            {handle !== profile.handle &&
              " Al guardarlo cambiará la dirección de tu perfil; tus textos se conservarán."}
          </p>
          <label>
            Sobre tu escritura
            <textarea
              maxLength={1000}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          <label>
            Avatar opcional
            <select value={avatar} onChange={(e) => setAvatar(e.target.value)}>
              <option value="">Usar mi inicial</option>
              {uploadId && (
                <option value={`upload:${uploadId}`}>Mi imagen subida</option>
              )}
              {images.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
              {avatar &&
                !avatar.startsWith("upload:") &&
                !images.some((i) => i.id === avatar) && (
                  <option value={avatar}>Imagen conservada</option>
                )}
            </select>
          </label>
          <div className="profile-avatar-preview">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Vista previa de tu avatar"
                width={80}
                height={80}
              />
            ) : (
              <span className="avatar">
                {name.charAt(0).toUpperCase() || "E"}
              </span>
            )}
          </div>
          <label>
            Subir mi propia imagen
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setError("");
                setMessage("");
                if (file.size > 4 * 1024 * 1024) {
                  setError("La imagen debe pesar hasta 4 MB.");
                  return;
                }
                if (
                  !["image/jpeg", "image/png", "image/webp"].includes(file.type)
                ) {
                  setError("Usa una imagen JPEG, PNG o WebP.");
                  return;
                }
                setBusy(true);
                setUploading(true);
                try {
                  const form = new FormData();
                  form.set("file", file);
                  const response = await fetch("/api/upload/avatar", {
                    method: "POST",
                    body: form,
                  });
                  const result = await response.json();
                  if (!response.ok)
                    throw new Error(
                      result.error ?? "No se pudo subir la imagen.",
                    );
                  setUploadId(result.id);
                  setAvatar(`upload:${result.id}`);
                  setMessage(
                    `Imagen optimizada: ${(result.originalBytes / 1024).toFixed(1)} KB → ${(result.optimizedBytes / 1024).toFixed(1)} KB. Guarda el perfil para publicarla como avatar.`,
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setUploading(false);
                  setBusy(false);
                }
              }}
            />
          </label>
          <p className="muted">
            JPEG, PNG o WebP hasta 4 MB. Se recorta al centro y optimiza
            automáticamente. Al guardar será visible en tu perfil público; no se
            añade al catálogo comunitario.
          </p>
        </fieldset>
        {uploading && <p role="status">Subiendo y optimizando tu imagen…</p>}
        <ErrorMessage message={error} />
        {message && (
          <p className="success-message" role="status">
            {message}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          Guardar perfil
        </button>
      </form>
      <button
        className="text-button"
        style={{ marginTop: 25 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { error } = await browserSupabase().auth.signOut();
            if (error) throw error;
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (key?.startsWith(`ec:draft:${profile.id}:`))
                localStorage.removeItem(key);
            }
            router.push("/");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <LogOut size={16} /> Cerrar sesión y borrar recuperaciones locales de
        esta cuenta
      </button>
    </section>
  );
}
