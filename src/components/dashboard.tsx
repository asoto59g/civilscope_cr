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
  DataSource,
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

function ClimateHistoryChart({ history }: { history: ClimateHistoryAnalysis }) {
  if (!history.months.length) {
    return <div className="empty-panel">No hay histórico climático disponible.</div>;
  }
  const maximum = Math.max(
    ...history.months.map((month) => month.precipitationMm ?? 0),
    10,
  );
  return (
    <>
      <div className="history-stats">
        <div><span>Temperatura media</span><strong>{number(history.temperatureMeanC, " °C")}</strong></div>
        <div><span>Precipitación anualizada</span><strong>{number(history.annualizedPrecipitationMm, " mm", 0)}</strong></div>
        <div><span>Mes más lluvioso</span><strong>{history.wettestMonth ? date(`${history.wettestMonth}-15T12:00:00`, { month: "short", year: "numeric" }) : "—"}</strong></div>
      </div>
      <div className="history-legend"><span><i className="rain-key" /> Precipitación mensual</span><span><i className="temperature-key" /> Temperatura media</span></div>
      <div className="history-scroll">
        <div className="history-columns" role="img" aria-label="Precipitación y temperatura mensuales de los últimos 24 meses completos">
          {history.months.map((month) => {
            const rain = month.precipitationMm ?? 0;
            return (
              <div className="history-column" key={month.month} title={`${month.month}: ${number(month.precipitationMm, " mm")} y ${number(month.temperatureMeanC, " °C")}`}>
                <span className="history-temp">{number(month.temperatureMeanC, "°", 0)}</span>
                <div className="history-bar-track"><span className="history-bar-fill" style={{ height: `${Math.max((rain / maximum) * 100, 2)}%` }} /></div>
                <small>{date(`${month.month}-15T12:00:00`, { month: "short", year: "2-digit" })}</small>
              </div>
            );
          })}
        </div>
      </div>
      <p className="history-caption">{history.model} · {history.periodStart} a {history.periodEnd}. Reanálisis climático, no medición de estación.</p>
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
    const metrics = [
      ["Elevación", number(result.terrain.elevationM, " m", 0)], ["Pendiente", number(result.terrain.slopeDeg, "°")],
      ["Radiación solar", number(result.energy.solarRadiationKwhM2Day, " kWh/m²/día", 2)], ["Lluvia 7 días", number(result.weather.precipitation7dMm, " mm")],
      ["Sismos M2.5+", String(result.seismic.eventsLastYear)], ["Riesgo drenaje", result.assessment.drainageRisk],
      ["Lluvia histórica anual", number(result.climateHistory.annualizedPrecipitationMm, " mm", 0)], ["Sismos en 5 años", String(result.seismicHistory.totalEvents)],
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
              <article className="panel terrain-panel"><div className="panel-heading"><div><span className="panel-kicker">Terreno · {result.terrain.sourceName}</span><h3>Malla de elevación</h3></div><span className="resolution-badge">{result.terrain.resolutionM} m/píxel</span></div><TerrainGrid values={result.terrain.gridM} /><div className="terrain-details"><div><span>Relieve local</span><strong>{number(result.terrain.reliefM, " m", 0)}</strong></div><div><span>Orientación</span><strong>{result.terrain.aspectLabel} · {number(result.terrain.aspectDeg, "°", 0)}</strong></div></div></article>
              <article className="panel assessment-panel"><div className="panel-heading"><div><span className="panel-kicker">Criterio preliminar</span><h3>Lectura para prefactibilidad</h3></div><BadgeCheck size={20} className="accent-icon" /></div><div className="risk-row"><div><span>Riesgo de drenaje</span><strong className={`risk-badge risk-${riskTone(result.assessment.drainageRisk)}`}>{result.assessment.drainageRisk}</strong></div><div><span>Complejidad del terreno</span><strong className={`risk-badge risk-${riskTone(result.assessment.terrainSuitability)}`}>{result.assessment.terrainSuitability}</strong></div></div><ul className="assessment-notes">{result.assessment.notes.map((note) => <li key={note}><Check size={14} /><span>{note}</span></li>)}</ul></article>
              <article className="panel current-panel"><div className="panel-heading"><div><span className="panel-kicker">Condición actual</span><h3>Clima del sitio</h3></div><Radio size={18} className="accent-icon" /></div><div className="current-weather-grid"><div><Thermometer size={18} /><span>Temperatura</span><strong>{number(result.weather.temperatureC, " °C")}</strong></div><div><Wind size={18} /><span>Viento</span><strong>{number(result.weather.windSpeedKmh, " km/h")}</strong></div><div><Droplets size={18} /><span>Humedad suelo</span><strong>{number(result.weather.soilMoisturePct, "%")}</strong></div><div><CloudRain size={18} /><span>Lluvia 7 días</span><strong>{number(result.weather.precipitation7dMm, " mm")}</strong></div></div></article>
              <article className="panel energy-panel"><div className="panel-heading"><div><span className="panel-kicker">Energía</span><h3>Rendimiento indicativo</h3></div><Zap size={19} className="accent-icon" /></div><div className="energy-value"><strong>{number(result.energy.estimatedPvYieldKwhKwpDay, "", 2)}</strong><span>kWh/kWp/día</span></div><div className="energy-scale"><span style={{ width: `${Math.min(((result.energy.estimatedPvYieldKwhKwpDay ?? 0) / 5) * 100, 100)}%` }} /></div><p>Estimación con razón de desempeño 0,78. NASA POWER: {result.energy.period}.</p></article>
            </div>}

            {result && activeTab === "climate" && <div className="tab-panel climate-layout" role="tabpanel">
              <article className="panel climate-history-panel"><div className="panel-heading"><div><span className="panel-kicker">Histórico climático</span><h3>Últimos 24 meses completos</h3></div><BarChart3 size={19} className="accent-icon" /></div><ClimateHistoryChart history={result.climateHistory} /></article>
              <article className="panel forecast-panel"><div className="panel-heading"><div><span className="panel-kicker">ECMWF IFS HRES · Open-Meteo</span><h3>Precipitación y temperatura máxima</h3></div><CalendarDays size={19} className="accent-icon" /></div><ForecastChart forecast={result.weather.forecast} /></article>
              <article className="panel forecast-table-panel"><div className="panel-heading"><div><span className="panel-kicker">Detalle diario</span><h3>Ventana de planificación</h3></div></div><div className="forecast-table-wrap"><table className="forecast-table"><thead><tr><th>Día</th><th>Temperatura</th><th>Lluvia</th><th>Viento</th><th>Radiación</th></tr></thead><tbody>{result.weather.forecast.map((day) => <tr key={day.date}><td>{date(`${day.date}T12:00:00`, { weekday: "short", day: "numeric" })}</td><td>{number(day.temperatureMinC, "°")} / {number(day.temperatureMaxC, "°")}</td><td>{number(day.precipitationMm, " mm")}</td><td>{number(day.windMaxKmh, " km/h")}</td><td>{number(day.radiationMjM2, " MJ/m²")}</td></tr>)}</tbody></table></div></article>
            </div>}

            {result && activeTab === "seismic" && <div className="tab-panel seismic-layout" role="tabpanel">
              <article className="panel seismic-summary"><div className="panel-heading"><div><span className="panel-kicker">USGS Earthquake Catalog</span><h3>Contexto sísmico</h3></div><Activity size={20} className="accent-icon" /></div><div className="seismic-stat-grid"><div><span>En 250 km</span><strong>{result.seismic.eventsLastYear}</strong><small>eventos M2.5+</small></div><div><span>En 100 km</span><strong>{result.seismic.eventsWithin100Km}</strong><small>últimos 12 meses</small></div><div><span>Magnitud máxima</span><strong>{number(result.seismic.maximumMagnitude)}</strong><small>reportada</small></div><div><span>Más cercano</span><strong>{number(result.seismic.nearestDistanceKm, " km", 0)}</strong><small>distancia epicentral</small></div></div></article>
              <article className="panel seismic-history-panel"><div className="panel-heading"><div><span className="panel-kicker">Tendencia histórica</span><h3>Cinco años calendario</h3></div><BarChart3 size={19} className="accent-icon" /></div><SeismicHistoryChart history={result.seismicHistory} /></article>
              <article className="panel event-list-panel"><div className="panel-heading"><div><span className="panel-kicker">Eventos recientes</span><h3>Historial cercano</h3></div></div><div className="event-list">{result.seismic.events.length ? result.seismic.events.map((event) => <a key={event.id} href={event.url} target="_blank" rel="noreferrer"><span className="magnitude-bubble">M{number(event.magnitude)}</span><div><strong>{event.place}</strong><span>{date(event.time, { dateStyle: "medium", timeStyle: "short" })}</span></div><div className="event-meta"><strong>{number(event.distanceKm, " km", 0)}</strong><span>{number(event.depthKm, " km")} prof.</span></div><ChevronRight size={16} /></a>) : <div className="empty-panel">No se encontraron eventos.</div>}</div></article>
            </div>}

            {result && activeTab === "sources" && <div className="tab-panel sources-layout" role="tabpanel">
              <article className="panel source-intro"><div className="source-intro-icon"><Layers3 size={24} /></div><div><span className="panel-kicker">Trazabilidad</span><h3>Datos objetivos y verificables</h3><p>Cada indicador conserva su fuente. El MDE IGN nacional aporta detalle de 10 m y ERA5-Land proporciona el histórico climático.</p></div><button type="button" onClick={downloadJson}><ArrowDownToLine size={16} /> Exportar datos</button></article>
              <div className="source-list">{result.sources.map((item) => <SourceCard key={item.name} source={item} />)}</div>
              <div className="methodology-note"><CircleAlert size={17} /><div><strong>Alcance técnico</strong><p>{result.disclaimer}</p></div></div>
            </div>}
          </section>
        </main>
      </div>
    </div>
  );
}

