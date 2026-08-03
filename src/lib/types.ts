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

export type EnergyAnalysis = {
  solarRadiationKwhM2Day: number | null;
  temperatureAverageC: number | null;
  windAverageMs: number | null;
  estimatedPvYieldKwhKwpDay: number | null;
  potentialLabel: string;
  period: string;
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
  energy: EnergyAnalysis;
  seismic: SeismicAnalysis;
  assessment: SiteAssessment;
  sources: DataSource[];
  warnings: string[];
  disclaimer: string;
};

