import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticated,
  check,
  sameOrigin,
  failure,
  HttpError,
  boundedJson,
} from "@/lib/http";
import { publicationText } from "@/lib/social";
import { service } from "@/lib/supabase/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db, user } = await authenticated();
    const { documentId } = z
      .object({ documentId: z.uuid() })
      .parse(await boundedJson(request));
    const result = await db
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("owner_id", user.id)
      .maybeSingle();
    check(result.error);
    if (!result.data) throw new HttpError(404, "Escrito no disponible.");
    const limit = await service().rpc("consume_auth_attempt", {
      attempt_key: `export:${user.id}`,
    });
    check(limit.error);
    if (!limit.data)
      throw new HttpError(
        429,
        "Has alcanzado el límite de exportaciones. Inténtalo de nuevo en 15 minutos.",
      );
    const p = result.data;
    const text = [publicationText(p.content).trim(), p.signature]
      .filter(Boolean)
      .join("\n\n");
    return NextResponse.json(
      {
        title: p.title,
        text,
        document: p,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
