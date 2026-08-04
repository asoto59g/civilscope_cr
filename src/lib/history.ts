import "server-only";

import type {
  AnalysisRequest,
  ClimateHistoryAnalysis,
  ClimateMonthRecord,
  SeismicHistoryAnalysis,
  SeismicYearRecord,
} from "@/lib/types";

const FETCH_TIMEOUT_MS = 18_000;

type HistoricalWeatherResponse = {
  daily?: {
    time?: string[];
    temperature_2m_mean?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
    shortwave_radiation_sum?: number[];
    soil_moisture_0_to_7cm_mean?: number[];
  };
};

type HistoricalUsgsResponse = {
  features?: Array<{
    geometry?: { coordinates?: [number, number, number] };
    properties?: { mag?: number | null; time?: number };
  }>;
};

type MonthBucket = {
  temperatures: number[];
  precipitation: number[];
  wind: number[];
  radiation: number[];
  soilMoisture: number[];
};

async function fetchJson<T>(url: string, revalidate: number): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Fuente histórica respondió ${response.status}`);
  }

  return (await response.json()) as T;
}

function round(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function valid(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > -900;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function sum(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
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

export function emptyClimateHistory(): ClimateHistoryAnalysis {
  return {
    periodStart: "No disponible",
    periodEnd: "No disponible",
    model: "ERA5-Seamless",
    months: [],
    temperatureMeanC: null,
    annualizedPrecipitationMm: null,
    wettestMonth: null,
  };
}

export async function loadClimateHistory({
  lat,
  lng,
}: AnalysisRequest): Promise<ClimateHistoryAnalysis> {
  const today = new Date();
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 0),
  );
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 23, 1),
  );
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    start_date: isoDate(start),
    end_date: isoDate(end),
    daily:
      "temperature_2m_mean,precipitation_sum,wind_speed_10m_max,shortwave_radiation_sum,soil_moisture_0_to_7cm_mean",
    timezone: "America/Costa_Rica",
    models: "era5_seamless",
  });
  const payload = await fetchJson<HistoricalWeatherResponse>(
    `https://archive-api.open-meteo.com/v1/archive?${params}`,
    21_600,
  );
  const daily = payload.daily;

  if (!daily?.time?.length) {
    throw new Error("Histórico climático incompleto");
  }

  const buckets = new Map<string, MonthBucket>();
  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  ) {
    buckets.set(monthKey(cursor), {
      temperatures: [],
      precipitation: [],
      wind: [],
      radiation: [],
      soilMoisture: [],
    });
  }

  daily.time.forEach((date, index) => {
    const bucket = buckets.get(date.slice(0, 7));
    if (!bucket) return;
    const temperature = daily.temperature_2m_mean?.[index];
    const precipitation = daily.precipitation_sum?.[index];
    const wind = daily.wind_speed_10m_max?.[index];
    const radiation = daily.shortwave_radiation_sum?.[index];
    const soilMoisture = daily.soil_moisture_0_to_7cm_mean?.[index];
    if (valid(temperature)) bucket.temperatures.push(temperature);
    if (valid(precipitation)) bucket.precipitation.push(precipitation);
    if (valid(wind)) bucket.wind.push(wind);
    if (valid(radiation)) bucket.radiation.push(radiation);
    if (valid(soilMoisture)) bucket.soilMoisture.push(soilMoisture);
  });

  const months: ClimateMonthRecord[] = Array.from(buckets.entries()).map(
    ([month, bucket]) => {
      const soilMoisture = average(bucket.soilMoisture);
      return {
        month,
        temperatureMeanC: round(average(bucket.temperatures)),
        precipitationMm: round(sum(bucket.precipitation), 0),
        windMaxAverageKmh: round(average(bucket.wind)),
        solarRadiationAverageMjM2: round(average(bucket.radiation)),
        soilMoistureAveragePct: round(
          soilMoisture === null ? null : soilMoisture * 100,
        ),
      };
    },
  );
  const allTemperatures = Array.from(buckets.values()).flatMap(
    (bucket) => bucket.temperatures,
  );
  const monthlyPrecipitation = months
    .map((month) => month.precipitationMm)
    .filter((value): value is number => value !== null);
  const totalPrecipitation = sum(monthlyPrecipitation);
  const wettest = months.reduce<ClimateMonthRecord | null>(
    (maximum, month) =>
      month.precipitationMm !== null &&
      (maximum?.precipitationMm === null ||
        maximum === null ||
        month.precipitationMm > maximum.precipitationMm)
        ? month
        : maximum,
    null,
  );

  return {
    periodStart: isoDate(start),
    periodEnd: isoDate(end),
    model: "ERA5-Seamless · 11–28 km según variable",
    months,
    temperatureMeanC: round(average(allTemperatures)),
    annualizedPrecipitationMm: round(
      totalPrecipitation === null
        ? null
        : totalPrecipitation * (12 / months.length),
      0,
    ),
    wettestMonth: wettest?.month ?? null,
  };
}

export function emptySeismicHistory(): SeismicHistoryAnalysis {
  return {
    periodStart: "No disponible",
    periodEnd: "No disponible",
    years: [],
    totalEvents: 0,
    maximumMagnitude: null,
  };
}

export async function loadSeismicHistory({
  lat,
  lng,
}: AnalysisRequest): Promise<SeismicHistoryAnalysis> {
  const now = new Date();
  const endYear = now.getUTCFullYear() - 1;
  const startYear = endYear - 4;
  const start = `${startYear}-01-01`;
  const end = `${endYear}-12-31`;
  const endExclusive = `${endYear + 1}-01-01`;
  const params = new URLSearchParams({
    format: "geojson",
    latitude: lat.toString(),
    longitude: lng.toString(),
    maxradiuskm: "250",
    minmagnitude: "2.5",
    starttime: start,
    endtime: endExclusive,
    orderby: "time",
    limit: "20000",
  });
  const payload = await fetchJson<HistoricalUsgsResponse>(
    `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`,
    900,
  );
  const years = new Map<number, SeismicYearRecord>();
  for (let year = startYear; year <= endYear; year += 1) {
    years.set(year, {
      year,
      count: 0,
      within100Km: 0,
      maximumMagnitude: null,
    });
  }

  for (const feature of payload.features ?? []) {
    const coordinates = feature.geometry?.coordinates;
    const time = feature.properties?.time;
    if (!coordinates || typeof time !== "number") continue;
    const record = years.get(new Date(time).getUTCFullYear());
    if (!record) continue;
    const magnitude = feature.properties?.mag ?? null;
    const distanceKm = haversineKm(
      lat,
      lng,
      coordinates[1],
      coordinates[0],
    );
    record.count += 1;
    if (distanceKm <= 100) record.within100Km += 1;
    if (
      typeof magnitude === "number" &&
      Number.isFinite(magnitude) &&
      (record.maximumMagnitude === null || magnitude > record.maximumMagnitude)
    ) {
      record.maximumMagnitude = round(magnitude);
    }
  }

  const yearRecords = Array.from(years.values());
  const magnitudes = yearRecords
    .map((year) => year.maximumMagnitude)
    .filter((value): value is number => value !== null);

  return {
    periodStart: start,
    periodEnd: end,
    years: yearRecords,
    totalEvents: yearRecords.reduce((total, year) => total + year.count, 0),
    maximumMagnitude: magnitudes.length ? Math.max(...magnitudes) : null,
  };
}
