# Civilscope CR

Plataforma pública y gratuita de prefactibilidad territorial para Costa Rica. Integra terreno, clima, energía y sismicidad en una consulta trazable y exportable. Civilscope CR es una iniciativa independiente y no tiene relación con el Colegio de Ingenieros Civiles ni requiere afiliación.

## Documentación

- [Manual de uso de Civilscope CR](docs/MANUAL_DE_USO.md)
- [Guía de publicación en GitHub y Vercel](docs/GUIA_DESPLIEGUE_GITHUB_VERCEL.md)


## Capacidades incluidas

- Mapa interactivo limitado a Costa Rica, con imagen satelital, calles y la capa oficial WMTS del MDE IGN 2017.
- Selección por mapa, coordenadas, ubicación del dispositivo o sitios frecuentes.
- Elevación, pendiente, orientación y relieve derivados del MDE nacional de 10 × 10 m.
- Respaldo automático con Copernicus DEM de 90 m si el MDE nacional no está disponible.
- Temperatura, viento, precipitación, radiación y humedad superficial del suelo.
- Cuatro gráficas climáticas recientes de 24 meses mediante ERA5-Seamless: temperatura, viento, radiación y humedad del suelo.
- Climatología de precipitación CHIRPS v2.0 de diez años completos, con promedios acumulados por mes y promedios por día del año a 0,05° (~5,6 km).
- Potencial solar indicativo mediante NASA POWER.
- Actividad sísmica reciente y tendencia de cinco años para eventos M2.5+ mediante USGS.
- Lectura preliminar de complejidad topográfica y riesgo de drenaje.
- Exportación del informe en PDF y de todos los datos en JSON.
- Trazabilidad y estado individual de cada fuente.

## Modelo de elevación nacional

El WMTS de SNIT sirve la capa `IGN_MDE_2017` como teselas PNG para visualización. El cálculo numérico utiliza el GeoTIFF oficial en CRTM05 (EPSG:5367), cuya cuadrícula es de 10 m.

El servidor primero busca `MDE_5K.tif` en la raíz del proyecto. El original pesa aproximadamente 5,2 GB y está excluido de Git. La conversión local generó `MDE_5K_COG.tif`, un COG DEFLATE sin pérdida de 1,524 GiB, con bloques de 512 píxeles y siete niveles de pirámides.

Cuando no existe un TIFF local ni se configura otra URL, Civilscope usa el COG público `MDE_5K_COG.tif` alojado en Google Drive. El lector solicita únicamente los bloques requeridos mediante HTTP Range.

Para probar la salida optimizada localmente:

```powershell
$env:CIVILSCOPE_DEM_PATH="C:\git\Civilscope\MDE_5K_COG.tif"
npm run dev
```

Para reemplazar la fuente remota, configure una URL directa o una URL compartida de Google Drive:

```powershell
$env:CIVILSCOPE_DEM_URL="https://drive.google.com/file/d/ID_DEL_ARCHIVO/view"
npm run dev
```

Las URLs compartidas de Drive se convierten internamente a descargas que aceptan solicitudes parciales. El archivo debe tener acceso **Cualquier persona con el enlace → Lector**.

Si la fuente nacional local o remota no está disponible, la plataforma informa el cambio y usa el respaldo de 90 m.

## Fuentes

| Fuente | Uso | Acceso |
| --- | --- | --- |
| IGN MDE 2017 / SNIT | Elevación y derivados a 10 m; capa WMTS | Público, sin autenticación |
| Copernicus DEM vía Open-Meteo | Respaldo de elevación a 90 m | Público para el MVP |
| ECMWF IFS HRES vía Open-Meteo | Pronóstico de precipitación y demás variables a 9 km | Público, sin clave |
| Open-Meteo / ERA5-Seamless | Temperatura, viento, radiación y humedad históricas de 24 meses | Público, sin clave |
| UCSB CHC CHIRPS v2.0 vía ClimateSERV | Precipitación diaria y mensual promediada sobre diez años completos | Público, sin clave |
| NASA POWER Daily | Radiación, temperatura y viento recientes | Público, sin clave |
| USGS Earthquake Catalog | Sismicidad reciente e histórica | Público, sin clave |

## Desarrollo local

Requisitos: Node.js 20.9 o posterior.

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

Comprobaciones:

```bash
npm run lint
npm run build
```

## Arquitectura

- Next.js 16 App Router y React 19.
- `src/app/api/analyze/route.ts` valida la solicitud y ejecuta las consultas científicas en Node.js.
- `src/lib/terrain-dem.ts` transforma WGS84 a CRTM05 y lee únicamente una ventana de 3 × 3 celdas del GeoTIFF.
- `src/lib/analysis.ts` consulta las fuentes en paralelo, calcula derivados y tolera fallos parciales.
- `src/lib/history.ts` consulta ERA5 y USGS, administra los trabajos asíncronos de CHIRPS en ClimateSERV y genera climatologías mensuales y diarias.
- `src/components/analysis-map.tsx` incorpora Leaflet y el WMTS oficial de SNIT.
- `src/components/dashboard.tsx` presenta indicadores, detalle técnico y exportaciones.

Las respuestas externas se revalidan cada 15 minutos. La ubicación se envía por `POST`, se valida contra los límites regionales y no se persiste.

## Alcance técnico

Los resultados son insumos de prefactibilidad. No sustituyen levantamiento topográfico, estudio geotécnico, hidrológico, ambiental, inspección de campo ni criterio técnico responsable.

## Próximas etapas recomendadas

1. Convertir y publicar el MDE como COG optimizado para producción.
2. Evaluar registros de estaciones meteorológicas del IMN para complementar el reanálisis ERA5-Land, sujeto a disponibilidad y condiciones de uso.
3. Incorporar límites administrativos oficiales, búsqueda geocodificada y guardado opcional de proyectos.
4. Agregar capas nacionales de amenazas, catastro y normativa conforme a sus condiciones de uso.
5. Mejorar informes, auditoría de consultas y herramientas públicas de colaboración.
