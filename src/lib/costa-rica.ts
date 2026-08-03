import type { Coordinates } from "@/lib/types";

export const COSTA_RICA_BOUNDS = {
  north: 11.25,
  south: 8.0,
  west: -86.0,
  east: -82.45,
} as const;

export const SITE_PRESETS = [
  { name: "San José centro", lat: 9.932, lng: -84.079, province: "San José" },
  { name: "Liberia", lat: 10.635, lng: -85.437, province: "Guanacaste" },
  { name: "Ciudad Quesada", lat: 10.324, lng: -84.428, province: "Alajuela" },
  { name: "Puntarenas", lat: 9.977, lng: -84.829, province: "Puntarenas" },
  { name: "Limón", lat: 9.99, lng: -83.036, province: "Limón" },
  { name: "San Isidro de El General", lat: 9.372, lng: -83.704, province: "San José" },
] as const;

const PROVINCE_CENTERS = [
  { name: "San José", lat: 9.932, lng: -84.079 },
  { name: "Alajuela", lat: 10.016, lng: -84.214 },
  { name: "Cartago", lat: 9.864, lng: -83.919 },
  { name: "Heredia", lat: 10.003, lng: -84.116 },
  { name: "Guanacaste", lat: 10.635, lng: -85.437 },
  { name: "Puntarenas", lat: 9.977, lng: -84.829 },
  { name: "Limón", lat: 9.99, lng: -83.036 },
] as const;

export function isInsideCostaRicaBounds({ lat, lng }: Coordinates) {
  return (
    lat >= COSTA_RICA_BOUNDS.south &&
    lat <= COSTA_RICA_BOUNDS.north &&
    lng >= COSTA_RICA_BOUNDS.west &&
    lng <= COSTA_RICA_BOUNDS.east
  );
}

export function nearestProvince({ lat, lng }: Coordinates) {
  return PROVINCE_CENTERS.reduce((nearest, province) => {
    const distance = Math.hypot(lat - province.lat, lng - province.lng);
    const nearestDistance = Math.hypot(
      lat - nearest.lat,
      lng - nearest.lng,
    );
    return distance < nearestDistance ? province : nearest;
  }).name;
}

