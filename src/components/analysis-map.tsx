"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Crosshair } from "lucide-react";

import { COSTA_RICA_BOUNDS, isInsideCostaRicaBounds } from "@/lib/costa-rica";
import type { Coordinates } from "@/lib/types";

type AnalysisMapProps = {
  coordinates: Coordinates;
  onChange: (coordinates: Coordinates) => void;
};

export function AnalysisMap({ coordinates, onChange }: AnalysisMapProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const initialCoordinatesRef = useRef(coordinates);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;

    let active = true;
    void import("leaflet").then((leafletModule) => {
      if (!active || !elementRef.current || mapRef.current) return;
      const L = leafletModule.default;
      const initialCoordinates = initialCoordinatesRef.current;
      const bounds = L.latLngBounds(
        [COSTA_RICA_BOUNDS.south, COSTA_RICA_BOUNDS.west],
        [COSTA_RICA_BOUNDS.north, COSTA_RICA_BOUNDS.east],
      );
      const map = L.map(elementRef.current, {
        center: [initialCoordinates.lat, initialCoordinates.lng],
        zoom: 10,
        minZoom: 7,
        maxZoom: 17,
        maxBounds: bounds.pad(0.15),
        zoomControl: false,
      });

      const satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Imágenes © Esri · Datos cartográficos © OpenStreetMap contributors",
          maxZoom: 17,
        },
      ).addTo(map);
      const streets = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap contributors", maxZoom: 19 },
      );
      const ignDem = L.tileLayer(
        "https://geos1.snitcr.go.cr/ModelosIGN/wmts?service=WMTS&request=GetTile&version=1.0.0&layer=IGN_MDE_2017&style=_empty&tilematrixset=EPSG%3A3857&format=image%2Fpng&tilematrix=EPSG%3A3857%3A{z}&tilerow={y}&tilecol={x}",
        {
          attribution: "MDE 2017 © Instituto Geográfico Nacional / SNIT",
          maxZoom: 17,
          opacity: 0.72,
        },
      );

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control
        .layers(
          { Satélite: satellite, Calles: streets },
          {
            "MDE IGN 2017 · 10 m": ignDem,
          },
          { position: "topright", collapsed: false },
        )
        .addTo(map);
      L.rectangle(bounds, {
        color: "#c9f17c",
        weight: 1,
        fill: false,
        dashArray: "5 6",
        interactive: false,
      }).addTo(map);

      const icon = L.divIcon({
        className: "civilscope-map-marker",
        html: "<span></span>",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker(
        [initialCoordinates.lat, initialCoordinates.lng],
        { icon, keyboard: false },
      ).addTo(map);

      map.on("click", (event) => {
        const next = {
          lat: Number(event.latlng.lat.toFixed(5)),
          lng: Number(event.latlng.lng.toFixed(5)),
        };
        if (!isInsideCostaRicaBounds(next)) return;
        marker.setLatLng(event.latlng);
        onChangeRef.current(next);
      });

      mapRef.current = map;
      markerRef.current = marker;
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    markerRef.current?.setLatLng([coordinates.lat, coordinates.lng]);
  }, [coordinates]);

  return (
    <div className="map-shell">
      <div
        ref={elementRef}
        className="map-canvas"
        aria-label="Mapa satelital interactivo de Costa Rica"
      />
      <div className="map-topline">
        <span className="live-dot" aria-hidden="true" />
        Seleccioná un punto en el mapa
      </div>
      <button
        className="map-center-button"
        type="button"
        onClick={() =>
          mapRef.current?.flyTo([coordinates.lat, coordinates.lng], 12, {
            duration: 0.8,
          })
        }
      >
        <Crosshair size={16} aria-hidden="true" />
        Centrar sitio
      </button>
      <div className="map-coordinate-readout">
        <span>{coordinates.lat.toFixed(5)}° N</span>
        <span>{Math.abs(coordinates.lng).toFixed(5)}° O</span>
      </div>
    </div>
  );
}

