export type Coordinates = {
  lat: number;
  lng: number;
};

export type AnalysisRequest = Coordinates & {
  name?: string;
};

export type SourceStatus = "live" | "unavailable" | "requires-credentials";

export type DataSource = {
  name: string;
  provider: string;
  status: SourceStatus;
  detail: string;
  url: string;
};

export type TerrainAnalysis = {
  sourceName: string;
  elevationM: number | null;
  slopeDeg: number | null;
  slopeClass: string;
  aspectDeg: number | null;
  aspectLabel: string;
  reliefM: number | null;
  gridM: Array<number | null>;
  resolutionM: number;
};

export type ForecastDay = {
  date: string;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  precipitationMm: number | null;
  radiationMjM2: number | null;
  windMaxKmh: number | null;
};

export type WeatherAnalysis = {
  temperatureC: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  windDirectionLabel: string;
  precipitationNowMm: number | null;
  soilMoisturePct: number | null;
  precipitation7dMm: number | null;
  forecast: ForecastDay[];
};

export type ClimateMonthRecord = {
  month: string;
  temperatureMeanC: number | null;
  windMaxAverageKmh: number | null;
  solarRadiationAverageMjM2: number | null;
  soilMoistureAveragePct: number | null;
};

export type PrecipitationMonthAverage = {
  month: number;
  precipitationMm: number | null;
  sampleYears: number;
};

export type PrecipitationDayAverage = {
  dayOfYear: number;
  month: number;
  day: number;
  precipitationMm: number | null;
  sampleYears: number;
};

export type ClimateHistoryAnalysis = {
  periodStart: string;
  periodEnd: string;
  model: string;
  era5Available: boolean;
  months: ClimateMonthRecord[];
  temperatureMeanC: number | null;
  precipitationPeriodStart: string;
  precipitationPeriodEnd: string;
  precipitationModel: string;
  precipitationYears: number;
  precipitationResolutionKm: number;
  chirpsAvailable: boolean;
  precipitationMonthlyAverage: PrecipitationMonthAverage[];
  precipitationDailyAverage: PrecipitationDayAverage[];
  annualAveragePrecipitationMm: number | null;
  wettestMonth: number | null;
};

export type EnergyAnalysis = {
  solarRadiationKwhM2Day: number | null;
  temperatureAverageC: number | null;
  windAverageMs: number | null;
  estimatedPvYieldKwhKwpDay: number | null;
  potentialLabel: string;
  period: string;
};

export type LandValueAnalysis = {
  available: boolean;
  valueCrcM2: number | null;
  zoneCode: string | null;
  zoneName: string | null;
  landUseCode: string | null;
  territorialCode: string | null;
  provinceCode: string | null;
  cantonCode: string | null;
  districtCode: string | null;
};

export type CadastreZone = "Zona 1" | "Zona 2";

export type CadastreParcel = {
  featureId: string;
  zone: CadastreZone;
  planNumber: string | null;
  propertyNumber: string | null;
  identifier: string | null;
  provinceCode: string | null;
  cantonCode: string | null;
  districtCode: string | null;
  duplicate: boolean | null;
  horizontal: boolean | null;
  compatible: boolean | null;
};

export type CadastreAnalysis = {
  available: boolean;
  ambiguous: boolean;
  matches: CadastreParcel[];
};

export type SeismicEvent = {
  id: string;
  magnitude: number | null;
  place: string;
  time: string;
  depthKm: number | null;
  distanceKm: number;
  url: string;
};

export type SeismicAnalysis = {
  eventsLastYear: number;
  eventsWithin100Km: number;
  maximumMagnitude: number | null;
  nearestDistanceKm: number | null;
  events: SeismicEvent[];
};

export type SeismicYearRecord = {
  year: number;
  count: number;
  within100Km: number;
  maximumMagnitude: number | null;
};

export type SeismicHistoryAnalysis = {
  periodStart: string;
  periodEnd: string;
  years: SeismicYearRecord[];
  totalEvents: number;
  maximumMagnitude: number | null;
};

export type RiskLevel = "Bajo" | "Moderado" | "Alto";

export type SiteAssessment = {
  drainageRisk: RiskLevel;
  terrainSuitability: RiskLevel;
  notes: string[];
};

export type AnalysisResult = {
  id: string;
  generatedAt: string;
  location: {
    name: string;
    lat: number;
    lng: number;
    provinceHint: string;
  };
  terrain: TerrainAnalysis;
  weather: WeatherAnalysis;
  climateHistory: ClimateHistoryAnalysis;
  energy: EnergyAnalysis;
  landValue: LandValueAnalysis;
  cadastre: CadastreAnalysis;
  seismic: SeismicAnalysis;
  seismicHistory: SeismicHistoryAnalysis;
  assessment: SiteAssessment;
  sources: DataSource[];
  warnings: string[];
  disclaimer: string;
};

