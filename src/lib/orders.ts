import type { Database } from "@/integrations/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

export const ROYAL_HOUSE_ID = "a0a0a0a0-0000-0000-0000-000000000001";
export const APP_NAME = "Royal House";
export const CITY = "Yaoundé";
export const COUNTRY = "Cameroun";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  preparing: "En préparation",
  ready: "Prête",
  picked_up: "Récupérée",
  delivering: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "bg-warning/15 text-warning-foreground border-warning/40",
  accepted: "bg-accent text-accent-foreground border-border",
  preparing: "bg-accent text-accent-foreground border-border",
  ready: "bg-primary/15 text-primary border-primary/30",
  picked_up: "bg-primary/15 text-primary border-primary/30",
  delivering: "bg-primary text-primary-foreground border-primary",
  delivered: "bg-success/15 text-success-foreground border-success/40",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

export const STATUS_ORDER: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "picked_up",
  "delivering",
  "delivered",
];

export function statusProgress(s: OrderStatus): number {
  if (s === "cancelled") return 0;
  return Math.round(((STATUS_ORDER.indexOf(s) + 1) / STATUS_ORDER.length) * 100);
}

export type CartItem = { id: string; name: string; price: number; qty: number };

export function interpolate(
  from: [number, number],
  to: [number, number],
  t: number
): [number, number] {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

// Quartiers populaires de Yaoundé pour la simulation
export const YAOUNDE_NEIGHBORHOODS = [
  { name: "Bastos", lat: 3.8917, lng: 11.5167 },
  { name: "Bonamoussadi", lat: 3.8730, lng: 11.5340 },
  { name: "Mvog-Mbi", lat: 3.8540, lng: 11.5180 },
  { name: "Nlongkak", lat: 3.8810, lng: 11.5090 },
  { name: "Essos", lat: 3.8665, lng: 11.5360 },
  { name: "Mvan", lat: 3.8230, lng: 11.5145 },
  { name: "Biyem-Assi", lat: 3.8390, lng: 11.4870 },
  { name: "Mendong", lat: 3.8295, lng: 11.4730 },
  { name: "Emana", lat: 3.9170, lng: 11.5460 },
  { name: "Ngoa-Ekellé", lat: 3.8540, lng: 11.5005 },
];

export function randomYaoundeLocation(): { lat: number; lng: number; neighborhood: string } {
  const n = YAOUNDE_NEIGHBORHOODS[Math.floor(Math.random() * YAOUNDE_NEIGHBORHOODS.length)];
  return {
    lat: n.lat + (Math.random() - 0.5) * 0.008,
    lng: n.lng + (Math.random() - 0.5) * 0.008,
    neighborhood: n.name,
  };
}

export function formatFCFA(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " FCFA";
}

// Conservé pour rétro-compat (anciens appels) — délègue à FCFA
export const formatEuro = formatFCFA;
export const randomParisLocation = randomYaoundeLocation;
