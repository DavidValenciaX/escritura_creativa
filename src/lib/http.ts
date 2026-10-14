import { NextResponse } from "next/server";
import { supabase } from "./supabase/server";
import { ZodError } from "zod";
import { HttpError } from "./errors";
export { HttpError } from "./errors";
export async function boundedJson(
  request: Request,
  limit = 8000,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Faltan los datos.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "Solicitud demasiado grande.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Datos inválidos.");
  }
}
export async function authenticated() {
  const db = await supabase();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new HttpError(401, "Inicia sesión para continuar.");
  return { db, user };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new HttpError(403, "Origen no permitido.");
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error:
          "Revisa los datos: " + error.issues.map((i) => i.message).join(", "),
      },
      { status: 400 },
    );
  console.error(
    "Request failed",
    error instanceof Error ? error.message : "unknown",
  );
  return NextResponse.json(
    {
      error:
        "No se pudo completar la operación. Revisa la configuración o vuelve a intentarlo.",
    },
    { status: 500 },
  );
}
export function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
