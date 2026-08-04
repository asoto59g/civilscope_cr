import "server-only";

import proj4 from "proj4";

import type {
  AnalysisRequest,
  CneHazardAnalysis,
  CneHazardKey,
  CneHazardLayerResult,
} from "@/lib/types";

export const CNE_WFS_URL = "http://mapas.cne.go.cr/servicios/cne/wfs";

const CRTM05_DEFINITION =
  "+proj=tmerc +lat_0=0 +lon_0=-84 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-0.16959,0.35312,0.51846,-0.03385,0.16325,-0.03446,0.03693 +units=m +no_defs +type=crs";
const QUERY_TIMEOUT_MS = 12_000;

const CNE_HAZARD_LAYERS = [
  {
    key: "landslides",
    label: "Deslizamientos",
    typeName: "cne:deslizamientos",
  },
  {
    key: "zmtLidarFlooding",
    label: "Inundación ZMT con Lidar",
    typeName: "cne:Inundaciones_lidar",
  },
  {
    key: "potentialFlooding",
    label: "Áreas con potencial de inundación",
    typeName: "cne:inundaciones",
  },
] as const satisfies ReadonlyArray<{
  key: CneHazardKey;
  label: string;
  typeName: string;
}>;

function emptyLayers(): CneHazardLayerResult[] {
  return CNE_HAZARD_LAYERS.map(({ key, label }) => ({
    key,
    label,
    intersects: null,
  }));
}

export function emptyCneHazards(): CneHazardAnalysis {
  return {
    available: false,
    intersectsAny: false,
    layers: emptyLayers(),
  };
}

function buildHitsUrl(typeName: string, x: number, y: number) {
  const halfExtentM = 0.01;
  const bbox = [
    x - halfExtentM,
    y - halfExtentM,
    x + halfExtentM,
    y + halfExtentM,
  ]
    .map((value) => value.toFixed(3))
    .join(",");
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName,
    resultType: "hits",
    srsName: "EPSG:5367",
    bbox: bbox + ",EPSG:5367",
  });
  return CNE_WFS_URL + "?" + params.toString();
}

async function intersectsLayer(typeName: string, x: number, y: number) {
  const response = await fetch(buildHitsUrl(typeName, x, y), {
    headers: { Accept: "application/xml,text/xml" },
    cache: "force-cache",
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error("WFS de la CNE respondió " + response.status);
  }

  const body = await response.text();
  if (/ServiceException|ExceptionReport/i.test(body)) {
    throw new Error("El WFS de la CNE rechazó el filtro espacial.");
  }

  const match = body.match(/numberOfFeatures=["'](\d+)["']/i);
  if (!match) {
    throw new Error("Respuesta WFS de la CNE inválida.");
  }

  return Number(match[1]) > 0;
}

export async function loadCneHazards(
  { lat, lng }: AnalysisRequest,
): Promise<CneHazardAnalysis> {
  const [x, y] = proj4("WGS84", CRTM05_DEFINITION, [lng, lat]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("No fue posible transformar el punto a EPSG:5367.");
  }

  const settled = await Promise.allSettled(
    CNE_HAZARD_LAYERS.map(({ typeName }) =>
      intersectsLayer(typeName, x, y),
    ),
  );
  const layers = CNE_HAZARD_LAYERS.map(({ key, label }, index) => ({
    key,
    label,
    intersects:
      settled[index].status === "fulfilled" ? settled[index].value : null,
  }));

  return {
    available: layers.every(({ intersects }) => intersects !== null),
    intersectsAny: layers.some(({ intersects }) => intersects === true),
    layers,
  };
}
