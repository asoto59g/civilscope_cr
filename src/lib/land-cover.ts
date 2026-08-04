import "server-only";

import type { AnalysisRequest, LandCoverAnalysis } from "@/lib/types";

export const SINIA_MAF2020_WMS_URL =
  "https://geodatos.sinia.go.cr/geoserver/MAF2020/wms";

const QUERY_TIMEOUT_MS = 10_000;
const HALF_EXTENT_DEGREES = 0.0005;
const MAP_SIZE_PX = 101;
const CENTER_PIXEL = 50;
const REFERENCE_YEAR = 2020;
const RESOLUTION_M = 10;

type MafFeature = {
  properties?: {
    CATEGORIA?: unknown;
    value?: unknown;
  };
};

type MafResponse = {
  features?: MafFeature[];
};

function text(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function number(value: unknown) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function emptyLandCover(): LandCoverAnalysis {
  return {
    available: false,
    category: null,
    classCode: null,
    referenceYear: REFERENCE_YEAR,
    resolutionM: RESOLUTION_M,
  };
}

function buildFeatureInfoUrl({ lat, lng }: AnalysisRequest) {
  const centerLat = Number(lat.toFixed(5));
  const centerLng = Number(lng.toFixed(5));
  const bbox = [
    centerLng - HALF_EXTENT_DEGREES,
    centerLat - HALF_EXTENT_DEGREES,
    centerLng + HALF_EXTENT_DEGREES,
    centerLat + HALF_EXTENT_DEGREES,
  ]
    .map((value) => value.toFixed(6))
    .join(",");
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetFeatureInfo",
    LAYERS: "MAF2020",
    QUERY_LAYERS: "MAF2020",
    STYLES: "",
    CRS: "CRS:84",
    BBOX: bbox,
    WIDTH: String(MAP_SIZE_PX),
    HEIGHT: String(MAP_SIZE_PX),
    I: String(CENTER_PIXEL),
    J: String(CENTER_PIXEL),
    FORMAT: "image/png",
    INFO_FORMAT: "application/json",
    FEATURE_COUNT: "1",
    PROPERTYNAME: "CATEGORIA,value",
  });

  return SINIA_MAF2020_WMS_URL + "?" + params.toString();
}

export async function loadLandCover(
  request: AnalysisRequest,
): Promise<LandCoverAnalysis> {
  const response = await fetch(buildFeatureInfoUrl(request), {
    headers: { Accept: "application/json" },
    cache: "force-cache",
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error("Mapa agropecuario SINIA respondió " + response.status);
  }

  const payload = (await response.json()) as MafResponse;
  if (!Array.isArray(payload.features)) {
    throw new Error("Respuesta de cobertura MAF2020 inválida.");
  }

  const properties = payload.features[0]?.properties;
  const category = text(properties?.CATEGORIA);
  if (!category) return emptyLandCover();

  return {
    available: true,
    category,
    classCode: number(properties?.value),
    referenceYear: REFERENCE_YEAR,
    resolutionM: RESOLUTION_M,
  };
}
