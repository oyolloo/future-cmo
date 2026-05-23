"use client";

import {
  AdvancedMarker,
  APIProvider,
  Map,
  Pin,
} from "@vis.gl/react-google-maps";
import { useMemo } from "react";

import type { SearchResultRow } from "../_lib/actions";

type Props = {
  results: SearchResultRow[];
};

const FALLBACK_CENTER = { lat: 33.4942, lng: -111.9261 }; // Scottsdale

export function ResultsMap({ results }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const placed = useMemo(
    () =>
      results.filter(
        (r): r is SearchResultRow & { lat: number; lng: number } =>
          r.lat != null && r.lng != null,
      ),
    [results],
  );

  const center = useMemo(() => {
    if (placed.length === 0) return FALLBACK_CENTER;
    const sum = placed.reduce(
      (acc, r) => ({ lat: acc.lat + r.lat, lng: acc.lng + r.lng }),
      { lat: 0, lng: 0 },
    );
    return { lat: sum.lat / placed.length, lng: sum.lng / placed.length };
  }, [placed]);

  if (!apiKey) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-lg border border-border bg-card">
        <p className="text-comment text-center">
          // NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set
          <br />
          // add it to apps/web/.env to render the map
        </p>
      </div>
    );
  }

  if (placed.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-lg border border-border bg-card">
        <p className="text-comment">// no geolocated results to plot</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <APIProvider apiKey={apiKey}>
        <Map
          style={{ width: "100%", height: "360px" }}
          defaultCenter={center}
          defaultZoom={11}
          mapId="future-cmo-gm-prospecting"
          colorScheme="DARK"
          disableDefaultUI={false}
          gestureHandling="cooperative"
        >
          {placed.map((r) => (
            <AdvancedMarker
              key={r.placeId}
              position={{ lat: r.lat, lng: r.lng }}
              title={r.name}
            >
              <Pin
                background="oklch(0.70 0.16 50)"
                borderColor="oklch(0.55 0.16 50)"
                glyphColor="oklch(0.15 0.008 60)"
              />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}
