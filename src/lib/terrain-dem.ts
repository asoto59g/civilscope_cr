import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

import proj4 from "proj4";
import type { GeoTIFFImage } from "geotiff";

import type { Coordinates } from "@/lib/types";

const DEFAULT_DEM_PATH = join(process.cwd(), "MDE_5K.tif");
const DEFAULT_REMOTE_DEM_URL =
  "https://drive.usercontent.google.com/download?id=1nqYFsRDveZOnyVSu6Gg1Xd1clz8NAVMM&export=download&confirm=t";
const CRTM05_DEFINITION =
  "+proj=tmerc +lat_0=0 +lon_0=-84 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-0.16959,0.35312,0.51846,-0.03385,0.16325,-0.03446,0.03693 +units=m +no_defs +type=crs";

let demImagePromise: Promise<GeoTIFFImage> | null = null;

function normalizeRemoteDemUrl(value: string) {
  try {
    const url = new URL(value);

    if (url.hostname === "drive.google.com") {
      const pathMatch = url.pathname.match(/^\/file\/d\/([^/]+)/);
      const fileId = pathMatch?.[1] ?? url.searchParams.get("id");

      if (fileId) {
        const downloadUrl = new URL(
          "https://drive.usercontent.google.com/download",
        );
        downloadUrl.searchParams.set("id", fileId);
        downloadUrl.searchParams.set("export", "download");
        downloadUrl.searchParams.set("confirm", "t");
        return downloadUrl.toString();
      }
    }
  } catch {
    // geotiff.js emitirá el error de URL con el mismo manejo de respaldo.
  }

  return value;
}

async function openDemImage() {
  const { fromFile, fromUrl } = await import("geotiff");
  const configuredRemoteUrl = process.env.CIVILSCOPE_DEM_URL?.trim();
  const configuredLocalPath = process.env.CIVILSCOPE_DEM_PATH?.trim();
  let tiff;

  if (configuredRemoteUrl) {
    tiff = await fromUrl(normalizeRemoteDemUrl(configuredRemoteUrl), {
      allowFullFile: false,
    });
  } else if (configuredLocalPath) {
    tiff = await fromFile(configuredLocalPath);
  } else if (existsSync(DEFAULT_DEM_PATH)) {
    tiff = await fromFile(DEFAULT_DEM_PATH);
  } else {
    tiff = await fromUrl(DEFAULT_REMOTE_DEM_URL, { allowFullFile: false });
  }

  return tiff.getImage();
}

function getDemImage() {
  demImagePromise ??= openDemImage().catch((error) => {
    demImagePromise = null;
    throw error;
  });
  return demImagePromise;
}

export type IgnDemSample = {
  gridM: number[];
  resolutionM: number;
};

export async function readIgnDemGrid({
  lat,
  lng,
}: Coordinates): Promise<IgnDemSample> {
  const image = await getDemImage();
  const [originX, originY] = image.getOrigin();
  const [resolutionX, resolutionY] = image.getResolution();
  const [x, y] = proj4("WGS84", CRTM05_DEFINITION, [lng, lat]);
  const column = Math.floor((x - originX) / resolutionX);
  const row = Math.floor((y - originY) / resolutionY);

  if (
    column < 1 ||
    row < 1 ||
    column + 1 >= image.getWidth() ||
    row + 1 >= image.getHeight()
  ) {
    throw new Error("El punto está fuera de la cobertura del MDE IGN.");
  }

  const rasters = await image.readRasters({
    window: [column - 1, row - 1, column + 2, row + 2],
    samples: [0],
  });
  const gridM = Array.from(rasters[0], Number);
  const noData = image.getGDALNoData();

  if (
    gridM.length !== 9 ||
    gridM.some(
      (value) =>
        !Number.isFinite(value) ||
        Math.abs(value) > 20_000 ||
        (noData !== null && value === noData),
    )
  ) {
    throw new Error("El MDE IGN no contiene una malla válida para este punto.");
  }

  return {
    gridM,
    resolutionM: Math.abs(resolutionX),
  };
}
