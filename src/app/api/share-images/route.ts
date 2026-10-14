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
import { socialCards, publicationText } from "@/lib/social";
import { service } from "@/lib/supabase/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db, user } = await authenticated();
    const { documentId } = z
      .object({ documentId: z.uuid() })
      .parse(await boundedJson(request));
    const result = await db
      .from("publications")
      .select("*")
      .eq("document_id", documentId)
      .eq("owner_id", user.id)
      .maybeSingle();
    check(result.error);
    if (!result.data)
      throw new HttpError(
        404,
        "Publica una versión de lectura antes de exportar las imágenes.",
      );
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
    const cards = await socialCards(p.title, text, p.appearance.ink);
    return NextResponse.json(
      {
        title: p.title,
        text,
        images: cards.map(
          (card) => `data:image/jpeg;base64,${card.toString("base64")}`,
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
