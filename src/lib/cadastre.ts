import "server-only";

import proj4 from "proj4";

import type {
  AnalysisRequest,
  CadastreAnalysis,
  CadastreParcel,
  CadastreZone,
} from "@/lib/types";

export const CADASTRE_WMS_URL =
  "https://siri.snitcr.go.cr/Geoservicios/wms";

const CRS_8908_DEFINITION =
  "+proj=tmerc +lat_0=0 +lon_0=-84 +k=0.9999 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs";
const QUERY_TIMEOUT_MS = 10_000;
const HALF_EXTENT_M = 25;
const MAP_SIZE_PX = 101;
const CENTER_PIXEL = 50;

type WmsProperties = {
  plano?: string | number | null;
  finca?: string | number | null;
  identifica?: string | number | null;
  provincia?: string | number | null;
  canton?: string | number | null;
  distrito?: string | number | null;
  duplicado?: string | number | boolean | null;
  horizontal?: string | number | boolean | null;
  compatible?: string | number | boolean | null;
};

type WmsFeature = {
  id?: string;
  properties?: WmsProperties;
};

type WmsResponse = {
  features?: WmsFeature[];
};

function text(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function flag(value: string | number | boolean | null | undefined) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return null;
}

export function emptyCadastre(): CadastreAnalysis {
  return {
    available: false,
    ambiguous: false,
    matches: [],
  };
}

function zoneFromFeatureId(featureId: string): CadastreZone {
  return featureId.startsWith("catastro_aldia.") ? "Zona 2" : "Zona 1";
}

function parcelFromFeature(
  feature: WmsFeature,
  index: number,
): CadastreParcel | null {
  if (!feature.properties) return null;
  const zone = zoneFromFeatureId(feature.id ?? "");
  const identifier = text(feature.properties.identifica);
  const propertyNumber = text(feature.properties.finca);
  const planNumber = text(feature.properties.plano);

  return {
    featureId:
      feature.id ??
      [zone, identifier, propertyNumber, planNumber, index].join("-"),
    zone,
    planNumber,
    propertyNumber,
    identifier,
    provinceCode: text(feature.properties.provincia),
    cantonCode: text(feature.properties.canton)?.padStart(2, "0") ?? null,
    districtCode: text(feature.properties.distrito)?.padStart(2, "0") ?? null,
    duplicate: flag(feature.properties.duplicado),
    horizontal: flag(feature.properties.horizontal),
    compatible: flag(feature.properties.compatible),
  };
}

function uniqueParcels(features: WmsFeature[]) {
  const matches: CadastreParcel[] = [];
  const seen = new Set<string>();

  features.forEach((feature, index) => {
    const parcel = parcelFromFeature(feature, index);
    if (!parcel || seen.has(parcel.featureId)) return;
    seen.add(parcel.featureId);
    matches.push(parcel);
  });

  return matches;
}

function buildFeatureInfoUrl({ lat, lng }: AnalysisRequest) {
  const [rawX, rawY] = proj4("WGS84", CRS_8908_DEFINITION, [lng, lat]);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
    throw new Error("No fue posible transformar el punto a EPSG:8908.");
  }

  const x = Math.round(rawX * 10) / 10;
  const y = Math.round(rawY * 10) / 10;
  const bbox = [
    x - HALF_EXTENT_M,
    y - HALF_EXTENT_M,
    x + HALF_EXTENT_M,
    y + HALF_EXTENT_M,
  ]
    .map((value) => value.toFixed(3))
    .join(",");
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetFeatureInfo",
    LAYERS: "catastro,catastro_aldia",
    QUERY_LAYERS: "catastro,catastro_aldia",
    STYLES: "",
    SRS: "EPSG:8908",
    BBOX: bbox,
    WIDTH: String(MAP_SIZE_PX),
    HEIGHT: String(MAP_SIZE_PX),
    X: String(CENTER_PIXEL),
    Y: String(CENTER_PIXEL),
    FORMAT: "image/png",
    INFO_FORMAT: "application/json",
    FEATURE_COUNT: "10",
    PROPERTYNAME:
      "plano,finca,identifica,provincia,canton,distrito,duplicado,horizontal,compatible",
  });

  return CADASTRE_WMS_URL + "?" + params.toString();
}

export async function loadCadastre(
  request: AnalysisRequest,
): Promise<CadastreAnalysis> {
  const response = await fetch(buildFeatureInfoUrl(request), {
    headers: { Accept: "application/json" },
    cache: "force-cache",
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error("Catastro SNIT respondió " + response.status);
  }

  const payload = (await response.json()) as WmsResponse;
  if (!Array.isArray(payload.features)) {
    throw new Error("Respuesta catastral inválida.");
  }

  const matches = uniqueParcels(payload.features);
  return {
    available: matches.length > 0,
    ambiguous: matches.length > 1,
    matches,
  };
}
