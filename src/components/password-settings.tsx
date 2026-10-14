"use client";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/browser";
import { ErrorMessage } from "./ui";
export function PasswordSettings() {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  return (
    <section className="settings-form" style={{ marginTop: 24 }}>
      <h2>Contraseña de acceso</h2>
      <p className="muted">
        Puedes establecer o cambiar una contraseña para esta misma cuenta.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setMessage("");
          setBusy(true);
          try {
            if (password !== repeat)
              throw new Error("Las contraseñas no coinciden.");
            const { error } = await browserSupabase().auth.updateUser({
              password,
            });
            if (error) throw error;
            setPassword("");
            setRepeat("");
            setMessage("Contraseña actualizada.");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="profile-fields" disabled={busy}>
          <label>
            Nueva contraseña
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirmar nueva contraseña
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </label>
        </fieldset>
        <ErrorMessage message={error} />
        {message && <p role="status">{message}</p>}
        <button className="button" disabled={busy}>
          Guardar contraseña
        </button>
      </form>
    </section>
  );
}
