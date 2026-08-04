"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  CloudRain,
  Compass,
  Database,
  Droplets,
  FileJson,
  FileText,
  Gauge,
  Layers3,
  Landmark,
  LocateFixed,
  MapPin,
  Menu,
  Mountain,
  Radio,
  RefreshCw,
  Satellite,
  Search,
  ShieldCheck,
  Sun,
  Thermometer,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";

import { AnalysisMap } from "@/components/analysis-map";
import {
  isInsideCostaRicaBounds,
  nearestProvince,
  SITE_PRESETS,
} from "@/lib/costa-rica";
import type {
  AnalysisRequest,
  AnalysisResult,
  ClimateHistoryAnalysis,
  ClimateMonthRecord,
  DataSource,
  PrecipitationDayAverage,
  PrecipitationMonthAverage,
  ForecastDay,
  RiskLevel,
  SeismicHistoryAnalysis,
} from "@/lib/types";

const DEFAULT_SITE: AnalysisRequest = {
  name: "San José centro",
  lat: 9.932,
  lng: -84.079,
};

type Tab = "overview" | "climate" | "seismic" | "sources";

async function requestAnalysis(
  site: AnalysisRequest,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(site),
    signal,
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "No se pudo analizar el sitio.";
    throw new Error(message);
  }
  return body as AnalysisResult;
}

function number(value: number | null | undefined, suffix = "", digits = 1) {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("es-CR", { maximumFractionDigits: digits }).format(value)}${suffix}`;
}

function colonesPerM2(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return (
    "₡" +
    new Intl.NumberFormat("es-CR", { maximumFractionDigits: 0 }).format(value) +
    "/m²"
  );
}

function date(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    ...options,
  }).format(new Date(value));
}

function riskTone(level: RiskLevel) {
  return level === "Alto" ? "danger" : level === "Moderado" ? "warning" : "good";
}

function ForecastChart({ forecast }: { forecast: ForecastDay[] }) {
  if (!forecast.length) return <div className="empty-panel">No hay pronóstico disponible.</div>;
  const maximum = Math.max(...forecast.map((day) => day.precipitationMm ?? 0), 10);
  return (
    <div className="forecast-bars" role="img" aria-label="Precipitación prevista para siete días">
      {forecast.map((day) => {
        const rain = day.precipitationMm ?? 0;
        return (
          <div className="forecast-bar-column" key={day.date}>
            <span className="forecast-rain-value">{number(rain, "", 0)}</span>
            <div className="forecast-bar-track">
              <span style={{ height: `${Math.max((rain / maximum) * 100, 3)}%` }} />
            </div>
            <strong>{number(day.temperatureMaxC, "°", 0)}</strong>
            <small>{date(`${day.date}T12:00:00`, { weekday: "short" })}</small>
          </div>
        );
      })}
    </div>
  );
}

function monthName(month: number, style: "short" | "long" = "long") {
  return date(
    `2001-${String(month).padStart(2, "0")}-15T12:00:00Z`,
    { month: style },
  );
}

function ClimateHistorySummary({ history }: { history: ClimateHistoryAnalysis }) {
  if (!history.months.length && !history.precipitationMonthlyAverage.length) {
    return <div className="empty-panel">No hay histórico climático disponible.</div>;
  }
  return (
    <>
      <div className="history-stats">
        <div><span>Temperatura media</span><strong>{number(history.temperatureMeanC, " °C")}</strong></div>
        <div><span>Promedio anual CHIRPS</span><strong>{number(history.annualAveragePrecipitationMm, " mm", 0)}</strong></div>
        <div><span>Mes más lluvioso</span><strong>{history.wettestMonth ? monthName(history.wettestMonth) : "—"}</strong></div>
      </div>
      <p className="history-caption">
        {history.era5Available
          ? `${history.model} · ${history.periodStart} a ${history.periodEnd}. `
          : "ERA5-Seamless no disponible. "}
        {history.chirpsAvailable
          ? `${history.precipitationModel} · ${history.precipitationPeriodStart} a ${history.precipitationPeriodEnd} (${history.precipitationYears} años).`
          : "CHIRPS no disponible."}
        {" "}Datos de cuadrícula, no mediciones de una estación puntual.
      </p>
    </>
  );
}

type ClimateSeriesField =
  | "temperatureMeanC"
  | "windMaxAverageKmh"
  | "solarRadiationAverageMjM2"
  | "soilMoistureAveragePct";

type HistoricalSeriesProps = {
  months: ClimateMonthRecord[];
  field: ClimateSeriesField;
  label: string;
  unit: string;
  tone: "temperature" | "rain" | "wind" | "solar" | "soil";
  digits?: number;
  kind?: "line" | "bars";
};

function HistoricalSeriesChart({
  months,
  field,
  label,
  unit,
  tone,
  digits = 1,
  kind = "line",
}: HistoricalSeriesProps) {
  const values = months
    .map((month) => month[field])
    .filter((value): value is number => value !== null);
  if (!values.length) {
    return <div className="empty-panel">No hay datos históricos para esta variable.</div>;
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const averageValue = values.reduce((total, value) => total + value, 0) / values.length;
  const rawRange = Math.max(maximum - minimum, Math.abs(maximum) * 0.05, 1);
  const lowerBound = kind === "bars" ? Math.min(0, minimum) : minimum - rawRange * 0.12;
  const upperBound = maximum + rawRange * 0.12;
  const scaleRange = Math.max(upperBound - lowerBound, 1);
  const width = 640;
  const plotTop = 14;
  const plotBottom = 142;
  const plotLeft = 18;
  const plotRight = 622;
  const plotHeight = plotBottom - plotTop;
  const xFor = (index: number) =>
    plotLeft + (index / Math.max(months.length - 1, 1)) * (plotRight - plotLeft);
  const yFor = (value: number) =>
    plotTop + (1 - (value - lowerBound) / scaleRange) * plotHeight;
  const points = months.flatMap((month, index) => {
    const value = month[field];
    return value === null ? [] : [{ month: month.month, value, x: xFor(index), y: yFor(value) }];
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = points.length
    ? `${points[0].x},${plotBottom} ${linePoints} ${points.at(-1)!.x},${plotBottom}`
    : "";
  const labelIndexes = new Set([0, 6, 12, 18, months.length - 1]);
  const barWidth = Math.max(8, (plotRight - plotLeft) / months.length - 7);

  return (
    <>
      <div className="series-metrics">
        <div><span>Promedio</span><strong>{number(averageValue, unit, digits)}</strong></div>
        <div><span>Mínimo</span><strong>{number(minimum, unit, digits)}</strong></div>
        <div><span>Máximo</span><strong>{number(maximum, unit, digits)}</strong></div>
      </div>
      <div className={`historical-series historical-series-${tone}`}>
        <svg viewBox={`0 0 ${width} 178`} role="img" aria-label={`${label} durante los últimos 24 meses completos`}>
          <g className="historical-series-grid">
            {[plotTop, plotTop + plotHeight / 2, plotBottom].map((y) => <line key={y} x1={plotLeft} x2={plotRight} y1={y} y2={y} />)}
          </g>
          {kind === "line" && points.length > 1 ? <polygon className="historical-series-area" points={areaPoints} /> : null}
          {kind === "line" ? <polyline className="historical-series-line" points={linePoints} /> : null}
          {kind === "bars" ? months.map((month, index) => {
            const value = month[field];
            if (value === null) return null;
            const y = yFor(value);
            return <rect className="historical-series-bar" key={month.month} x={xFor(index) - barWidth / 2} y={y} width={barWidth} height={Math.max(plotBottom - y, 2)} rx="3"><title>{date(`${month.month}-15T12:00:00`, { month: "long", year: "numeric" })}: {number(value, unit, digits)}</title></rect>;
          }) : points.map((point) => <circle className="historical-series-point" key={point.month} cx={point.x} cy={point.y} r="3"><title>{date(`${point.month}-15T12:00:00`, { month: "long", year: "numeric" })}: {number(point.value, unit, digits)}</title></circle>)}
          <g className="historical-series-axis">
            {months.map((month, index) => labelIndexes.has(index) ? <text key={month.month} x={xFor(index)} y="169" textAnchor="middle">{date(`${month.month}-15T12:00:00`, { month: "short", year: "2-digit" })}</text> : null)}
          </g>
        </svg>
      </div>
    </>
  );
}

function PrecipitationClimatologyChart({
  monthly,
  daily,
}: {
  monthly?: PrecipitationMonthAverage[];
  daily?: PrecipitationDayAverage[];
}) {
  const isDaily = Boolean(daily?.length);
  const points = isDaily
    ? (daily ?? []).map((record) => ({
        key: `day-${record.dayOfYear}`,
        label: date(
          `2001-${String(record.month).padStart(2, "0")}-${String(record.day).padStart(2, "0")}T12:00:00Z`,
          { day: "numeric", month: "long" },
        ),
        axisLabel: monthName(record.month, "short"),
        isAxisLabel: record.day === 1,
        value: record.precipitationMm,
        sampleYears: record.sampleYears,
      }))
    : (monthly ?? []).map((record) => ({
        key: `month-${record.month}`,
        label: monthName(record.month),
        axisLabel: monthName(record.month, "short"),
        isAxisLabel: true,
        value: record.precipitationMm,
        sampleYears: record.sampleYears,
      }));
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null);

  if (!values.length) {
    return <div className="empty-panel">No hay datos CHIRPS disponibles.</div>;
  }

  const averageValue = values.reduce((total, value) => total + value, 0) / values.length;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const upperBound = Math.max(maximum * 1.12, 1);
  const width = 640;
  const plotTop = 14;
  const plotBottom = 142;
  const plotLeft = 18;
  const plotRight = 622;
  const plotHeight = plotBottom - plotTop;
  const xFor = (index: number) =>
    isDaily
      ? plotLeft + (index / Math.max(points.length - 1, 1)) * (plotRight - plotLeft)
      : plotLeft + ((index + 0.5) / points.length) * (plotRight - plotLeft);
  const yFor = (value: number) =>
    plotTop + (1 - value / upperBound) * plotHeight;
  const plotted = points.flatMap((point, index) =>
    point.value === null
      ? []
      : [{ ...point, x: xFor(index), y: yFor(point.value) }],
  );
  const linePoints = plotted.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = plotted.length
    ? `${plotted[0].x},${plotBottom} ${linePoints} ${plotted.at(-1)!.x},${plotBottom}`
    : "";
  const barWidth = Math.max(8, ((plotRight - plotLeft) / points.length) * 0.62);
  const digits = isDaily ? 2 : 0;
  const description = isDaily
    ? "Precipitación CHIRPS promedio para cada día del año"
    : "Precipitación CHIRPS acumulada promedio para cada mes";

  return (
    <>
      <div className="series-metrics">
        <div><span>{isDaily ? "Promedio diario" : "Promedio mensual"}</span><strong>{number(averageValue, " mm", digits)}</strong></div>
        <div><span>Mínimo</span><strong>{number(minimum, " mm", digits)}</strong></div>
        <div><span>Máximo</span><strong>{number(maximum, " mm", digits)}</strong></div>
      </div>
      <div className={`historical-series historical-series-rain ${isDaily ? "historical-series-daily" : ""}`}>
        <svg viewBox={`0 0 ${width} 178`} role="img" aria-label={description}>
          <g className="historical-series-grid">
            {[plotTop, plotTop + plotHeight / 2, plotBottom].map((y) => <line key={y} x1={plotLeft} x2={plotRight} y1={y} y2={y} />)}
          </g>
          {isDaily && plotted.length > 1 ? <polygon className="historical-series-area" points={areaPoints} /> : null}
          {isDaily ? <polyline className="historical-series-line" points={linePoints} /> : null}
          {isDaily
            ? plotted.map((point) => <circle className="historical-series-point" key={point.key} cx={point.x} cy={point.y} r="1.1"><title>{point.label}: {number(point.value, " mm", digits)} · {point.sampleYears} años</title></circle>)
            : points.map((point, index) => {
                if (point.value === null) return null;
                const y = yFor(point.value);
                return <rect className="historical-series-bar" key={point.key} x={xFor(index) - barWidth / 2} y={y} width={barWidth} height={Math.max(plotBottom - y, 2)} rx="3"><title>{point.label}: {number(point.value, " mm", digits)} · {point.sampleYears} años</title></rect>;
              })}
          <g className="historical-series-axis">
            {points.map((point, index) => point.isAxisLabel ? <text key={point.key} x={xFor(index)} y="169" textAnchor="middle">{point.axisLabel}</text> : null)}
          </g>
        </svg>
      </div>
    </>
  );
}

function SeismicHistoryChart({ history }: { history: SeismicHistoryAnalysis }) {
  if (!history.years.length) {
    return <div className="empty-panel">No hay histórico sísmico disponible.</div>;
  }
  const maximum = Math.max(...history.years.map((year) => year.count), 1);
  return (
    <>
      <div className="history-stats seismic-history-stats">
        <div><span>Total del período</span><strong>{history.totalEvents}</strong></div>
        <div><span>Magnitud máxima</span><strong>{number(history.maximumMagnitude)}</strong></div>
        <div><span>Umbral</span><strong>M2.5+</strong></div>
      </div>
      <div className="history-legend"><span><i className="seismic-total-key" /> Dentro de 250 km</span><span><i className="seismic-near-key" /> Dentro de 100 km</span></div>
      <div className="seismic-history-bars" role="img" aria-label="Conteos anuales de sismos durante cinco años calendario">
        {history.years.map((year) => (
          <div className="seismic-year-column" key={year.year} title={`${year.year}: ${year.count} eventos; ${year.within100Km} dentro de 100 km`}>
            <strong>{year.count}</strong>
            <div className="seismic-bar-track">
              <span className="seismic-bar-total" style={{ height: `${Math.max((year.count / maximum) * 100, 3)}%` }} />
              <span className="seismic-bar-near" style={{ height: `${Math.max((year.within100Km / maximum) * 100, year.within100Km ? 3 : 0)}%` }} />
            </div>
            <span className="seismic-near-value">{year.within100Km} cercanos</span>
            <small>{year.year}</small>
          </div>
        ))}
      </div>
      <p className="history-caption">USGS · {history.periodStart} a {history.periodEnd}. Distancias epicentrales aproximadas.</p>
    </>
  );
}

function TerrainGrid({ values }: { values: Array<number | null> }) {
  const valid = values.filter((value): value is number => value !== null);
  const minimum = valid.length ? Math.min(...valid) : 0;
  const maximum = valid.length ? Math.max(...valid) : 1;
  const range = Math.max(maximum - minimum, 1);
  return (
    <div className="terrain-grid" aria-label="Malla de elevación de nueve puntos">
      {values.map((value, index) => {
        const ratio = value === null ? 0 : (value - minimum) / range;
        return (
          <div
            className={`terrain-cell ${index === 4 ? "terrain-cell-center" : ""}`}
            key={index}
            style={{
              backgroundColor:
                value === null
                  ? "rgba(255,255,255,.03)"
                  : `rgba(201,241,124,${0.12 + ratio * 0.6})`,
            }}
          >
            <span>{value ?? "—"}</span><small>m</small>
          </div>
        );
      })}
    </div>
  );
}

function LandValuePanel({
  value,
}: {
  value: AnalysisResult["landValue"];
}) {
  return (
    <article className="panel land-value-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Ministerio de Hacienda · ONT</span>
          <h3>Valor fiscal de referencia del terreno</h3>
        </div>
        <Landmark size={20} className="land-value-icon" />
      </div>
      {value.available ? (
        <>
          <div className="land-value-layout">
            <div className="land-value-primary">
              <span>Valor de la zona</span>
              <strong>{colonesPerM2(value.valueCrcM2)}</strong>
              <small>Colones por metro cuadrado</small>
            </div>
            <div className="land-value-details">
              <div>
                <span>Zona homogénea</span>
                <strong>{value.zoneName ?? "Sin nombre"}</strong>
              </div>
              <div>
                <span>Código oficial</span>
                <strong>{value.territorialCode ?? value.zoneCode ?? "—"}</strong>
              </div>
              <div>
                <span>Tipo de uso</span>
                <strong>{value.landUseCode ?? "No indicado"}</strong>
              </div>
            </div>
          </div>
          <p className="land-value-note">
            Es un valor fiscal de referencia para la zona homogénea. No
            representa el precio comercial ni un avalúo individual del predio.
          </p>
        </>
      ) : (
        <div className="empty-panel">
          No se encontró una zona homogénea publicada para este punto.
        </div>
      )}
    </article>
  );
}

function cadastreLocation(
  parcel: AnalysisResult["cadastre"]["matches"][number],
) {
  const code = [
    parcel.provinceCode,
    parcel.cantonCode,
    parcel.districtCode,
  ]
    .filter((part): part is string => part !== null)
    .join("-");
  return code ? code : "—";
}

function CadastrePanel({
  cadastre,
}: {
  cadastre: AnalysisResult["cadastre"];
}) {
  return (
    <article className="panel cadastre-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Registro Inmobiliario · SNIT</span>
          <h3>Información catastral del punto</h3>
        </div>
        <MapPin size={20} className="cadastre-icon" />
      </div>
      {cadastre.available ? (
        <>
          <div className="cadastre-match-list">
            {cadastre.matches.map((parcel) => (
              <section className="cadastre-match" key={parcel.featureId}>
                <div className="cadastre-plan">
                  <span>Plano catastrado</span>
                  <strong>{parcel.planNumber ?? "No publicado"}</strong>
                  <small>{parcel.zone}</small>
                </div>
                <div className="cadastre-details">
                  <div>
                    <span>Finca</span>
                    <strong>{parcel.propertyNumber ?? "No publicada"}</strong>
                  </div>
                  <div>
                    <span>Identificador</span>
                    <strong>{parcel.identifier ?? "No publicado"}</strong>
                  </div>
                  <div>
                    <span>Provincia–cantón–distrito</span>
                    <strong>{cadastreLocation(parcel)}</strong>
                  </div>
                </div>
              </section>
            ))}
          </div>
          {cadastre.ambiguous ? (
            <div className="cadastre-warning">
              <CircleAlert size={15} />
              <span>
                El punto coincide con {cadastre.matches.length} registros. Puede
                estar sobre un límite catastral; verifique cuál corresponde.
              </span>
            </div>
          ) : null}
          <p className="cadastre-note">
            Consulta informativa de Zona 1 y Zona 2. No sustituye una
            certificación literal, plano certificado ni consulta registral.
          </p>
        </>
      ) : (
        <div className="empty-panel">
          El punto no coincide con una parcela publicada en Zona 1 o Zona 2.
        </div>
      )}
    </article>
  );
}

function SourceCard({ source }: { source: DataSource }) {
  const label = source.status === "live" ? "En vivo" : source.status === "requires-credentials" ? "Requiere acceso" : "No disponible";
  return (
    <a className="source-card" href={source.url} target="_blank" rel="noreferrer">
      <div className="source-icon"><Database size={18} /></div>
      <div className="source-copy">
        <div className="source-title-row">
          <strong>{source.name}</strong>
          <span className={`source-status source-${source.status}`}>{source.status === "live" && <span className="live-dot" />}{label}</span>
        </div>
        <span>{source.provider}</span>
        <p>{source.detail}</p>
      </div>
      <ChevronRight size={16} />
    </a>
  );
}

function LoadingMetrics() {
  return <>{[0, 1, 2, 3].map((item) => <div className="metric-card metric-loading" key={item}><i /><span /><b /><small /></div>)}</>;
}

export function Dashboard() {
  const [coordinates, setCoordinates] = useState({ lat: DEFAULT_SITE.lat, lng: DEFAULT_SITE.lng });
  const [siteName, setSiteName] = useState(DEFAULT_SITE.name);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    void requestAnalysis(DEFAULT_SITE)
      .then((data) => { if (!ignore) setResult(data); })
      .catch((reason: unknown) => { if (!ignore) setError(reason instanceof Error ? reason.message : "No se pudo cargar el análisis."); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const resultMatchesSelection = result !== null && Math.abs(result.location.lat - coordinates.lat) < 0.00001 && Math.abs(result.location.lng - coordinates.lng) < 0.00001;

  function selectCoordinates(next: { lat: number; lng: number }) {
    setCoordinates(next);
    setSiteName(`Punto en ${nearestProvince(next)}`);
    setError(null);
  }

  function selectPreset(index: number) {
    const preset = SITE_PRESETS[index];
    setCoordinates({ lat: preset.lat, lng: preset.lng });
    setSiteName(preset.name);
    setError(null);
  }

  async function runAnalysis() {
    if (!isInsideCostaRicaBounds(coordinates)) {
      setError("Las coordenadas deben estar dentro de Costa Rica.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(await requestAnalysis({ ...coordinates, name: siteName }));
      setActiveTab("overview");
      setSidebarOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo analizar el sitio.");
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Este navegador no permite obtener la ubicación.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { lat: Number(coords.latitude.toFixed(5)), lng: Number(coords.longitude.toFixed(5)) };
        if (!isInsideCostaRicaBounds(next)) return setError("La ubicación detectada está fuera de Costa Rica.");
        selectCoordinates(next);
      },
      () => setError("No fue posible acceder a tu ubicación."),
      { enableHighAccuracy: true, timeout: 8_000 },
    );
  }

  function downloadJson() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.id.toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    if (!result) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    let y = 18;
    pdf.setProperties({ title: `Informe Civilscope CR — ${result.location.name}`, author: "Civilscope CR" });
    pdf.setFillColor(12, 30, 34); pdf.rect(0, 0, 210, 42, "F");
    pdf.setTextColor(201, 241, 124); pdf.setFont("helvetica", "bold"); pdf.setFontSize(22); pdf.text("CIVILSCOPE CR", 18, y);
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(13); pdf.text("Informe de análisis territorial", 18, y + 9);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.text(result.id, 18, y + 16); y = 54;
    pdf.setTextColor(25, 35, 38); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.text(result.location.name, 18, y);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text(`${result.location.lat.toFixed(5)}, ${result.location.lng.toFixed(5)} · ${result.location.provinceHint}`, 18, y + 7); y += 20;
    const primaryCadastre = result.cadastre.matches[0];
    const metrics = [
      ["Elevación", number(result.terrain.elevationM, " m", 0)], ["Pendiente", number(result.terrain.slopeDeg, "°")],
      ["Radiación solar", number(result.energy.solarRadiationKwhM2Day, " kWh/m²/día", 2)], ["Lluvia 7 días", number(result.weather.precipitation7dMm, " mm")],
      ["Sismos M2.5+", String(result.seismic.eventsLastYear)], ["Riesgo drenaje", result.assessment.drainageRisk],
      ["Promedio anual CHIRPS", number(result.climateHistory.annualAveragePrecipitationMm, " mm", 0)], ["Sismos en 5 años", String(result.seismicHistory.totalEvents)],
      ["Valor fiscal de referencia", number(result.landValue.valueCrcM2, " CRC/m²", 0)], ["Zona homogénea", result.landValue.territorialCode ?? "Sin datos"],
      ["Plano catastrado", primaryCadastre?.planNumber ?? "No publicado"], ["Finca", primaryCadastre ? `${primaryCadastre.zone} · ${primaryCadastre.propertyNumber ?? "Sin dato"}` : "Sin coincidencia"],
    ];
    const metricRows = Math.ceil(metrics.length / 2);
    metrics.forEach(([label, value], index) => {
      const x = 18 + (index % 2) * 89; const rowY = y + Math.floor(index / 2) * 18;
      pdf.setDrawColor(224, 230, 228); pdf.roundedRect(x, rowY, 84, 14, 2, 2, "S");
      pdf.setFontSize(7); pdf.setTextColor(94, 105, 107); pdf.text(label.toUpperCase(), x + 4, rowY + 5);
      pdf.setFontSize(10); pdf.setTextColor(20, 31, 34); pdf.setFont("helvetica", "bold"); pdf.text(value, x + 4, rowY + 11); pdf.setFont("helvetica", "normal");
    });
    y += metricRows * 18 + 8; pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text("Lectura preliminar", 18, y); y += 7;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    result.assessment.notes.forEach((note) => { const lines = pdf.splitTextToSize(`• ${note}`, 174); pdf.text(lines, 18, y); y += lines.length * 5 + 2; });
    if (y > 215) { pdf.addPage(); y = 18; }
    y += 3; pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text("Fuentes", 18, y); y += 7; pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    result.sources.forEach((item) => { pdf.text(`${item.name} — ${item.provider}`, 18, y); y += 5; });
    pdf.setFillColor(244, 246, 245); pdf.roundedRect(18, 270, 174, 16, 2, 2, "F"); pdf.setTextColor(80, 90, 92); pdf.setFontSize(7); pdf.text(pdf.splitTextToSize(result.disclaimer, 166), 22, 276);
    pdf.save(`${result.id.toLowerCase()}.pdf`);
  }

  const metrics = result ? [
    { icon: Mountain, tone: "terrain", label: "Elevación", value: number(result.terrain.elevationM, " m", 0), note: `${result.terrain.sourceName} · ${result.terrain.resolutionM} m` },
    { icon: Compass, tone: "compass", label: "Pendiente", value: number(result.terrain.slopeDeg, "°"), note: `${result.terrain.slopeClass} · hacia ${result.terrain.aspectLabel}` },
    { icon: Sun, tone: "solar", label: "Potencial solar", value: number(result.energy.solarRadiationKwhM2Day, "", 2), note: `kWh/m²/día · ${result.energy.potentialLabel}` },
    { icon: Waves, tone: "seismic", label: "Actividad sísmica", value: String(result.seismic.eventsLastYear), note: "M2.5+ · 250 km · 12 meses" },
  ] : [];

  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="brand-lockup">
          <button className="mobile-menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Abrir panel"><Menu size={20} /></button>
          <div className="brand-mark"><Satellite size={21} /></div>
          <div><div className="brand-name">CIVILSCOPE CR</div><div className="brand-subtitle">Análisis territorial · Costa Rica</div></div>
        </div>
        <div className="topbar-center"><span className="system-status"><span className="live-dot" /> Fuentes operativas</span><span className="topbar-separator" /><span>Datos públicos de Costa Rica</span></div>
        <div className="access-badge"><div><strong>Acceso público</strong><span>Gratis · sin registro</span></div><div className="avatar">CR</div></div>
      </header>

      <div className="workspace">
        <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-mobile-header"><strong>Definir sitio</strong><button type="button" onClick={() => setSidebarOpen(false)} aria-label="Cerrar"><X size={19} /></button></div>
          <div className="sidebar-section"><div className="eyebrow"><LocateFixed size={14} /> Área de estudio</div><h1>Analizá cualquier sitio en Costa Rica</h1><p>Elegí un punto para obtener una lectura territorial integrada. Civilscope CR es público, gratuito e independiente.</p></div>
          <div className="field-group"><label htmlFor="site-name">Nombre del sitio</label><div className="input-with-icon"><MapPin size={16} /><input id="site-name" value={siteName} maxLength={80} onChange={(event) => setSiteName(event.target.value)} /></div></div>
          <div className="coordinate-grid">
            <div className="field-group"><label htmlFor="latitude">Latitud</label><input id="latitude" type="number" step="0.00001" value={coordinates.lat} onChange={(event) => setCoordinates((current) => ({ ...current, lat: Number(event.target.value) }))} /></div>
            <div className="field-group"><label htmlFor="longitude">Longitud</label><input id="longitude" type="number" step="0.00001" value={coordinates.lng} onChange={(event) => setCoordinates((current) => ({ ...current, lng: Number(event.target.value) }))} /></div>
          </div>
          <button className="location-button" type="button" onClick={useMyLocation}><LocateFixed size={16} /> Usar mi ubicación</button>
          <div className="preset-section"><div className="field-label">Sitios frecuentes</div><div className="preset-list">{SITE_PRESETS.slice(0, 5).map((preset, index) => <button key={preset.name} type="button" onClick={() => selectPreset(index)}><span><MapPin size={14} /> {preset.name}</span><small>{preset.province}</small></button>)}</div></div>
          {error && <div className="error-message" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}
          <button className="analyze-button" type="button" onClick={runAnalysis} disabled={loading}>{loading ? <RefreshCw className="spin" size={17} /> : <Search size={17} />}{loading ? "Consultando fuentes…" : "Analizar sitio"}</button>
          <div className="privacy-note"><ShieldCheck size={16} /><span>La ubicación se usa únicamente para realizar esta consulta.</span></div>
        </aside>
        {sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="Cerrar panel" onClick={() => setSidebarOpen(false)} />}

        <main className="main-content">
          <section className="map-section">
            <AnalysisMap coordinates={coordinates} onChange={selectCoordinates} />
            <div className="map-summary-card"><div><span className="result-kicker">Sitio activo</span><strong>{resultMatchesSelection ? result?.location.name : siteName}</strong><small>{resultMatchesSelection ? `${result?.location.provinceHint} · actualizado ${date(result!.generatedAt, { hour: "2-digit", minute: "2-digit" })}` : "Selección pendiente de análisis"}</small></div><span className={`freshness-badge ${resultMatchesSelection ? "fresh" : "pending"}`}>{resultMatchesSelection ? <Check size={13} /> : <RefreshCw size={13} />}{resultMatchesSelection ? "Analizado" : "Pendiente"}</span></div>
          </section>

          <section className="results-section" aria-busy={loading}>
            <div className="section-heading"><div><span className="eyebrow"><BarChart3 size={14} /> Lectura integrada</span><h2>Indicadores del sitio</h2></div><div className="export-actions"><button type="button" onClick={downloadJson} disabled={!result || loading}><FileJson size={16} /> JSON</button><button className="export-primary" type="button" onClick={downloadPdf} disabled={!result || loading}><FileText size={16} /> Exportar PDF</button></div></div>
            <div className="metric-grid">{loading && !result ? <LoadingMetrics /> : metrics.map(({ icon: Icon, tone, label, value, note }) => <article className="metric-card" key={label}><div className={`metric-icon ${tone}-icon`}><Icon size={19} /></div><span className="metric-label">{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
            {result?.warnings.length ? <div className="warning-banner"><CircleAlert size={16} /><span>{result.warnings.join(" ")} El resto del informe se mantiene disponible.</span></div> : null}
            <div className="tabs-row" role="tablist" aria-label="Secciones">{([["overview", "Resumen", Gauge], ["climate", "Clima y agua", CloudRain], ["seismic", "Sismicidad", Activity], ["sources", "Fuentes", Database]] as const).map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}><Icon size={16} /> {label}</button>)}</div>

            {result && activeTab === "overview" && <div className="tab-panel overview-layout" role="tabpanel">
              <LandValuePanel value={result.landValue} />
              <CadastrePanel cadastre={result.cadastre} />
              <article className="panel terrain-panel"><div className="panel-heading"><div><span className="panel-kicker">Terreno · {result.terrain.sourceName}</span><h3>Malla de elevación</h3></div><span className="resolution-badge">{result.terrain.resolutionM} m/píxel</span></div><TerrainGrid values={result.terrain.gridM} /><div className="terrain-details"><div><span>Relieve local</span><strong>{number(result.terrain.reliefM, " m", 0)}</strong></div><div><span>Orientación</span><strong>{result.terrain.aspectLabel} · {number(result.terrain.aspectDeg, "°", 0)}</strong></div></div></article>
              <article className="panel assessment-panel"><div className="panel-heading"><div><span className="panel-kicker">Criterio preliminar</span><h3>Lectura para prefactibilidad</h3></div><BadgeCheck size={20} className="accent-icon" /></div><div className="risk-row"><div><span>Riesgo de drenaje</span><strong className={`risk-badge risk-${riskTone(result.assessment.drainageRisk)}`}>{result.assessment.drainageRisk}</strong></div><div><span>Complejidad del terreno</span><strong className={`risk-badge risk-${riskTone(result.assessment.terrainSuitability)}`}>{result.assessment.terrainSuitability}</strong></div></div><ul className="assessment-notes">{result.assessment.notes.map((note) => <li key={note}><Check size={14} /><span>{note}</span></li>)}</ul></article>
              <article className="panel current-panel"><div className="panel-heading"><div><span className="panel-kicker">Condición actual</span><h3>Clima del sitio</h3></div><Radio size={18} className="accent-icon" /></div><div className="current-weather-grid"><div><Thermometer size={18} /><span>Temperatura</span><strong>{number(result.weather.temperatureC, " °C")}</strong></div><div><Wind size={18} /><span>Viento</span><strong>{number(result.weather.windSpeedKmh, " km/h")}</strong></div><div><Droplets size={18} /><span>Humedad suelo</span><strong>{number(result.weather.soilMoisturePct, "%")}</strong></div><div><CloudRain size={18} /><span>Lluvia 7 días</span><strong>{number(result.weather.precipitation7dMm, " mm")}</strong></div></div></article>
              <article className="panel energy-panel"><div className="panel-heading"><div><span className="panel-kicker">Energía</span><h3>Rendimiento indicativo</h3></div><Zap size={19} className="accent-icon" /></div><div className="energy-value"><strong>{number(result.energy.estimatedPvYieldKwhKwpDay, "", 2)}</strong><span>kWh/kWp/día</span></div><div className="energy-scale"><span style={{ width: `${Math.min(((result.energy.estimatedPvYieldKwhKwpDay ?? 0) / 5) * 100, 100)}%` }} /></div><p>Estimación con razón de desempeño 0,78. NASA POWER: {result.energy.period}.</p></article>
            </div>}

            {result && activeTab === "climate" && <div className="tab-panel climate-layout" role="tabpanel">
              <article className="panel climate-history-panel"><div className="panel-heading"><div><span className="panel-kicker">Histórico climático</span><h3>ERA5 reciente y climatología CHIRPS</h3></div><BarChart3 size={19} className="accent-icon" /></div><ClimateHistorySummary history={result.climateHistory} /></article>
              <div className="historical-variable-grid">
                <article className="panel historical-variable-panel"><div className="panel-heading"><div><span className="panel-kicker">Temperatura superficial</span><h3>Media mensual</h3></div><Thermometer size={19} className="temperature-series-icon" /></div><HistoricalSeriesChart months={result.climateHistory.months} field="temperatureMeanC" label="Temperatura media mensual" unit=" °C" tone="temperature" /></article>
                <article className="panel historical-variable-panel"><div className="panel-heading"><div><span className="panel-kicker">Viento</span><h3>Máximo diario medio</h3></div><Wind size={19} className="wind-series-icon" /></div><HistoricalSeriesChart months={result.climateHistory.months} field="windMaxAverageKmh" label="Viento máximo diario medio" unit=" km/h" tone="wind" /></article>
                <article className="panel historical-variable-panel"><div className="panel-heading"><div><span className="panel-kicker">Radiación solar</span><h3>Promedio diario mensual</h3></div><Sun size={19} className="solar-series-icon" /></div><HistoricalSeriesChart months={result.climateHistory.months} field="solarRadiationAverageMjM2" label="Radiación solar media diaria" unit=" MJ/m²" tone="solar" /></article>
                <article className="panel historical-variable-panel"><div className="panel-heading"><div><span className="panel-kicker">Humedad del suelo</span><h3>Promedio superficial 0–7 cm</h3></div><Droplets size={19} className="soil-series-icon" /></div><HistoricalSeriesChart months={result.climateHistory.months} field="soilMoistureAveragePct" label="Humedad superficial del suelo" unit="%" tone="soil" /></article>
                <article className="panel historical-variable-panel historical-variable-panel-wide"><div className="panel-heading"><div><span className="panel-kicker">CHIRPS v2.0 · ~5,6 km</span><h3>Precipitación acumulada promedio por mes</h3></div><CloudRain size={19} className="rain-series-icon" /></div><PrecipitationClimatologyChart monthly={result.climateHistory.precipitationMonthlyAverage} /></article>
                <article className="panel historical-variable-panel historical-variable-panel-wide"><div className="panel-heading"><div><span className="panel-kicker">CHIRPS v2.0 · {result.climateHistory.precipitationYears} años</span><h3>Precipitación promedio por día del año</h3></div><CloudRain size={19} className="rain-series-icon" /></div><PrecipitationClimatologyChart daily={result.climateHistory.precipitationDailyAverage} /></article>
              </div>
              <article className="panel forecast-panel"><div className="panel-heading"><div><span className="panel-kicker">ECMWF IFS HRES · Open-Meteo</span><h3>Precipitación y temperatura máxima</h3></div><CalendarDays size={19} className="accent-icon" /></div><ForecastChart forecast={result.weather.forecast} /></article>
              <article className="panel forecast-table-panel"><div className="panel-heading"><div><span className="panel-kicker">Detalle diario</span><h3>Ventana de planificación</h3></div></div><div className="forecast-table-wrap"><table className="forecast-table"><thead><tr><th>Día</th><th>Temperatura</th><th>Lluvia</th><th>Viento</th><th>Radiación</th></tr></thead><tbody>{result.weather.forecast.map((day) => <tr key={day.date}><td>{date(`${day.date}T12:00:00`, { weekday: "short", day: "numeric" })}</td><td>{number(day.temperatureMinC, "°")} / {number(day.temperatureMaxC, "°")}</td><td>{number(day.precipitationMm, " mm")}</td><td>{number(day.windMaxKmh, " km/h")}</td><td>{number(day.radiationMjM2, " MJ/m²")}</td></tr>)}</tbody></table></div></article>
            </div>}

            {result && activeTab === "seismic" && <div className="tab-panel seismic-layout" role="tabpanel">
              <article className="panel seismic-summary"><div className="panel-heading"><div><span className="panel-kicker">USGS Earthquake Catalog</span><h3>Contexto sísmico</h3></div><Activity size={20} className="accent-icon" /></div><div className="seismic-stat-grid"><div><span>En 250 km</span><strong>{result.seismic.eventsLastYear}</strong><small>eventos M2.5+</small></div><div><span>En 100 km</span><strong>{result.seismic.eventsWithin100Km}</strong><small>últimos 12 meses</small></div><div><span>Magnitud máxima</span><strong>{number(result.seismic.maximumMagnitude)}</strong><small>reportada</small></div><div><span>Más cercano</span><strong>{number(result.seismic.nearestDistanceKm, " km", 0)}</strong><small>distancia epicentral</small></div></div></article>
              <article className="panel seismic-history-panel"><div className="panel-heading"><div><span className="panel-kicker">Tendencia histórica</span><h3>Cinco años calendario</h3></div><BarChart3 size={19} className="accent-icon" /></div><SeismicHistoryChart history={result.seismicHistory} /></article>
              <article className="panel event-list-panel"><div className="panel-heading"><div><span className="panel-kicker">Eventos recientes</span><h3>Historial cercano</h3></div></div><div className="event-list">{result.seismic.events.length ? result.seismic.events.map((event) => <a key={event.id} href={event.url} target="_blank" rel="noreferrer"><span className="magnitude-bubble">M{number(event.magnitude)}</span><div><strong>{event.place}</strong><span>{date(event.time, { dateStyle: "medium", timeStyle: "short" })}</span></div><div className="event-meta"><strong>{number(event.distanceKm, " km", 0)}</strong><span>{number(event.depthKm, " km")} prof.</span></div><ChevronRight size={16} /></a>) : <div className="empty-panel">No se encontraron eventos.</div>}</div></article>
            </div>}

            {result && activeTab === "sources" && <div className="tab-panel sources-layout" role="tabpanel">
              <article className="panel source-intro"><div className="source-intro-icon"><Layers3 size={24} /></div><div><span className="panel-kicker">Trazabilidad</span><h3>Datos objetivos y verificables</h3><p>Cada indicador conserva su fuente. El MDE IGN aporta el terreno de 10 m, ERA5-Seamless y CHIRPS el clima, Hacienda el valor fiscal zonal y Registro Inmobiliario/SNIT la información catastral.</p></div><button type="button" onClick={downloadJson}><ArrowDownToLine size={16} /> Exportar datos</button></article>
              <div className="source-list">{result.sources.map((item) => <SourceCard key={item.name} source={item} />)}</div>
              <div className="methodology-note"><CircleAlert size={17} /><div><strong>Alcance técnico</strong><p>{result.disclaimer}</p></div></div>
            </div>}
          </section>
        </main>
      </div>
    </div>
  );
}

