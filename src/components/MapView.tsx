import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import locationPinUrl from "@/assets/location-pin.svg?url";
import bicycleUrl   from "@/assets/bicycle.svg?url";
import bikeUrl      from "@/assets/bike.svg?url";
import carUrl       from "@/assets/car.svg?url";
import crownUrl     from "@/assets/crown.svg?url";

export type VehicleType = 'bike' | 'moto' | 'car';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  kind: "restaurant" | "courier" | "dropoff" | "pickup";
  label?: string;
  pulse?: boolean;
  vehicle?: VehicleType;
  avatarUrl?: string;
};

interface MapViewProps {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  fitToMarkers?: boolean;
  routeLine?: [number, number][];
  onMarkerClick?: (id: string) => void;
  selectedId?: string | null;
  className?: string;
}

const BRAND = "oklch(0.65 0.21 25)";
const BRAND_HEX = "#d97706"; // approximation hex pour les triangles CSS

function vehicleIconUrl(v?: VehicleType): string {
  if (v === 'bike') return bicycleUrl;
  if (v === 'car')  return carUrl;
  return bikeUrl; // moto par défaut
}

function buildMarkerElement(m: MapMarker): HTMLElement {
  // ── Wrapper : Mapbox applique son transform ici — ne jamais toucher
  const wrap = document.createElement('div');
  wrap.className = 'map-pin';
  wrap.dataset.kind = m.kind;
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;position:relative;';

  if (m.kind === 'dropoff') {
    // ── Location-pin SVG (avec avatar optionnel superposé)
    const pinWrap = document.createElement('div');
    pinWrap.style.cssText = 'position:relative;width:36px;height:46px;';

    const img = document.createElement('img');
    img.src = locationPinUrl;
    img.style.cssText = 'width:36px;height:46px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.28));';
    pinWrap.appendChild(img);

    if (m.avatarUrl) {
      const av = document.createElement('img');
      av.src = m.avatarUrl;
      av.style.cssText = 'position:absolute;top:5px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;object-fit:cover;border:1px solid white;';
      pinWrap.appendChild(av);
    }
    wrap.appendChild(pinWrap);

  } else if (m.kind === 'restaurant' || m.kind === 'pickup') {
    // ── Chip blanc + triangle pointer (couronne SVG, sans label)
    const chip = document.createElement('div');
    chip.style.cssText = `
      background:white;border-radius:10px;
      padding:7px 9px;
      box-shadow:0 4px 14px rgba(0,0,0,.18);
      display:flex;align-items:center;justify-content:center;
      transition:transform .15s ease;
      border:1.5px solid rgba(0,0,0,.06);
    `;
    const icon = document.createElement('img');
    icon.src = crownUrl;
    icon.alt = 'Restaurant';
    icon.style.cssText = 'width:22px;height:22px;display:block;';
    chip.appendChild(icon);
    const tri = document.createElement('div');
    tri.style.cssText = 'width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid white;margin-top:-1px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.1));';
    wrap.appendChild(chip);
    wrap.appendChild(tri);
    wrap.onmouseenter = () => (chip.style.transform = 'scale(1.06)');
    wrap.onmouseleave = () => (chip.style.transform = 'scale(1)');

  } else {
    // ── Courier : pill coloré + triangle + pulse optionnel
    const chip = document.createElement('div');
    chip.style.cssText = `
      background:${BRAND};border-radius:20px;
      padding:7px 10px;
      box-shadow:0 4px 14px rgba(0,0,0,.22);
      display:flex;align-items:center;gap:5px;
      white-space:nowrap;
      transition:transform .15s ease;
      position:relative;
    `;
    const icon = document.createElement('img');
    icon.src = vehicleIconUrl(m.vehicle);
    icon.alt = m.vehicle ?? 'courier';
    icon.style.cssText = 'width:24px;height:24px;display:block;filter:brightness(0) invert(1);';
    chip.appendChild(icon);

    if (m.pulse) {
      const ring = document.createElement('span');
      ring.style.cssText = `position:absolute;inset:-5px;border-radius:24px;border:2.5px solid ${BRAND};opacity:.55;animation:pingScale 1.6s ease-out infinite;`;
      chip.appendChild(ring);
    }

    const tri = document.createElement('div');
    tri.style.cssText = `width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid ${BRAND_HEX};margin-top:-1px;`;

    wrap.appendChild(chip);
    wrap.appendChild(tri);
    wrap.onmouseenter = () => (chip.style.transform = 'scale(1.08)');
    wrap.onmouseleave = () => (chip.style.transform = 'scale(1)');
  }

  return wrap;
}

export function MapView({
  markers,
  center = [11.5167, 3.8917],
  zoom = 12,
  fitToMarkers,
  routeLine,
  onMarkerClick,
  selectedId,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;

  // Init map
  useEffect(() => {
    if (!containerRef.current || !token || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center,
      zoom,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setReady(true));
    map.on("error", (e) => {
      console.error("[Mapbox error]", e);
      setMapError(e.error?.message ?? "Erreur de chargement de la carte");
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const currentIds = new Set(markers.map((m) => m.id));
    // Supprimer les marqueurs obsolètes
    markersRef.current.forEach((mk, id) => {
      if (!currentIds.has(id)) {
        mk.remove();
        markersRef.current.delete(id);
      }
    });

    const validMarkers = markers.filter(
      (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)
    );

    validMarkers.forEach((m) => {
      const existing = markersRef.current.get(m.id);
      if (existing) {
        // Mettre à jour la position
        existing.setLngLat([m.lng, m.lat]);
        // Mettre à jour l'émoji véhicule si le courier change de véhicule
        if (m.kind === 'courier') {
          const el = existing.getElement();
          const icon = el.querySelector('img') as HTMLImageElement | null;
          if (icon) icon.src = vehicleIconUrl(m.vehicle);
        }
        return;
      }

      const el = buildMarkerElement(m);

      el.onclick = (e) => {
        e.stopPropagation();
        onMarkerClick?.(m.id);
      };

      // anchor 'bottom' = la pointe du triangle/pin pointe vers les coordonnées
      const anchor = (m.kind === 'restaurant' || m.kind === 'pickup' || m.kind === 'courier' || m.kind === 'dropoff')
        ? 'bottom' as const
        : 'center' as const;

      const marker = new mapboxgl.Marker({ element: el, anchor })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      markersRef.current.set(m.id, marker);
    });

    if (fitToMarkers && validMarkers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      validMarkers.forEach((m) => bounds.extend([m.lng, m.lat]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 600 });
    }
  }, [markers, ready, selectedId, onMarkerClick, fitToMarkers]);

  // Route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const sourceId = "route";
    const casingId = "route-line-casing";
    const lineId   = "route-line";

    const geojson = routeLine && routeLine.length > 1
      ? {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: routeLine },
        }
      : null;

    if (!geojson) {
      if (map.getLayer(lineId))   map.removeLayer(lineId);
      if (map.getLayer(casingId)) map.removeLayer(casingId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }

    const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(geojson);
    } else {
      map.addSource(sourceId, { type: "geojson", data: geojson });
      map.addLayer({
        id: casingId,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: lineId,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#3b82f6", "line-width": 5 },
      });
    }
  }, [routeLine, ready]);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Carte indisponible : ajoutez VITE_MAPBOX_PUBLIC_TOKEN dans le fichier .env
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground p-4 text-center">
        <span className="font-medium text-destructive">Erreur Mapbox</span>
        <span>{mapError}</span>
        <span className="text-xs opacity-70">Vérifiez que le token commence par <code>pk.</code> et n'est pas restreint aux URLs dans le dashboard Mapbox.</span>
      </div>
    );
  }

  return (
    <div className={className ?? "h-full w-full"}>
      <style>{`@keyframes pingScale {0%{transform:scale(.8);opacity:.7}100%{transform:scale(2);opacity:0}}`}</style>
      <div ref={containerRef} className="h-full w-full rounded-2xl overflow-hidden" />
    </div>
  );
}
