# Guía de publicación de Civilscope CR en GitHub y Vercel

Esta guía explica cómo publicar el proyecto local ubicado en `C:\git\Civilscope` usando una cuenta personal de GitHub y una cuenta de Vercel.

## 1. Antes de comenzar

Compruebe que dispone de:

- Una cuenta activa de GitHub.
- Una cuenta de Vercel conectada con GitHub.
- Git instalado en Windows.
- Acceso a PowerShell.

Los siguientes archivos están excluidos mediante `.gitignore` y no se subirán a GitHub:

- `MDE_5K.tif`
- `MDE_5K.tif.aux.xml`
- `MDE_5K_COG.tif`
- `Vista.mp4`
- Archivos `.env*`

No elimine esas reglas. El MDE es demasiado grande para formar parte del repositorio o del paquete normal de despliegue.

## 2. Comprobar el proyecto local

Abra PowerShell y ejecute:

```powershell
cd C:\git\Civilscope
npm install
npm run lint
npm run build
```

La publicación debe continuar únicamente si `lint` y `build` terminan sin errores.

## 3. Crear el repositorio en GitHub

1. Ingrese en [github.com](https://github.com/).
2. Presione el botón **New repository**.
3. Utilice un nombre como `civilscope-cr`.
4. Seleccione visibilidad **Public** si el código será visible para cualquier persona.
5. No marque las opciones para crear README, `.gitignore` o licencia, porque el proyecto local ya contiene archivos.
6. Presione **Create repository**.

GitHub mostrará la dirección del nuevo repositorio. Tendrá una forma similar a:

```text
https://github.com/TU_USUARIO/civilscope-cr.git
```

## 4. Preparar y subir el código

Desde PowerShell, dentro de `C:\git\Civilscope`, ejecute:

```powershell
git status --short
git add .
git status --short
git commit -m "Publicar Civilscope CR"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/civilscope-cr.git
git push -u origin main
```

Reemplace `TU_USUARIO` por el nombre real de su cuenta.

Si Git solicita autenticación, siga el inicio de sesión seguro de GitHub que aparece en el navegador. No utilice ni comparta la contraseña de su cuenta dentro del código.

### Si aparece `remote origin already exists`

Compruebe primero la dirección configurada:

```powershell
git remote -v
```

Si es incorrecta, reemplácela:

```powershell
git remote set-url origin https://github.com/TU_USUARIO/civilscope-cr.git
git push -u origin main
```

## 5. Importar el repositorio en Vercel

1. Ingrese en [vercel.com](https://vercel.com/) mediante su cuenta de GitHub.
2. En el panel, seleccione **Add New** y después **Project**.
3. Localice `civilscope-cr` y presione **Import**.
4. Verifique la configuración:

| Opción | Valor |
| --- | --- |
| Project Name | `civilscope-cr` |
| Framework Preset | Next.js |
| Root Directory | `./` |
| Build Command | Predeterminado (`next build`) |
| Output Directory | Predeterminado de Next.js |
| Install Command | Predeterminado (`npm install`) |

5. Para el primer despliegue no es obligatorio configurar variables de entorno.
6. Presione **Deploy**.

Vercel construirá la aplicación y entregará una dirección similar a:

```text
https://civilscope-cr.vercel.app
```

## 6. Funcionamiento del terreno en el primer despliegue

Sin una variable `CIVILSCOPE_DEM_URL`, la plataforma:

- Mantiene disponible la capa visual WMTS del MDE IGN 2017.
- Utiliza Copernicus DEM de 90 m como respaldo para los cálculos numéricos.
- Muestra una advertencia indicando el cambio de fuente y resolución.

Esta configuración permite publicar y probar la plataforma antes de contratar o configurar almacenamiento para el COG.

## 7. Activar el MDE numérico de 10 m

El archivo `MDE_5K_COG.tif` debe alojarse en almacenamiento de objetos que proporcione:

- Una URL estable accesible desde Internet.
- Solicitudes parciales HTTP Range.
- Acceso al archivo sin páginas HTML, confirmaciones de descarga ni cookies interactivas.

Google Drive es adecuado como respaldo, pero no se recomienda como origen de producción. Resultan más apropiados Google Cloud Storage, Cloudflare R2, Amazon S3 o Backblaze B2.

Cuando tenga la URL directa del COG:

1. Abra el proyecto en Vercel.
2. Vaya a **Settings → Environment Variables**.
3. Cree la variable:

```text
CIVILSCOPE_DEM_URL=https://almacenamiento.example/MDE_5K_COG.tif
```

4. Habilítela para **Production** y **Preview**.
5. Guarde los cambios.
6. Abra **Deployments** y vuelva a desplegar la versión más reciente.

No configure `CIVILSCOPE_DEM_PATH` en Vercel. Esa variable es únicamente para rutas de archivos locales.

## 8. Verificación después del despliegue

Abra la dirección de Vercel y compruebe:

1. Se muestra la marca **Civilscope CR**.
2. El mapa carga las capas Satélite y Calles.
3. La capa **MDE IGN 2017 · 10 m** puede activarse.
4. Es posible seleccionar un punto dentro de Costa Rica.
5. El botón **Analizar sitio** devuelve resultados.
6. La tarjeta Elevación indica la fuente y resolución utilizadas.
7. Las pestañas Resumen, Clima y agua, Sismicidad y Fuentes funcionan.
8. Las exportaciones PDF y JSON se descargan correctamente.

Para probar San José:

```text
Latitud: 9.92810
Longitud: -84.09070
```

Con el COG configurado correctamente, la fuente debe indicar `MDE IGN 2017 · 10 m`.

## 9. Publicar cambios posteriores

Después de modificar la aplicación:

```powershell
cd C:\git\Civilscope
npm run lint
npm run build
git add .
git commit -m "Describir brevemente el cambio"
git push
```

Cada envío a la rama `main` iniciará automáticamente un nuevo despliegue de producción en Vercel. Las ramas adicionales y solicitudes de cambio pueden producir despliegues de vista previa.

## 10. Problemas frecuentes

### Vercel no encuentra el repositorio

- Confirme que Vercel está conectado con la cuenta correcta de GitHub.
- Revise los permisos de la aplicación de Vercel en GitHub.
- Si el repositorio pertenece a una organización, permita acceso explícito a ese repositorio.

### El build falla

- Ejecute primero `npm run build` localmente.
- Compruebe que `package.json` y `package-lock.json` estén incluidos en GitHub.
- Mantenga **Root Directory** en `./`.
- Revise el registro del despliegue en Vercel.

### El análisis muestra 90 m

- Confirme que `CIVILSCOPE_DEM_URL` esté escrita correctamente.
- Abra la URL en una ventana privada para comprobar que no solicite autenticación.
- Confirme que el servidor responda solicitudes HTTP Range.
- Vuelva a desplegar después de cambiar la variable.

### Una fuente externa no responde

Open-Meteo, NASA POWER, USGS y SNIT son servicios externos. Una falla parcial puede mostrar una advertencia sin impedir el resto del informe. Repita la consulta más tarde y revise la pestaña **Fuentes**.

## 11. Seguridad

- No suba contraseñas, tokens o archivos `.env` a GitHub.
- Configure secretos únicamente desde **Vercel → Settings → Environment Variables**.
- No elimine las exclusiones del MDE en `.gitignore`.
- Revise los cambios con `git status --short` antes de cada commit.

## 12. Documentación relacionada

- [Manual de uso de Civilscope CR](MANUAL_DE_USO.md)
- [README principal](../README.md)
- [Documentación oficial de GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [Despliegues Git en Vercel](https://vercel.com/docs/git)
