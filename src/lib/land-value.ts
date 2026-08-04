import 'server-only';

import type { AnalysisRequest, LandValueAnalysis } from '@/lib/types';

export const HACIENDA_LAND_VALUE_URL =
  'https://sig.hacienda.go.cr/server/rest/services/Zonas_Homogeneas_ONT/MapServer/0';

const QUERY_TIMEOUT_MS = 10_000;

type HaciendaAttributes = {
  PROVINCIA?: string | number | null;
  CANTON?: string | number | null;
  DISTRITO?: string | number | null;
  COD_ZONAH?: string | null;
  NOMBRE_ZONAH?: string | null;
  TIPO_DE_USO?: string | null;
  VALOR?: number | string | null;
};

type HaciendaResponse = {
  error?: { message?: string };
  features?: Array<{ attributes?: HaciendaAttributes }>;
};

function text(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

export function emptyLandValue(): LandValueAnalysis {
  return {
    available: false,
    valueCrcM2: null,
    zoneCode: null,
    zoneName: null,
    landUseCode: null,
    territorialCode: null,
    provinceCode: null,
    cantonCode: null,
    districtCode: null,
  };
}

function landValueFromPayload(payload: HaciendaResponse): LandValueAnalysis {
  if (payload.error) {
    throw new Error('Consulta de Hacienda invalida');
  }
  const attributes = payload.features?.[0]?.attributes;
  if (!attributes) return emptyLandValue();
  return landValueFromAttributes(attributes);
}

function landValueFromAttributes(
  attributes: HaciendaAttributes,
): LandValueAnalysis {
  const provinceCode = text(attributes.PROVINCIA);
  const cantonCode = text(attributes.CANTON)?.padStart(2, '0') ?? null;
  const districtCode = text(attributes.DISTRITO)?.padStart(2, '0') ?? null;
  const zoneCode = text(attributes.COD_ZONAH);
  const numericValue = Number(attributes.VALOR);
  const territorialCode =
    provinceCode && cantonCode && districtCode && zoneCode
      ? provinceCode + cantonCode + '-' + districtCode + '-' + zoneCode
      : zoneCode;

  return {
    available: true,
    valueCrcM2: Number.isFinite(numericValue) ? numericValue : null,
    zoneCode,
    zoneName: text(attributes.NOMBRE_ZONAH),
    landUseCode: text(attributes.TIPO_DE_USO),
    territorialCode,
    provinceCode,
    cantonCode,
    districtCode,
  };
}

export async function loadLandValue({
  lat,
  lng,
}: AnalysisRequest): Promise<LandValueAnalysis> {
  const params = new URLSearchParams({
    f: 'json',
    geometry: String(lng) + ',' + String(lat),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields:
      'PROVINCIA,CANTON,DISTRITO,COD_ZONAH,NOMBRE_ZONAH,TIPO_DE_USO,VALOR',
    returnGeometry: 'false',
    resultRecordCount: '2',
  });
  const response = await fetch(
    HACIENDA_LAND_VALUE_URL + '/query?' + params.toString(),
    {
      headers: { Accept: 'application/json' },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error('Hacienda respondio ' + response.status);
  }

  return landValueFromPayload((await response.json()) as HaciendaResponse);
}
