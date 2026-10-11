"use client";
import { useState } from "react";
import { Mail, ArrowUpRight } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { ErrorMessage } from "./ui";
export function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="login-panel">
      <Mail size={30} />
      <p className="eyebrow">BIENVENIDO A TU ESTUDIO</p>
      <h1>
        Un correo.
        <br />
        Tu espacio de palabras.
      </h1>
      {sent ? (
        <div role="status">
          <h3>Revisa tu correo</h3>
          <p>
            Te enviamos un enlace para entrar. Si no aparece, revisa la carpeta
            de spam.
          </p>
          <button className="text-button" onClick={() => setSent(false)}>
            Usar otro correo
          </button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const { error } = await browserSupabase().auth.signInWithOtp({
                email,
                options: {
                  emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
              });
              if (error) throw error;
              setSent(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Tu correo electrónico
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
            />
          </label>
          <ErrorMessage message={error} />
          <button className="button primary" disabled={busy}>
            {busy ? "Enviando…" : "Enviar enlace de acceso"}
            <ArrowUpRight size={17} />
          </button>
          <p className="muted">
            Sin contraseña. Solo tú puedes entrar con el enlace de tu correo.
          </p>
        </form>
      )}
    </section>
  );
}
