import "server-only";

import type {
  AnalysisRequest,
  ClimateHistoryAnalysis,
  ClimateMonthRecord,
  PrecipitationDayAverage,
  PrecipitationMonthAverage,
  SeismicHistoryAnalysis,
  SeismicYearRecord,
} from "@/lib/types";

const FETCH_TIMEOUT_MS = 10_000;
const CLIMATESERV_BASE_URL = "https://climateserv.servirglobal.net/api";
const CLIMATESERV_REQUEST_TIMEOUT_MS = 15_000;
const CLIMATESERV_JOB_TIMEOUT_MS = 50_000;
const CLIMATESERV_POLL_INTERVAL_MS = 750;
const CHIRPS_HISTORY_YEARS = 10;
const CHIRPS_POINT_HALF_SIZE_DEG = 0.001;
const CHIRPS_CACHE_TTL_MS = 21_600_000;
const CHIRPS_CACHE_MAX_ENTRIES = 100;

type HistoricalWeatherResponse = {
  daily?: {
    time?: string[];
    temperature_2m_mean?: number[];
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
  wind: number[];
  radiation: number[];
  soilMoisture: number[];
};

type ClimateServRecord = {
  year?: number;
  month?: number;
  day?: number;
  value?: { avg?: number | null };
  raw_value?: number | null;
};

type ClimateServData = {
  data?: ClimateServRecord[];
  errMsg?: string;
};

type Era5History = Pick<
  ClimateHistoryAnalysis,
  "periodStart" | "periodEnd" | "model" | "months" | "temperatureMeanC"
>;

type ChirpsHistory = Pick<
  ClimateHistoryAnalysis,
  | "precipitationPeriodStart"
  | "precipitationPeriodEnd"
  | "precipitationModel"
  | "precipitationYears"
  | "precipitationResolutionKm"
  | "precipitationMonthlyAverage"
  | "precipitationDailyAverage"
  | "annualAveragePrecipitationMm"
  | "wettestMonth"
>;

const chirpsCache = new Map<
  string,
  { expiresAt: number; value: ChirpsHistory }
>();

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

function validPrecipitation(
  value: number | null | undefined,
): value is number {
  return valid(value) && value >= 0 && value < 2_000;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
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

function unpackClimateServ(value: unknown) {
  let current = value;

  for (let attempt = 0; attempt < 3 && typeof current === "string"; attempt += 1) {
    try {
      current = JSON.parse(current) as unknown;
    } catch {
      break;
    }
  }

  return current;
}

async function fetchClimateServ(
  method: string,
  params: URLSearchParams,
  timeoutMs = CLIMATESERV_REQUEST_TIMEOUT_MS,
) {
  const response = await fetch(
    `${CLIMATESERV_BASE_URL}/${method}/?${params}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    },
  );

  if (!response.ok) {
    throw new Error(`ClimateSERV respondió ${response.status}`);
  }

  return unpackClimateServ(await response.text());
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function loadChirpsPeriod(
  lat: number,
  lng: number,
  startYear: number,
  endYear: number,
) {
  const delta = CHIRPS_POINT_HALF_SIZE_DEG;
  const geometry = {
    type: "Polygon",
    coordinates: [
      [
        [lng - delta, lat - delta],
        [lng + delta, lat - delta],
        [lng + delta, lat + delta],
        [lng - delta, lat + delta],
        [lng - delta, lat - delta],
      ],
    ],
  };
  const submitParams = new URLSearchParams({
    datatype: "0",
    begintime: `01/01/${startYear}`,
    endtime: `12/31/${endYear}`,
    intervaltype: "0",
    operationtype: "5",
    dateType_Category: "default",
    isZip_CurrentDataType: "false",
    geometry: JSON.stringify(geometry),
  });
  const submitted = await fetchClimateServ("submitDataRequest", submitParams);
  const jobId = Array.isArray(submitted) ? submitted[0] : submitted;

  if (typeof jobId !== "string" || !/^[0-9a-f-]{36}$/i.test(jobId)) {
    throw new Error("ClimateSERV no devolvió un identificador válido");
  }

  const deadline = Date.now() + CLIMATESERV_JOB_TIMEOUT_MS;
  let progress = 0;

  while (progress < 100 && Date.now() < deadline) {
    await wait(CLIMATESERV_POLL_INTERVAL_MS);
    const progressParams = new URLSearchParams({ id: jobId });
    const progressPayload = await fetchClimateServ(
      "getDataRequestProgress",
      progressParams,
    );
    const progressValue = Array.isArray(progressPayload)
      ? progressPayload[0]
      : progressPayload;
    progress = Number(progressValue);

    if (!Number.isFinite(progress) || progress < 0) {
      throw new Error("ClimateSERV rechazó la consulta CHIRPS");
    }
  }

  if (progress < 100) {
    throw new Error("ClimateSERV agotó el tiempo para la consulta CHIRPS");
  }

  const dataParams = new URLSearchParams({ id: jobId });
  const dataPayload = (await fetchClimateServ(
    "getDataFromRequest",
    dataParams,
  )) as ClimateServData;

  if (!Array.isArray(dataPayload?.data) || dataPayload.errMsg) {
    throw new Error(dataPayload?.errMsg || "Serie CHIRPS incompleta");
  }

  return dataPayload.data;
}

function setChirpsCache(key: string, value: ChirpsHistory) {
  if (chirpsCache.size >= CHIRPS_CACHE_MAX_ENTRIES) {
    const oldestKey = chirpsCache.keys().next().value;
    if (typeof oldestKey === "string") chirpsCache.delete(oldestKey);
  }

  chirpsCache.set(key, {
    expiresAt: Date.now() + CHIRPS_CACHE_TTL_MS,
    value,
  });
}

async function loadChirpsHistory({
  lat,
  lng,
}: AnalysisRequest): Promise<ChirpsHistory> {
  const endYear = new Date().getUTCFullYear() - 1;
  const startYear = endYear - CHIRPS_HISTORY_YEARS + 1;
  const midpointYear = startYear + Math.floor(CHIRPS_HISTORY_YEARS / 2) - 1;
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${startYear}-${endYear}`;
  const cached = chirpsCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) chirpsCache.delete(cacheKey);

  const periods = await Promise.all([
    loadChirpsPeriod(lat, lng, startYear, midpointYear),
    loadChirpsPeriod(lat, lng, midpointYear + 1, endYear),
  ]);
  const records = periods.flat();
  const expectedYears = Array.from(
    { length: CHIRPS_HISTORY_YEARS },
    (_, index) => startYear + index,
  );
  const yearDayCounts = new Map<number, number>();
  const yearlyTotals = new Map<number, number>();
  const monthlyTotals = new Map<
    string,
    { total: number; days: number }
  >();
  const dailyBuckets = new Map<string, number[]>();

  for (const record of records) {
    const year = Number(record.year);
    const month = Number(record.month);
    const day = Number(record.day);
    const precipitation = record.value?.avg ?? record.raw_value;

    if (
      !expectedYears.includes(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31 ||
      !validPrecipitation(precipitation)
    ) {
      continue;
    }

    yearDayCounts.set(year, (yearDayCounts.get(year) ?? 0) + 1);
    yearlyTotals.set(year, (yearlyTotals.get(year) ?? 0) + precipitation);
    const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
    const monthly = monthlyTotals.get(yearMonth) ?? { total: 0, days: 0 };
    monthly.total += precipitation;
    monthly.days += 1;
    monthlyTotals.set(yearMonth, monthly);

    if (month === 2 && day === 29) continue;
    const calendarDay = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dailyValues = dailyBuckets.get(calendarDay) ?? [];
    dailyValues.push(precipitation);
    dailyBuckets.set(calendarDay, dailyValues);
  }

  const completeYears = expectedYears.filter(
    (year) => {
      const expectedDays = Math.round(
        (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000,
      );
      return (yearDayCounts.get(year) ?? 0) >= expectedDays;
    },
  );
  if (completeYears.length < CHIRPS_HISTORY_YEARS) {
    throw new Error("CHIRPS no devolvió diez años completos");
  }

  const precipitationMonthlyAverage: PrecipitationMonthAverage[] = Array.from(
    { length: 12 },
    (_, index) => {
      const month = index + 1;
      const totals = completeYears.flatMap((year) => {
        const key = `${year}-${String(month).padStart(2, "0")}`;
        const bucket = monthlyTotals.get(key);
        const expectedDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
        return bucket && bucket.days >= expectedDays ? [bucket.total] : [];
      });
      return {
        month,
        precipitationMm: round(average(totals)),
        sampleYears: totals.length,
      };
    },
  );
  const precipitationDailyAverage: PrecipitationDayAverage[] = [];
  const cursor = new Date(Date.UTC(2001, 0, 1));

  while (cursor.getUTCFullYear() === 2001) {
    const month = cursor.getUTCMonth() + 1;
    const day = cursor.getUTCDate();
    const key = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const values = dailyBuckets.get(key) ?? [];
    precipitationDailyAverage.push({
      dayOfYear: precipitationDailyAverage.length + 1,
      month,
      day,
      precipitationMm: round(average(values), 2),
      sampleYears: values.length,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const yearlyValues = completeYears.flatMap((year) => {
    const value = yearlyTotals.get(year);
    return value === undefined ? [] : [value];
  });
  const wettest = precipitationMonthlyAverage.reduce<PrecipitationMonthAverage | null>(
    (maximum, month) =>
      month.precipitationMm !== null &&
      (maximum === null ||
        maximum.precipitationMm === null ||
        month.precipitationMm > maximum.precipitationMm)
        ? month
        : maximum,
    null,
  );
  const result: ChirpsHistory = {
    precipitationPeriodStart: `${startYear}-01-01`,
    precipitationPeriodEnd: `${endYear}-12-31`,
    precipitationModel: "CHIRPS v2.0 Daily · 0,05° (~5,6 km) · ClimateSERV",
    precipitationYears: completeYears.length,
    precipitationResolutionKm: 5.6,
    precipitationMonthlyAverage,
    precipitationDailyAverage,
    annualAveragePrecipitationMm: round(average(yearlyValues), 0),
    wettestMonth: wettest?.month ?? null,
  };

  setChirpsCache(cacheKey, result);
  return result;
}

async function loadEra5History({
  lat,
  lng,
}: AnalysisRequest): Promise<Era5History> {
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
      "temperature_2m_mean,wind_speed_10m_max,shortwave_radiation_sum,soil_moisture_0_to_7cm_mean",
    timezone: "America/Costa_Rica",
    models: "era5_seamless",
  });
  const payload = await fetchJson<HistoricalWeatherResponse>(
    `https://archive-api.open-meteo.com/v1/archive?${params}`,
    21_600,
  );
  const daily = payload.daily;

  if (!daily?.time?.length) {
    throw new Error("Histórico ERA5 incompleto");
  }

  const buckets = new Map<string, MonthBucket>();
  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  ) {
    buckets.set(monthKey(cursor), {
      temperatures: [],
      wind: [],
      radiation: [],
      soilMoisture: [],
    });
  }

  daily.time.forEach((date, index) => {
    const bucket = buckets.get(date.slice(0, 7));
    if (!bucket) return;
    const temperature = daily.temperature_2m_mean?.[index];
    const wind = daily.wind_speed_10m_max?.[index];
    const radiation = daily.shortwave_radiation_sum?.[index];
    const soilMoisture = daily.soil_moisture_0_to_7cm_mean?.[index];
    if (valid(temperature)) bucket.temperatures.push(temperature);
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

  return {
    periodStart: isoDate(start),
    periodEnd: isoDate(end),
    model: "ERA5-Seamless · 11–28 km según variable",
    months,
    temperatureMeanC: round(average(allTemperatures)),
  };
}

export function emptyClimateHistory(): ClimateHistoryAnalysis {
  return {
    periodStart: "No disponible",
    periodEnd: "No disponible",
    model: "ERA5-Seamless",
    era5Available: false,
    months: [],
    temperatureMeanC: null,
    precipitationPeriodStart: "No disponible",
    precipitationPeriodEnd: "No disponible",
    precipitationModel: "CHIRPS v2.0 Daily",
    precipitationYears: 0,
    precipitationResolutionKm: 5.6,
    chirpsAvailable: false,
    precipitationMonthlyAverage: [],
    precipitationDailyAverage: [],
    annualAveragePrecipitationMm: null,
    wettestMonth: null,
  };
}

export async function loadClimateHistory(
  request: AnalysisRequest,
): Promise<ClimateHistoryAnalysis> {
  const [era5Result, chirpsResult] = await Promise.allSettled([
    loadEra5History(request),
    loadChirpsHistory(request),
  ]);

  if (era5Result.status === "rejected" && chirpsResult.status === "rejected") {
    throw new AggregateError(
      [era5Result.reason, chirpsResult.reason],
      "Histórico climático no disponible",
    );
  }

  return {
    ...emptyClimateHistory(),
    ...(era5Result.status === "fulfilled" ? era5Result.value : {}),
    ...(chirpsResult.status === "fulfilled" ? chirpsResult.value : {}),
    era5Available: era5Result.status === "fulfilled",
    chirpsAvailable: chirpsResult.status === "fulfilled",
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
