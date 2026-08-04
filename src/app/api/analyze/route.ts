import { isInsideCostaRicaBounds } from "@/lib/costa-rica";
import { analyzeSite } from "@/lib/analysis";
import type { AnalysisRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (!contentType.includes("application/json")) {
    return Response.json(
      { error: "La solicitud debe usar application/json." },
      { status: 415 },
    );
  }

  if (contentLength > 4096) {
    return Response.json({ error: "Solicitud demasiado grande." }, { status: 413 });
  }

  let body: Partial<AnalysisRequest>;
  try {
    body = (await request.json()) as Partial<AnalysisRequest>;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json(
      { error: "Latitud y longitud son obligatorias." },
      { status: 400 },
    );
  }

  if (!isInsideCostaRicaBounds({ lat, lng })) {
    return Response.json(
      { error: "Seleccioná un punto dentro de la región de Costa Rica." },
      { status: 422 },
    );
  }

  try {
    const result = await analyzeSite({ lat, lng, name: body.name });
    return Response.json(result, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch {
    return Response.json(
      { error: "No fue posible completar el análisis en este momento." },
      { status: 502 },
    );
  }
}

