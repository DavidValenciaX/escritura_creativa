import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { configured, service, supabase } from "@/lib/supabase/server";
import { sameOrigin, failure, HttpError, check, boundedJson } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!configured())
      throw new HttpError(503, "El servicio de acceso no está configurado.");
    const raw = await boundedJson(request);
    const body = z
      .object({
        action: z.enum(["login", "signup", "reset"]),
        login: z.string().trim().min(3).max(254),
        password: z.string().max(128).optional(),
        handle: z
          .string()
          .regex(/^[a-z0-9_-]{3,40}$/)
          .optional(),
        name: z.string().trim().min(1).max(100).optional(),
      })
      .parse(raw);
    const admin = service();
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = await admin.rpc("consume_auth_attempt", {
      attempt_key: createHash("sha256").update(ip).digest("hex"),
    });
    check(limit.error);
    if (!limit.data)
      throw new HttpError(
        429,
        "Demasiados intentos. Inténtalo de nuevo en 15 minutos.",
      );
    const db = await supabase();
    let email = body.login.toLowerCase();
    if (body.action === "signup") {
      email = z.email().parse(email);
      const password = z.string().min(8).max(128).parse(body.password);
      const handle = z
        .string()
        .regex(/^[a-z0-9_-]{3,40}$/)
        .parse(body.handle);
      const existing = await admin
        .from("profiles")
        .select("id")
        .eq("handle", handle)
        .maybeSingle();
      check(existing.error);
      if (existing.data)
        throw new HttpError(400, "Ese nombre de usuario ya está en uso.");
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: { public_handle: handle, name: body.name ?? handle },
          emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
        },
      });
      if (error)
        throw new HttpError(
          400,
          "No se pudo completar el registro. Revisa los datos o utiliza el acceso por correo si ya tienes cuenta.",
        );
      return NextResponse.json({
        signedIn: !!data.session,
        message:
          "Revisa tu correo para confirmar el registro. Si ya tienes cuenta, inicia sesión o recupera tu contraseña.",
      });
    }
    if (!email.includes("@")) {
      const profile = await admin
        .from("profiles")
        .select("id")
        .eq("handle", email)
        .maybeSingle();
      check(profile.error);
      email = profile.data
        ? ((await admin.auth.admin.getUserById(profile.data.id)).data.user
            ?.email ?? "missing@invalid.example")
        : "missing@invalid.example";
    } else email = z.email().parse(email);
    if (body.action === "reset") {
      if (email !== "missing@invalid.example")
        await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${new URL(request.url).origin}/auth/callback?next=/settings`,
        });
      return NextResponse.json({
        message:
          "Si existe una cuenta, recibirás un enlace para establecer una contraseña.",
      });
    }
    const password = z.string().min(1).max(128).parse(body.password);
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error)
      throw new HttpError(
        401,
        "Usuario o contraseña incorrectos, o correo pendiente de confirmación.",
      );
    return NextResponse.json({ signedIn: true });
  } catch (e) {
    return failure(e);
  }
}
