# Manual de uso de Civilscope CR

## 1. Descripción

Civilscope CR es una plataforma pública, gratuita e independiente para realizar análisis preliminares de sitios dentro de Costa Rica. No requiere registro, afiliación profesional.

La plataforma integra información de terreno, clima, energía solar, actividad sísmica, valores fiscales de referencia, información catastral y cobertura agropecuaria o forestal pública del punto. Sus resultados son insumos de prefactibilidad y no sustituyen estudios técnicos de campo.

## 2. Acceso a la plataforma

1. Abra la dirección web pública de Civilscope CR en un navegador actualizado.
2. Espere a que se muestre el mapa de Costa Rica y el panel **Área de estudio**.
3. No es necesario iniciar sesión.

En teléfonos y pantallas pequeñas, utilice el botón de menú situado junto al logotipo para abrir o cerrar el panel de selección.

## 3. Selección del sitio

Puede definir un sitio de cuatro maneras.

### 3.1 Selección en el mapa

1. Acerque o aleje el mapa con los controles de zoom.
2. Haga clic o toque un punto dentro de Costa Rica.
3. Confirme las coordenadas mostradas sobre el mapa.

El botón **Centrar sitio** vuelve a colocar la ubicación seleccionada en el centro del mapa.

### 3.2 Coordenadas manuales

1. Escriba la latitud en el campo **Latitud**.
2. Escriba la longitud en el campo **Longitud**.
3. Utilice grados decimales. En Costa Rica la longitud normalmente es negativa.

Ejemplo para San José:

```text
Latitud: 9.92810
Longitud: -84.09070
```

La plataforma rechaza puntos fuera de los límites regionales configurados para Costa Rica.

### 3.3 Ubicación del dispositivo

1. Presione **Usar mi ubicación**.
2. Autorice el acceso a la ubicación cuando el navegador lo solicite.
3. Verifique el punto seleccionado antes de analizarlo.

La precisión depende del dispositivo, el navegador y la disponibilidad de GPS. La ubicación se usa para efectuar la consulta y no se almacena permanentemente.

### 3.4 Sitios frecuentes

Seleccione uno de los sitios mostrados en la lista **Sitios frecuentes** para cargar sus coordenadas automáticamente.

## 4. Nombre y ejecución del análisis

1. Escriba un nombre descriptivo en **Nombre del sitio**. Por ejemplo: `Lote residencial Cartago`.
2. Verifique la ubicación en el mapa.
3. Presione **Analizar sitio**.
4. Espere mientras Civilscope CR consulta las fuentes disponibles.

El estado del sitio cambia de **Pendiente** a **Analizado** cuando finaliza la consulta. Si una fuente externa no responde, la plataforma muestra una advertencia y conserva los demás resultados disponibles.

## 5. Capas del mapa

El selector situado en la esquina superior derecha permite cambiar o superponer capas.

- **Satélite:** imágenes de referencia del terreno.
- **Calles:** mapa vial de OpenStreetMap.
- **MDE IGN 2017 · 10 m:** representación visual oficial del modelo digital de elevación publicado por IGN/SNIT mediante WMTS.

La capa WMTS es una imagen cartográfica. Los valores numéricos de elevación, pendiente y relieve se calculan en el servidor desde el GeoTIFF del MDE IGN cuando está disponible.

## 6. Indicadores principales

Después del análisis se muestran cuatro indicadores resumidos.

### 6.1 Elevación

Altura estimada del punto central en metros sobre el nivel de referencia del modelo. Debajo del valor se indica la fuente y su resolución:

- `MDE IGN 2017 · 10 m`: se utilizó el modelo nacional de alta resolución.
- `Copernicus DEM · 90 m`: se utilizó el respaldo global porque el MDE nacional no estaba disponible.

### 6.2 Pendiente

Inclinación aproximada del terreno, expresada en grados. También se muestra una clasificación descriptiva y la orientación predominante del descenso.

| Pendiente | Clasificación |
| --- | --- |
| Menor de 3° | Plano |
| 3° a menos de 8° | Suave |
| 8° a menos de 15° | Moderado |
| 15° a menos de 30° | Fuerte |
| 30° o más | Escarpado |

### 6.3 Potencial solar

Radiación solar media reciente en `kWh/m²/día`, acompañada por una clasificación indicativa. No representa un diseño fotovoltaico definitivo.

### 6.4 Actividad sísmica

Cantidad de eventos de magnitud 2,5 o superior registrados por USGS dentro de 250 km durante los últimos 12 meses.

## 7. Secciones del informe

### 7.1 Resumen

Incluye:

- Malla de elevación de 3 × 3 celdas alrededor del punto.
- Resolución utilizada en metros por píxel.
- Relieve local, calculado como la diferencia entre el valor máximo y mínimo de la malla.
- Orientación estimada del terreno.
- Riesgo preliminar de drenaje.
- Complejidad preliminar del terreno.
- Condiciones meteorológicas actuales.
- Rendimiento solar indicativo.
- Valor fiscal de referencia por metro cuadrado, zona homogénea y tipo de uso publicados por el Ministerio de Hacienda.
- Plano catastrado, finca, identificador inmobiliario y zona publicados por el Registro Inmobiliario mediante SNIT.
- Categoría de cobertura del Mapa Agropecuario y Forestal 2020 publicado por SINIA.

Las categorías **Bajo**, **Moderado** y **Alto** son señales de prefactibilidad, no dictámenes técnicos.

#### Valor fiscal de referencia del terreno

Civilscope consulta la capa **Zonas Homogéneas ONT** del Ministerio de Hacienda para identificar el polígono que contiene el punto seleccionado. Cuando existe información publicada, muestra:

- Valor de referencia en colones por metro cuadrado.
- Nombre y código oficial de la zona homogénea.
- Código del tipo de uso.

Este dato corresponde a la zona homogénea y no constituye un avalúo individual del inmueble ni una estimación del precio comercial. Las características específicas de un predio pueden modificar su valoración.

#### Información catastral del punto

Civilscope consulta mediante `GetFeatureInfo` las capas **Zona 1** y **Zona 2** del Registro Inmobiliario publicadas por SNIT. Cuando el punto coincide con una parcela, muestra:

- Número de plano catastrado, cuando está publicado.
- Número de finca.
- Identificador inmobiliario.
- Zona catastral y códigos de provincia, cantón y distrito.

Si el atributo `plano` no contiene un valor, la plataforma muestra **No publicado** sin inventar ni inferir un número. Si el punto coincide con varios registros, muestra todos y advierte que puede encontrarse sobre un límite catastral.

La consulta se ejecuta solamente al presionar **Analizar sitio** y utiliza caché para reducir el consumo del WMS. La información es indicativa y no sustituye una certificación registral ni un plano certificado.

#### Cobertura agropecuaria y forestal 2020

Civilscope consulta mediante `GetFeatureInfo` la capa **MAF2020** publicada por SINIA. Para el punto seleccionado muestra:

- La categoría de cobertura, por ejemplo cultivo, pasto, bosque o zona urbana, según el valor publicado.
- El código numérico de la clase.
- El año de referencia 2020.
- La resolución de 10 m.

La consulta solicita únicamente los atributos `CATEGORIA` y `value`, sin descargar la geometría completa. El resultado representa la cobertura identificada para 2020; no determina el uso actual, la aptitud agrícola, la zonificación legal ni los permisos aplicables al terreno.

### 7.2 Clima y agua

Presenta el pronóstico de siete días con:

El pronóstico utiliza explícitamente el modelo global ECMWF IFS HRES de 9 km, servido mediante Open-Meteo.

- Temperatura mínima y máxima.
- Precipitación diaria y acumulada.
- Velocidad máxima del viento.
- Radiación solar.
- Humedad superficial estimada del suelo.

Además combina dos ventanas históricas:

- **ERA5-Seamless, 24 meses completos:** temperatura media, viento máximo diario medio, radiación solar media diaria y humedad del suelo entre 0 y 7 cm.
- **CHIRPS v2.0, diez años calendario completos:** precipitación diaria a 0,05°, aproximadamente 5,6 km, consultada alrededor de las coordenadas seleccionadas mediante ClimateSERV.

Las gráficas CHIRPS muestran:

- El acumulado promedio de cada mes, calculado promediando el total de ese mes en cada uno de los diez años.
- El promedio de cada día del año, calculado con la misma fecha calendario en los diez años. El 29 de febrero se excluye para mantener una serie comparable de 365 días.
- La precipitación anual promedio y el mes climatológicamente más lluvioso.
- Promedio, valor mínimo y valor máximo de cada serie visible.

CHIRPS combina estimaciones satelitales con observaciones de estaciones y tiene mayor detalle espacial que ERA5 para lluvia. Aun así, representa una celda de cuadrícula y no una medición de pluviómetro exactamente en el punto.

### 7.3 Sismicidad

Muestra:

- Eventos dentro de 250 km.
- Eventos dentro de 100 km.
- Magnitud máxima reportada.
- Distancia al evento más cercano.
- Lista de eventos recientes con profundidad y enlace al registro de USGS.
- Conteos anuales durante cinco años calendario dentro de 250 km.
- Comparación anual de los eventos ubicados dentro de 100 km.

### 7.4 Fuentes

Enumera los servicios utilizados y su estado.

- **Activa:** la fuente respondió y participó en el informe.
- **No disponible:** la fuente no pudo consultarse o no se utilizó.
- **Requiere credenciales:** integración prevista que todavía necesita configuración externa.

Esta sección permite verificar la procedencia de cada grupo de datos.

## 8. Exportación

### 8.1 Informe PDF

1. Presione **Exportar PDF**.
2. El navegador descargará un informe con identificación, ubicación, indicadores, lectura preliminar, fuentes y alcance técnico.

### 8.2 Datos JSON

1. Presione **JSON** o **Exportar datos**.
2. El archivo descargado contiene la respuesta completa de la consulta, incluyendo coordenadas, malla de terreno, clima, energía, valor fiscal de referencia, información catastral, cobertura MAF2020, sismicidad, fuentes y advertencias.

El identificador del archivo comienza con `CIVILSCOPE` y contiene la fecha de generación.

## 9. Advertencias y respaldo del terreno

Si aparece el mensaje que indica que no se pudo leer el MDE IGN de 10 m, el análisis continúa con Copernicus DEM de 90 m. Revise siempre el nombre de la fuente mostrado debajo de **Elevación** y la resolución indicada en la malla.

Una falla parcial de clima, NASA POWER, Hacienda, SNIT catastral, SINIA MAF2020 o USGS no invalida automáticamente los datos que sí fueron obtenidos. La advertencia identifica qué información falta.

## 10. Privacidad y uso público

- No se requiere cuenta de usuario.
- La ubicación se utiliza únicamente para realizar la consulta.
- La versión actual no guarda proyectos ni historial personal.
- Los archivos PDF y JSON se generan para descarga en el dispositivo de la persona usuaria.

## 11. Solución de problemas

### El botón de análisis no funciona

- Confirme que la latitud y longitud sean números válidos.
- Verifique que el punto esté dentro de Costa Rica.
- Revise la conexión a Internet y vuelva a intentar.

### El navegador no permite usar mi ubicación

- Habilite el permiso de ubicación para el sitio.
- Compruebe que el navegador acceda a la plataforma mediante HTTPS.
- Como alternativa, escriba las coordenadas o seleccione el punto en el mapa.

### Aparece una advertencia de fuente no disponible

- Espere unos minutos y repita el análisis.
- Consulte la pestaña **Fuentes** para identificar el servicio afectado.
- Utilice los resultados restantes únicamente con su fuente y resolución correspondientes.

### No se descarga el PDF o JSON

- Permita descargas para el sitio en la configuración del navegador.
- Desactive temporalmente bloqueadores que impidan descargas generadas por la página.
- Ejecute nuevamente el análisis antes de exportar.

### No aparece la capa MDE en el mapa

- Active **MDE IGN 2017 · 10 m** desde el selector de capas.
- Acerque el mapa a una zona dentro de Costa Rica.
- Si el servicio WMTS está temporalmente fuera de línea, las otras capas pueden continuar funcionando.

### No aparece un plano catastrado

- Confirme en la pestaña **Fuentes** que el servicio catastral del SNIT esté activo.
- El punto puede estar fuera de las parcelas publicadas en Zona 1 y Zona 2.
- Algunos registros publican finca e identificador, pero no el atributo de plano; en ese caso se muestra **No publicado**.
- Si el servicio limita temporalmente las consultas, espere unos minutos y vuelva a analizar.

### No aparece una categoría MAF2020

- Confirme en la pestaña **Fuentes** que el Mapa Agropecuario y Forestal 2020 esté activo.
- El punto puede estar fuera de la cobertura publicada o sobre una celda sin clasificación.
- Si el WMS de SINIA no responde, espere unos minutos y vuelva a analizar.

## 12. Alcance técnico

Civilscope CR facilita una revisión inicial del sitio. No sustituye:

- Levantamiento topográfico.
- Estudio geotécnico o de suelos.
- Estudio hidrológico e hidráulico.
- Evaluación ambiental.
- Certificación catastral, registral o normativa.
- Plano catastrado certificado.
- Determinación del uso actual, aptitud agrícola o zonificación legal a partir de MAF2020.
- Avalúo fiscal individual o estimación del precio comercial.
- Inspección de campo.
- Diseño firmado por profesionales responsables.

Antes de tomar decisiones de diseño, compra, construcción o inversión, verifique los resultados con estudios específicos y fuentes oficiales aplicables al proyecto.
