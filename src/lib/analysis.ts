import "server-only";

import {
  CADASTRE_WMS_URL,
  emptyCadastre,
  loadCadastre,
} from "@/lib/cadastre";
import { nearestProvince } from "@/lib/costa-rica";
import {
  emptyClimateHistory,
  emptySeismicHistory,
  loadClimateHistory,
  loadSeismicHistory,
} from "@/lib/history";
import {
  emptyLandValue,
  HACIENDA_LAND_VALUE_URL,
  loadLandValue,
} from "@/lib/land-value";
import {
  emptyLandCover,
  loadLandCover,
  SINIA_MAF2020_WMS_URL,
} from "@/lib/land-cover";
import { readIgnDemGrid } from "@/lib/terrain-dem";
import type {
  AnalysisRequest,
  AnalysisResult,
  DataSource,
  EnergyAnalysis,
  ForecastDay,
  RiskLevel,
  SeismicAnalysis,
  TerrainAnalysis,
  WeatherAnalysis,
} from "@/lib/types";

const FETCH_TIMEOUT_MS = 14_000;
const FALLBACK_TERRAIN_RESOLUTION_M = 90;
const IGN_TERRAIN_SOURCE = "MDE IGN 2017";
const FALLBACK_TERRAIN_SOURCE = "Copernicus DEM";

type Settled<T> = PromiseSettledResult<T>;

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    precipitation?: number;
  };
  hourly?: {
    time?: string[];
    soil_moisture_0_to_1cm?: number[];
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    shortwave_radiation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
};

type NasaPowerResponse = {
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
};

type UsgsFeature = {
  id: string;
  geometry?: { coordinates?: [number, number, number] };
  properties?: {
    mag?: number | null;
    place?: string;
    time?: number;
    url?: string;
  };
};

type UsgsResponse = { features?: UsgsFeature[] };

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Fuente externa respondió ${response.status}`);
  }

  return (await response.json()) as T;
}

function round(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value) && value > -900,
  );
  return valid.length
    ? valid.reduce((total, value) => total + value, 0) / valid.length
    : null;
}

function sum(values: Array<number | null | undefined>) {
  const valid = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return valid.length ? valid.reduce((total, value) => total + value, 0) : null;
}

function directionLabel(degrees: number | null) {
  if (degrees === null || !Number.isFinite(degrees)) return "Sin datos";
  const labels = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return labels[Math.round(degrees / 45) % 8];
}

function slopeClass(degrees: number | null) {
  if (degrees === null) return "Sin datos";
  if (degrees < 3) return "Plano";
  if (degrees < 8) return "Suave";
  if (degrees < 15) return "Moderado";
  if (degrees < 30) return "Fuerte";
  return "Escarpado";
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const earthRadiusKm = 6371;
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function dateCompact(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function terrainFromGrid(
  grid: number[],
  resolutionM: number,
  sourceName: string,
): TerrainAnalysis {
  const north = grid[1];
  const west = grid[3];
  const center = grid[4];
  const east = grid[5];
  const south = grid[7];
  const dzDx = (east - west) / (2 * resolutionM);
  const dzDy = (north - south) / (2 * resolutionM);
  const slope = (Math.atan(Math.hypot(dzDx, dzDy)) * 180) / Math.PI;
  const aspect =
    ((Math.atan2(-dzDx, -dzDy) * 180) / Math.PI + 360) % 360;

  return {
    sourceName,
    elevationM: round(center, 0),
    slopeDeg: round(slope, 1),
    slopeClass: slopeClass(slope),
    aspectDeg: round(aspect, 0),
    aspectLabel: directionLabel(aspect),
    reliefM: round(Math.max(...grid) - Math.min(...grid), 0),
    gridM: grid.map((value) => round(value, 0)),
    resolutionM,
  };
}

async function loadOpenMeteoTerrain({
  lat,
  lng,
}: AnalysisRequest): Promise<TerrainAnalysis> {
  const latStep = FALLBACK_TERRAIN_RESOLUTION_M / 111_320;
  const lngStep =
    FALLBACK_TERRAIN_RESOLUTION_M /
    (111_320 * Math.cos((lat * Math.PI) / 180));
  const points: Array<{ lat: number; lng: number }> = [];

  for (const y of [1, 0, -1]) {
    for (const x of [-1, 0, 1]) {
      points.push({ lat: lat + y * latStep, lng: lng + x * lngStep });
    }
  }

  const latitude = points.map((point) => point.lat.toFixed(6)).join(",");
  const longitude = points.map((point) => point.lng.toFixed(6)).join(",");
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`;
  const payload = await fetchJson<{ elevation?: number[] }>(url);
  const grid = payload.elevation?.slice(0, 9) ?? [];

  if (grid.length !== 9 || grid.some((value) => !Number.isFinite(value))) {
    throw new Error("Malla de elevación incompleta");
  }

  return terrainFromGrid(
    grid,
    FALLBACK_TERRAIN_RESOLUTION_M,
    FALLBACK_TERRAIN_SOURCE,
  );
}

async function loadTerrain(request: AnalysisRequest): Promise<TerrainAnalysis> {
  try {
    const terrain = await readIgnDemGrid(request);
    return terrainFromGrid(
      terrain.gridM,
      terrain.resolutionM,
      IGN_TERRAIN_SOURCE,
    );
  } catch {
    return loadOpenMeteoTerrain(request);
  }
}

async function loadWeather({ lat, lng }: AnalysisRequest): Promise<WeatherAnalysis> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    current: "temperature_2m,wind_speed_10m,wind_direction_10m,precipitation",
    hourly: "soil_moisture_0_to_1cm",
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_sum,shortwave_radiation_sum,wind_speed_10m_max",
    timezone: "America/Costa_Rica",
    forecast_days: "7",
    models: "ecmwf_ifs",
  });
  const payload = await fetchJson<OpenMeteoResponse>(
    `https://api.open-meteo.com/v1/forecast?${params}`,
  );

  const forecast: ForecastDay[] = (payload.daily?.time ?? []).map(
    (date, index) => ({
      date,
      temperatureMaxC: round(payload.daily?.temperature_2m_max?.[index] ?? null),
      temperatureMinC: round(payload.daily?.temperature_2m_min?.[index] ?? null),
      precipitationMm: round(payload.daily?.precipitation_sum?.[index] ?? null),
      radiationMjM2: round(payload.daily?.shortwave_radiation_sum?.[index] ?? null),
      windMaxKmh: round(payload.daily?.wind_speed_10m_max?.[index] ?? null),
    }),
  );
  const soil24h = (payload.hourly?.soil_moisture_0_to_1cm ?? []).slice(0, 24);
  const soilAverage = average(soil24h);
  const windDirection = payload.current?.wind_direction_10m ?? null;

  return {
    temperatureC: round(payload.current?.temperature_2m ?? null),
    windSpeedKmh: round(payload.current?.wind_speed_10m ?? null),
    windDirectionDeg: round(windDirection, 0),
    windDirectionLabel: directionLabel(windDirection),
    precipitationNowMm: round(payload.current?.precipitation ?? null),
    soilMoisturePct: round(soilAverage === null ? null : soilAverage * 100),
    precipitation7dMm: round(
      sum(forecast.map((day) => day.precipitationMm)),
    ),
    forecast,
  };
}

async function loadEnergy({ lat, lng }: AnalysisRequest): Promise<EnergyAnalysis> {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 7);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 89);
  const params = new URLSearchParams({
    parameters: "ALLSKY_SFC_SW_DWN,T2M,WS10M",
    community: "RE",
    longitude: lng.toString(),
    latitude: lat.toString(),
    start: dateCompact(start),
    end: dateCompact(end),
    format: "JSON",
    "time-standard": "UTC",
  });
  const payload = await fetchJson<NasaPowerResponse>(
    `https://power.larc.nasa.gov/api/temporal/daily/point?${params}`,
  );
  const parameters = payload.properties?.parameter ?? {};
  const solar = average(Object.values(parameters.ALLSKY_SFC_SW_DWN ?? {}));
  const temperature = average(Object.values(parameters.T2M ?? {}));
  const wind = average(Object.values(parameters.WS10M ?? {}));
  const pvYield = solar === null ? null : solar * 0.78;
  const potentialLabel =
    solar === null
      ? "Sin datos"
      : solar >= 5.5
        ? "Alto"
        : solar >= 4.2
          ? "Favorable"
          : "Moderado";

  return {
    solarRadiationKwhM2Day: round(solar, 2),
    temperatureAverageC: round(temperature),
    windAverageMs: round(wind),
    estimatedPvYieldKwhKwpDay: round(pvYield, 2),
    potentialLabel,
    period: `${start.toISOString().slice(0, 10)} — ${end.toISOString().slice(0, 10)}`,
  };
}

async function loadSeismic({ lat, lng }: AnalysisRequest): Promise<SeismicAnalysis> {
  const start = new Date();
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  const params = new URLSearchParams({
    format: "geojson",
    latitude: lat.toString(),
    longitude: lng.toString(),
    maxradiuskm: "250",
    minmagnitude: "2.5",
    starttime: start.toISOString().slice(0, 10),
    orderby: "time",
    limit: "200",
  });
  const payload = await fetchJson<UsgsResponse>(
    `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`,
  );

  const events = (payload.features ?? [])
    .map((feature) => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates) return null;
      const distanceKm = haversineKm(lat, lng, coordinates[1], coordinates[0]);
      return {
        id: feature.id,
        magnitude: round(feature.properties?.mag ?? null),
        place: feature.properties?.place ?? "Ubicación no indicada",
        time: new Date(feature.properties?.time ?? 0).toISOString(),
        depthKm: round(coordinates[2] ?? null),
        distanceKm: round(distanceKm, 0) ?? 0,
        url: feature.properties?.url ?? "https://earthquake.usgs.gov/",
      };
    })
    .filter((event): event is NonNullable<typeof event> => event !== null)
    .sort((a, b) => b.time.localeCompare(a.time));

  const maximumMagnitude = events.reduce<number | null>(
    (maximum, event) =>
      event.magnitude !== null && (maximum === null || event.magnitude > maximum)
        ? event.magnitude
        : maximum,
    null,
  );
  const nearestDistanceKm = events.length
    ? Math.min(...events.map((event) => event.distanceKm))
    : null;

  return {
    eventsLastYear: events.length,
    eventsWithin100Km: events.filter((event) => event.distanceKm <= 100).length,
    maximumMagnitude,
    nearestDistanceKm,
    events: events.slice(0, 8),
  };
}

function unavailableTerrain(): TerrainAnalysis {
  return {
    sourceName: "Sin datos",
    elevationM: null,
    slopeDeg: null,
    slopeClass: "Sin datos",
    aspectDeg: null,
    aspectLabel: "Sin datos",
    reliefM: null,
    gridM: Array(9).fill(null),
    resolutionM: FALLBACK_TERRAIN_RESOLUTION_M,
  };
}

function unavailableWeather(): WeatherAnalysis {
  return {
    temperatureC: null,
    windSpeedKmh: null,
    windDirectionDeg: null,
    windDirectionLabel: "Sin datos",
    precipitationNowMm: null,
    soilMoisturePct: null,
    precipitation7dMm: null,
    forecast: [],
  };
}

function unavailableEnergy(): EnergyAnalysis {
  return {
    solarRadiationKwhM2Day: null,
    temperatureAverageC: null,
    windAverageMs: null,
    estimatedPvYieldKwhKwpDay: null,
    potentialLabel: "Sin datos",
    period: "No disponible",
  };
}

function unavailableSeismic(): SeismicAnalysis {
  return {
    eventsLastYear: 0,
    eventsWithin100Km: 0,
    maximumMagnitude: null,
    nearestDistanceKm: null,
    events: [],
  };
}

function riskLevel(score: number): RiskLevel {
  return score >= 4 ? "Alto" : score >= 2 ? "Moderado" : "Bajo";
}

function buildAssessment(
  terrain: TerrainAnalysis,
  weather: WeatherAnalysis,
): AnalysisResult["assessment"] {
  let drainageScore = 0;
  if ((weather.precipitation7dMm ?? 0) >= 100) drainageScore += 2;
  else if ((weather.precipitation7dMm ?? 0) >= 50) drainageScore += 1;
  if ((weather.soilMoisturePct ?? 0) >= 35) drainageScore += 2;
  else if ((weather.soilMoisturePct ?? 0) >= 25) drainageScore += 1;
  if ((terrain.slopeDeg ?? 0) >= 15) drainageScore += 1;

  let terrainScore = 0;
  if ((terrain.slopeDeg ?? 0) >= 30) terrainScore += 4;
  else if ((terrain.slopeDeg ?? 0) >= 15) terrainScore += 2;
  else if ((terrain.slopeDeg ?? 0) >= 8) terrainScore += 1;
  if ((terrain.reliefM ?? 0) >= 60) terrainScore += 2;
  else if ((terrain.reliefM ?? 0) >= 30) terrainScore += 1;

  const notes = [
    `Pendiente estimada: ${terrain.slopeDeg ?? "s/d"}° (${terrain.slopeClass.toLowerCase()}).`,
    `Precipitación prevista a 7 días: ${weather.precipitation7dMm ?? "s/d"} mm.`,
    `Humedad volumétrica superficial: ${weather.soilMoisturePct ?? "s/d"}%.`,
  ];

  if (drainageScore >= 4) {
    notes.push("Priorizar revisión hidrológica, escorrentía y capacidad del drenaje.");
  }
  if (terrainScore >= 4) {
    notes.push("La topografía exige levantamiento de detalle y revisión geotécnica.");
  }

  return {
    drainageRisk: riskLevel(drainageScore),
    terrainSuitability: riskLevel(terrainScore),
    notes,
  };
}

function source(
  name: string,
  provider: string,
  result: Settled<unknown>,
  detail: string,
  url: string,
): DataSource {
  return {
    name,
    provider,
    status: result.status === "fulfilled" ? "live" : "unavailable",
    detail,
    url,
  };
}

function availabilitySource(
  name: string,
  provider: string,
  available: boolean,
  detail: string,
  url: string,
): DataSource {
  return {
    name,
    provider,
    status: available ? "live" : "unavailable",
    detail,
    url,
  };
}

function ignSource(terrain: TerrainAnalysis): DataSource {
  return {
    name: IGN_TERRAIN_SOURCE,
    provider: "Instituto Geográfico Nacional / SNIT",
    status:
      terrain.sourceName === IGN_TERRAIN_SOURCE ? "live" : "unavailable",
    detail:
      "Modelo nacional de elevación de 10 m para elevación, pendiente, orientación y relieve; WMTS disponible como capa de referencia.",
    url: "https://geos1.snitcr.go.cr/ModelosIGN/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities",
  };
}

export async function analyzeSite(request: AnalysisRequest): Promise<AnalysisResult> {
  const [
    terrainResult,
    weatherResult,
    climateHistoryResult,
    energyResult,
    landValueResult,
    cadastreResult,
    landCoverResult,
    seismicResult,
    seismicHistoryResult,
  ] = await Promise.allSettled([
    loadTerrain(request),
    loadWeather(request),
    loadClimateHistory(request),
    loadEnergy(request),
    loadLandValue(request),
    loadCadastre(request),
    loadLandCover(request),
    loadSeismic(request),
    loadSeismicHistory(request),
  ]);

  const terrain =
    terrainResult.status === "fulfilled" ? terrainResult.value : unavailableTerrain();
  const weather =
    weatherResult.status === "fulfilled" ? weatherResult.value : unavailableWeather();
  const climateHistory =
    climateHistoryResult.status === "fulfilled"
      ? climateHistoryResult.value
      : emptyClimateHistory();
  const energy =
    energyResult.status === "fulfilled" ? energyResult.value : unavailableEnergy();
  const landValue =
    landValueResult.status === "fulfilled"
      ? landValueResult.value
      : emptyLandValue();
  const cadastre =
    cadastreResult.status === "fulfilled"
      ? cadastreResult.value
      : emptyCadastre();
  const landCover =
    landCoverResult.status === "fulfilled"
      ? landCoverResult.value
      : emptyLandCover();
  const seismic =
    seismicResult.status === "fulfilled" ? seismicResult.value : unavailableSeismic();
  const seismicHistory =
    seismicHistoryResult.status === "fulfilled"
      ? seismicHistoryResult.value
      : emptySeismicHistory();
  const warnings: string[] = [];

  if (terrainResult.status === "rejected") warnings.push("Elevación no disponible temporalmente.");
  if (weatherResult.status === "rejected") warnings.push("Pronóstico no disponible temporalmente.");
  if (climateHistoryResult.status === "rejected") warnings.push("Histórico climático no disponible temporalmente.");
  if (
    climateHistoryResult.status === "fulfilled" &&
    !climateHistory.era5Available
  ) warnings.push("Histórico ERA5 no disponible temporalmente.");
  if (
    climateHistoryResult.status === "fulfilled" &&
    !climateHistory.chirpsAvailable
  ) warnings.push("Histórico de precipitación CHIRPS no disponible temporalmente.");
  if (energyResult.status === "rejected") warnings.push("Serie NASA POWER no disponible temporalmente.");
  if (landValueResult.status === "rejected") warnings.push("Valor fiscal de Hacienda no disponible temporalmente.");
  if (cadastreResult.status === "rejected") warnings.push("Información catastral del SNIT no disponible temporalmente.");
  if (landCoverResult.status === "rejected") warnings.push("Clasificación MAF2020 del SINIA no disponible temporalmente.");
  if (seismicResult.status === "rejected") warnings.push("Catálogo USGS no disponible temporalmente.");
  if (seismicHistoryResult.status === "rejected") warnings.push("Histórico sísmico no disponible temporalmente.");
  if (
    terrainResult.status === "fulfilled" &&
    terrain.sourceName === FALLBACK_TERRAIN_SOURCE
  ) {
    warnings.push("No se pudo leer el MDE IGN de 10 m; se usó el respaldo Copernicus de 90 m.");
  }

  const generatedAt = new Date().toISOString();
  return {
    id: `CIVILSCOPE-${generatedAt.slice(0, 10).replaceAll("-", "")}-${Math.abs(Math.round(request.lat * 1000))}`,
    generatedAt,
    location: {
      name: request.name?.trim().slice(0, 80) || "Sitio seleccionado",
      lat: round(request.lat, 5) ?? request.lat,
      lng: round(request.lng, 5) ?? request.lng,
      provinceHint: nearestProvince(request),
    },
    terrain,
    weather,
    climateHistory,
    energy,
    landValue,
    cadastre,
    landCover,
    seismic,
    seismicHistory,
    assessment: buildAssessment(terrain, weather),
    sources: [
      ignSource(terrain),
      ...(terrain.sourceName === FALLBACK_TERRAIN_SOURCE
        ? [
            source(
              FALLBACK_TERRAIN_SOURCE,
              "Copernicus / Open-Meteo",
              terrainResult,
              "Respaldo global de 90 m usado cuando el MDE nacional no está disponible.",
              "https://open-meteo.com/en/docs/elevation-api",
            ),
          ]
        : []),
      source(
        "Pronóstico ECMWF IFS HRES",
        "ECMWF / Open-Meteo",
        weatherResult,
        "Modelo ECMWF IFS HRES de 9 km para temperatura, viento, precipitación, radiación y humedad del suelo.",
        "https://open-meteo.com/en/docs/ecmwf-api",
      ),
      availabilitySource(
        "Histórico climático ERA5-Seamless",
        "Open-Meteo / Copernicus",
        climateHistory.era5Available,
        "Temperatura, viento, radiación y humedad superficial durante 24 meses completos.",
        "https://open-meteo.com/en/docs/historical-weather-api",
      ),
      availabilitySource(
        "Histórico de precipitación CHIRPS v2.0",
        "UCSB Climate Hazards Center / ClimateSERV",
        climateHistory.chirpsAvailable,
        "Precipitación diaria de 0,05° para climatologías mensuales y diarias de diez años completos.",
        "https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY",
      ),
      source(
        "POWER Daily",
        "NASA",
        energyResult,
        "Serie reciente de radiación solar, temperatura y viento.",
        "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
      ),
      source(
        "Zonas Homogéneas ONT",
        "Ministerio de Hacienda / Órgano de Normalización Técnica",
        landValueResult,
        "Valor fiscal de referencia del terreno en colones por metro cuadrado para la zona homogénea que contiene el punto.",
        HACIENDA_LAND_VALUE_URL,
      ),
      source(
        "Catastro Zona 1 y Zona 2",
        "Registro Inmobiliario / SNIT",
        cadastreResult,
        "Consulta puntual de plano, finca e identificador inmobiliario mediante WMS GetFeatureInfo; prioriza Zona 1 y usa Zona 2 como respaldo, sin descargar geometrías.",
        CADASTRE_WMS_URL + "?service=WMS&request=GetCapabilities",
      ),
      source(
        "Mapa agropecuario y forestal 2020",
        "MINAE / MAG / SINIA",
        landCoverResult,
        "Categoría de cobertura del punto en el mapa nacional de 2020 con resolución de 10 m.",
        SINIA_MAF2020_WMS_URL +
          "?service=WMS&version=1.3.0&request=GetCapabilities",
      ),
      source(
        "Earthquake Catalog",
        "USGS",
        seismicResult,
        "Eventos M2.5+ en 250 km durante los últimos 12 meses.",
        "https://earthquake.usgs.gov/fdsnws/event/1/",
      ),
      source(
        "Tendencia sísmica de 5 años",
        "USGS",
        seismicHistoryResult,
        "Conteos anuales de eventos M2.5+ dentro de 250 km y 100 km.",
        "https://earthquake.usgs.gov/fdsnws/event/1/",
      ),
    ],
    warnings,
    disclaimer:
      "Análisis público de prefactibilidad basado en fuentes nacionales y globales. El valor fiscal es una referencia zonal, la información catastral es indicativa y MAF2020 representa la cobertura observada en 2020; no constituyen avalúo, precio comercial, certificación registral ni zonificación legal vigente. No sustituye levantamiento topográfico, estudio geotécnico, hidrológico, ambiental ni criterio profesional responsable.",
  };
}

