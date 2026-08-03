# Análisis de referencia del video Vista

Se revisó el tramo comprendido entre `00:50` y `01:50` mediante capturas cada diez segundos. Las imágenes se conservan en [`docs/capturas-vista`](capturas-vista/).

| Tiempo | Captura | Hallazgo útil | Aplicación en Civilscope CR |
| --- | --- | --- | --- |
| 00:50 | [Fuentes de información](capturas-vista/vista-00-50.jpg) | Presentación explícita de las fuentes utilizadas. | Mantener la pestaña Fuentes y diferenciar datos actuales, históricos y capas nacionales. |
| 01:00 | [Gráfico azul](capturas-vista/vista-01-00.jpg) | Comparaciones mediante barras dentro de tarjetas. | Incorporar barras mensuales de precipitación y tendencias anuales de sismicidad. |
| 01:10 | [Serie histórica](capturas-vista/vista-01-10.jpg) | Resumen agregado acompañado por una serie temporal. | Mostrar promedio climático, lluvia anualizada y registro mensual de 24 meses. |
| 01:20 | [Mapa de ubicación](capturas-vista/vista-01-20.jpg) | El mapa permanece como contexto principal del sitio. | Conservar el mapa superior y vincular todos los históricos a la coordenada activa. |
| 01:30 | [Hidrología y geología](capturas-vista/vista-01-30.jpg) | Agrupación temática de indicadores compactos. | Mantener tarjetas por tema; dejar geología y capas de suelo nacionales como siguiente integración. |
| 01:40 | [Histórico de temperatura](capturas-vista/vista-01-40.jpg) | Comparación entre valores agregados y comportamiento temporal. | Añadir histórico climático ERA5-Land con temperatura y precipitación por mes. |
| 01:50 | [Histórico de viento](capturas-vista/vista-01-50.jpg) | Variables históricas adicionales y lectura por periodo. | Incluir viento máximo medio y radiación mensual dentro de los datos JSON históricos. |

## Mejoras derivadas

1. Histórico climático de 24 meses completos mediante ERA5-Land a través de Open-Meteo Archive.
2. Resumen con temperatura media, precipitación anualizada y mes más lluvioso.
3. Histórico sísmico de cinco años calendario mediante USGS FDSN.
4. Comparación anual de eventos dentro de 250 km y dentro de 100 km.
5. Estados independientes por fuente para que una falla histórica no elimine el pronóstico o los datos actuales.

Los históricos climáticos son datos de reanálisis; no deben interpretarse como mediciones directas de una estación meteorológica ubicada en el sitio.
