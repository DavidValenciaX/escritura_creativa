"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/browser";
import { api, ErrorMessage } from "./ui";
export function Login() {
  const [mode, setMode] = useState<"login" | "signup" | "link" | "reset">(
    "login",
  );
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  function change(next: typeof mode) {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setRepeat("");
  }
  return (
    <section className="login-panel">
      <h1>
        {mode === "signup"
          ? "Crear cuenta"
          : mode === "reset"
            ? "Recuperar acceso"
            : "Iniciar sesión"}
      </h1>
      <div className="actions" role="group" aria-label="Opciones de acceso">
        <button
          className="text-button"
          aria-pressed={mode === "login"}
          onClick={() => change("login")}
          disabled={busy}
        >
          Con contraseña
        </button>
        <button
          className="text-button"
          aria-pressed={mode === "link"}
          onClick={() => change("link")}
          disabled={busy}
        >
          Enlace por correo
        </button>
        <button
          className="text-button"
          aria-pressed={mode === "signup"}
          onClick={() => change("signup")}
          disabled={busy}
        >
          Crear cuenta
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setMessage("");
          try {
            if (mode === "signup" && password !== repeat)
              throw new Error("Las contraseñas no coinciden.");
            if (mode === "link") {
              const { error } = await browserSupabase().auth.signInWithOtp({
                email: login,
                options: {
                  emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
              });
              if (error) throw error;
              setMessage(
                "Revisa tu correo y abre el enlace en este mismo navegador.",
              );
            } else {
              const result = await api<{
                signedIn?: boolean;
                message?: string;
              }>("auth", {
                action: mode,
                login,
                password,
                ...(mode === "signup" ? { handle, name } : {}),
              });
              if (result.signedIn) {
                router.push("/studio");
                router.refresh();
              } else setMessage(result.message ?? "Solicitud completada.");
            }
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="profile-fields">
          {mode === "signup" && (
            <>
              <label>
                Nombre visible
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label>
                Nombre de usuario
                <input
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[a-z0-9_-]+"
                  autoComplete="username"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  aria-describedby="signup-username-help"
                />
              </label>
              <p id="signup-username-help" className="muted">
                De 3 a 40 caracteres: minúsculas, números, guiones y guiones
                bajos.
              </p>
            </>
          )}
          <label>
            {mode === "signup" || mode === "link"
              ? "Correo electrónico"
              : "Nombre de usuario o correo"}
            <input
              type={mode === "signup" || mode === "link" ? "email" : "text"}
              required
              maxLength={254}
              autoComplete={
                mode === "signup" || mode === "link" ? "email" : "username"
              }
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          {(mode === "login" || mode === "signup") && (
            <label>
              Contraseña
              <input
                type="password"
                required
                minLength={mode === "signup" ? 8 : 1}
                maxLength={128}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {mode === "signup" && (
            <label>
              Repetir contraseña
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </label>
          )}
        </fieldset>
        <ErrorMessage message={error} />
        {message && <p role="status">{message}</p>}
        <button className="button primary" disabled={busy}>
          {busy
            ? "Procesando…"
            : mode === "signup"
              ? "Registrarse"
              : mode === "link"
                ? "Enviar enlace"
                : mode === "reset"
                  ? "Recuperar acceso"
                  : "Iniciar sesión"}
        </button>
      </form>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => change("reset")}
      >
        Olvidé mi contraseña
      </button>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const { error } = await browserSupabase().auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: `${window.location.origin}/auth/callback`,
              },
            });
            if (error) throw error;
          } catch {
            setError(
              "No se pudo iniciar el acceso con Google. Comprueba que el proveedor esté habilitado o utiliza otro método de acceso.",
            );
            setBusy(false);
          }
        }}
      >
        Continuar con Google
      </button>
      <p className="muted">
        Si ya accedes mediante un enlace por correo, puedes establecer una
        contraseña desde Mi perfil.
      </p>
    </section>
  );
}
