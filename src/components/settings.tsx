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
}: {
  profile: {
    id: string;
    display_name: string;
    handle: string;
    bio: string;
    avatar_resource_id: string | null;
  };
  images: { id: string; name: string }[];
  email: string;
}) {
  const [name, setName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatar_resource_id ?? "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LA VOZ DETRÁS DE TUS PALABRAS</p>
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
          try {
            await api("profile", {
              display_name: name,
              handle,
              bio,
              avatar_resource_id: avatar || null,
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
          Identificador público
          <input
            required
            minLength={3}
            maxLength={40}
            pattern="[a-z0-9_-]+"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </label>
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
            {images.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
            {avatar && !images.some((i) => i.id === avatar) && (
              <option value={avatar}>Imagen conservada</option>
            )}
          </select>
        </label>
        <p className="muted">
          El avatar usa una imagen de la biblioteca comunitaria. Puedes aportar
          una desde la biblioteca.
        </p>
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
