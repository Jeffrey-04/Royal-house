const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string;

// ============ TYPES ============

export type RouteStep = {
  instruction: string;
  distanceM: number;
  maneuverType: string;
  modifier?: string;
};

export type RouteData = {
  /** Coordonnées GeoJSON [lng, lat][] — directement utilisables dans MapView.routeLine */
  coords: [number, number][];
  steps: RouteStep[];
  distanceM: number;
  durationS: number;
};

// ============ DIRECTIONS API ============

/**
 * Calcule l'itinéraire routier entre deux points via Mapbox Directions API.
 * Retourne null si la requête échoue (token manquant, hors réseau, coordonnées invalides).
 */
export async function fetchRoute(
  fromLng: number, fromLat: number,
  toLng: number, toLat: number,
  profile: 'driving' | 'cycling' = 'driving',
): Promise<RouteData | null> {
  if (!MAPBOX_TOKEN) return null;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/` +
    `${fromLng},${fromLat};${toLng},${toLat}` +
    `?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full&steps=true&language=fr`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) return null;
    const steps: RouteStep[] = (route.legs[0]?.steps ?? []).map((s: any) => ({
      instruction: s.maneuver.instruction as string,
      distanceM: Math.round(s.distance as number),
      maneuverType: s.maneuver.type as string,
      modifier: s.maneuver.modifier as string | undefined,
    }));
    return {
      coords: route.geometry.coordinates as [number, number][],
      steps,
      distanceM: Math.round(route.distance as number),
      durationS: Math.round(route.duration as number),
    };
  } catch {
    return null;
  }
}

// ============ FORMATTERS ============

export function formatDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

export function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}
