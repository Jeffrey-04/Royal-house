import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock, CheckCircle2, Bike, ChefHat, Package,
  MapPin, Receipt, X, ShoppingBag, Navigation,
  ChevronLeft, ChevronRight, PartyPopper, Loader2,
  Maximize2, Minimize2, WifiOff,
} from "lucide-react";
import { fetchRoute, formatDist, formatDuration, type RouteData } from "@/lib/mapbox";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MapView } from "@/components/MapView";
import type { MapMarker } from "@/components/MapView";
import {
  STATUS_LABEL, STATUS_COLOR, statusProgress, formatFCFA,
  ROYAL_HOUSE_ID, type CartItem, type OrderStatus,
} from "@/lib/orders";

// ——————————————————————————————————————————————
// Types
// ——————————————————————————————————————————————
type OrderRow = {
  id: string; status: OrderStatus; total: string | number | null;
  items: CartItem[] | null; dropoff_address: string | null;
  dropoff_lat: number | null; dropoff_lng: number | null;
  courier_id: string | null; created_at: string;
  payment_status: string | null;
};

// ——————————————————————————————————————————————
// Helpers
// ——————————————————————————————————————————————
function itemsSummary(items: CartItem[] | null): string {
  if (!items?.length) return "Commande";
  const s = items.slice(0, 2).map(i => `${i.name} ×${i.qty}`).join(", ");
  return items.length > 2 ? `${s} +${items.length - 2}` : s;
}

function getStatusIcon(status: OrderStatus) {
  switch (status) {
    case "pending":    return <Clock className="h-3.5 w-3.5" />;
    case "accepted":   return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "preparing":  return <ChefHat className="h-3.5 w-3.5" />;
    case "ready":      return <Package className="h-3.5 w-3.5" />;
    case "picked_up":
    case "delivering": return <Bike className="h-3.5 w-3.5" />;
    case "delivered":  return <CheckCircle2 className="h-3.5 w-3.5" />;
    default:           return <Clock className="h-3.5 w-3.5" />;
  }
}

// ——————————————————————————————————————————————
// SectionCommandes
// ——————————————————————————————————————————————
export function SectionCommandes({ userId, onSuivi }: { userId: string; onSuivi: () => void }) {
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["client-orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total, items, dropoff_address, dropoff_lat, dropoff_lng, courier_id, created_at, payment_status")
        .eq("client_id", userId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`client-orders-rt-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `client_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["client-orders", userId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, queryClient]);

  // "delivered" sans confirmation client reste dans les actives jusqu'à payment_status = "released"
  const active  = orders.filter(o => o.status !== "cancelled" && !(o.status === "delivered" && o.payment_status === "released"));
  const history = orders.filter(o => o.status === "cancelled" || (o.status === "delivered" && o.payment_status === "released"));

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card animate-pulse h-28" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <ShoppingBag className="h-16 w-16 opacity-20" />
        <p className="text-lg font-medium">Aucune commande</p>
        <p className="text-sm">Passez votre première commande depuis l'onglet Commander.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />En cours ({active.length})
          </h2>
          {active.map(o => <ActiveOrderCard key={o.id} order={o} userId={userId} onSuivi={onSuivi} />)}
        </section>
      )}
      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" />Historique
          </h2>
          {history.map(o => <HistoryOrderCard key={o.id} order={o} />)}
        </section>
      )}
    </div>
  );
}

function ActiveOrderCard({ order, userId, onSuivi }: { order: OrderRow; userId: string; onSuivi: () => void }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const progress = statusProgress(order.status);
  const needsConfirmation = order.status === "delivered" && order.payment_status !== "released";

  async function handleConfirm() {
    setConfirming(true);
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "released" } as never)
      .eq("id", order.id)
      .eq("client_id", userId);
    setConfirming(false);
    if (error) { toast.error("Erreur lors de la confirmation."); return; }
    toast.success("Commande confirmée ! Paiement libéré. Bon appétit 🎉");
    queryClient.invalidateQueries({ queryKey: ["client-orders", userId] });
    queryClient.invalidateQueries({ queryKey: ["client-active-orders", userId] });
  }

  return (
    <div className={`rounded-2xl border bg-card p-4 space-y-3 ${needsConfirmation ? "border-green-300 ring-1 ring-green-200" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{itemsSummary(order.items)}</p>
          {order.dropoff_address && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />{order.dropoff_address}
            </p>
          )}
        </div>
        <Badge className={`${STATUS_COLOR[order.status]} flex items-center gap-1 shrink-0`}>
          {getStatusIcon(order.status)}
          {STATUS_LABEL[order.status]}
        </Badge>
      </div>
      <div className="space-y-1">
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress}% complété</span>
          {!needsConfirmation && (
            <button onClick={onSuivi} className="text-primary hover:underline">Voir sur la carte →</button>
          )}
        </div>
      </div>
      {needsConfirmation && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <PartyPopper className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-green-800">Votre commande a été livrée !</p>
          </div>
          <p className="text-xs text-green-700">Confirmez la réception pour libérer le paiement.</p>
          <Button
            size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white"
            disabled={confirming} onClick={handleConfirm}
          >
            {confirming
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Confirmation…</>
              : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />J'ai reçu ma commande</>}
          </Button>
        </div>
      )}
      <div className="flex justify-between items-center pt-1 border-t text-sm">
        <span className="text-muted-foreground">
          {new Date(order.created_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
        </span>
        <span className="font-bold text-primary">{formatFCFA(Number(order.total))}</span>
      </div>
    </div>
  );
}

function HistoryOrderCard({ order }: { order: OrderRow }) {
  const delivered = order.status === "delivered";
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3">
      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0
        ${delivered ? "bg-success/15 text-success-foreground" : "bg-destructive/10 text-destructive"}`}>
        {delivered ? <CheckCircle2 className="h-5 w-5" /> : <X className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{itemsSummary(order.items)}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold text-sm">{formatFCFA(Number(order.total))}</p>
        <Badge variant="outline" className={`text-xs mt-0.5 ${STATUS_COLOR[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </Badge>
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————
// SectionSuivi
// ——————————————————————————————————————————————
export function SectionSuivi({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [confirmingReceived, setConfirmingReceived] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const lastCourierLoc = useRef<{ lat: number; lng: number } | null>(null);

  async function markReceived(orderId: string) {
    setConfirmingReceived(true);
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "released" } as never)
      .eq("id", orderId)
      .eq("client_id", userId);
    setConfirmingReceived(false);
    if (error) { toast.error("Erreur lors de la confirmation."); return; }
    toast.success("Commande confirmée ! Paiement libéré. Bon appétit 🎉");
    queryClient.invalidateQueries({ queryKey: ["client-active-orders", userId] });
    queryClient.invalidateQueries({ queryKey: ["client-orders", userId] });
    queryClient.invalidateQueries({ queryKey: ["client-payments", userId] });
  }

  const { data: activeOrders = [] } = useQuery({
    queryKey: ["client-active-orders", userId],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, total, items, dropoff_address, dropoff_lat, dropoff_lng, courier_id, created_at, payment_status")
        .eq("client_id", userId)
        .not("status", "eq", "cancelled")
        // inclure "delivered" tant que le client n'a pas confirmé
        // NULL != 'released' vaut NULL en SQL, pas TRUE — on inclut aussi les payment_status IS NULL
        .or("status.neq.delivered,payment_status.is.null,payment_status.neq.released")
        .order("created_at", { ascending: false });
      return (data ?? []) as OrderRow[];
    },
  });

  // Sélectionner automatiquement la première commande active
  useEffect(() => {
    if (activeOrders.length === 0) { setSelectedId(null); return; }
    setSelectedId(prev => {
      if (prev && activeOrders.some(o => o.id === prev)) return prev;
      return activeOrders[0].id;
    });
  }, [activeOrders]);

  const activeOrder = activeOrders.find(o => o.id === selectedId) ?? activeOrders[0] ?? null;

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant-loc"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("name, lat, lng")
        .eq("id", ROYAL_HOUSE_ID)
        .maybeSingle();
      return data;
    },
  });

  const { data: courierLoc } = useQuery({
    queryKey: ["courier-loc-client", activeOrder?.courier_id],
    enabled: !!activeOrder?.courier_id,
    refetchInterval: 3_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("courier_locations")
        .select("lat, lng")
        .eq("courier_id", activeOrder!.courier_id!)
        .maybeSingle();
      return data;
    },
  });

  // Mémoriser la dernière position connue du livreur (résistance aux coupures réseau)
  useEffect(() => {
    if (courierLoc) lastCourierLoc.current = courierLoc;
  }, [courierLoc]);

  // Bloquer le scroll body en mode plein écran
  useEffect(() => {
    document.body.style.overflow = fullscreen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [fullscreen]);

  useEffect(() => {
    const ch = supabase
      .channel(`client-active-rt-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `client_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["client-active-orders", userId] })
      )
      .subscribe();

    // Fallback poll si WebSocket down
    const poll = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["client-active-orders", userId] });
    }, 30_000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [userId, queryClient]);

  // Calcul itinéraire : depuis la position du livreur (ou dernière connue) → client
  useEffect(() => {
    const toLng = activeOrder?.dropoff_lng;
    const toLat = activeOrder?.dropoff_lat;
    if (!toLng || !toLat || !Number.isFinite(Number(toLng)) || !Number.isFinite(Number(toLat))) {
      setRoute(null); return;
    }
    const status = activeOrder?.status;
    if (!status || ["pending", "accepted", "preparing", "delivered", "cancelled"].includes(status)) {
      setRoute(null); return;
    }
    // Utilise la position live ou la dernière position connue (résistance aux coupures)
    const loc = courierLoc ?? lastCourierLoc.current;
    let fromLng: number, fromLat: number;
    if (loc?.lng && loc?.lat) {
      fromLng = loc.lng; fromLat = loc.lat;
    } else if (restaurant?.lng && restaurant?.lat) {
      fromLng = restaurant.lng; fromLat = restaurant.lat;
    } else {
      return;
    }
    fetchRoute(fromLng, fromLat, Number(toLng), Number(toLat)).then(setRoute);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.id, activeOrder?.status, courierLoc, restaurant]);

  const markers = useMemo<MapMarker[]>(() => {
    const result: MapMarker[] = [];
    const isDelivering = activeOrder?.status === "delivering" || activeOrder?.status === "delivered";
    if (!isDelivering && restaurant?.lat && restaurant?.lng)
      result.push({ id: "restaurant", kind: "restaurant", lat: restaurant.lat, lng: restaurant.lng });
    if (activeOrder?.dropoff_lat && activeOrder?.dropoff_lng)
      result.push({ id: "dropoff", kind: "dropoff", lat: activeOrder.dropoff_lat, lng: activeOrder.dropoff_lng });
    // Utilise la position live OU la dernière position connue (coupure réseau)
    const loc = courierLoc ?? lastCourierLoc.current;
    if (loc?.lat && loc?.lng)
      result.push({ id: "courier", kind: "courier", lat: loc.lat, lng: loc.lng, pulse: !!courierLoc });
    return result;
  }, [restaurant, activeOrder, courierLoc]);

  if (!activeOrder) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <MapPin className="h-16 w-16 opacity-20" />
        <p className="text-lg font-medium">Aucune livraison en cours</p>
        <p className="text-sm">Passez une commande pour suivre votre livreur en temps réel.</p>
      </div>
    );
  }

  const currentIdx = activeOrders.findIndex(o => o.id === activeOrder.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < activeOrders.length - 1;
  const progress = statusProgress(activeOrder.status);

  const isOffline = !courierLoc && !!lastCourierLoc.current && !!activeOrder.courier_id;

  return (
    <div className="flex flex-col lg:flex-row overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>
      {/* Map */}
      <div className={fullscreen
        ? "fixed inset-0 z-[100]"
        : "flex-1 min-h-64 lg:min-h-0 relative"
      }>
        <MapView
          markers={markers}
          fitToMarkers={!route}
          routeLine={route?.coords}
          className="absolute inset-0"
          rounded={!fullscreen}
        />

        {/* Bouton plein écran (mobile uniquement) */}
        <button
          onClick={() => setFullscreen(f => !f)}
          className="lg:hidden absolute top-4 right-4 z-10 h-10 w-10 rounded-xl bg-background/85 backdrop-blur border shadow-md flex items-center justify-center hover:bg-background transition-colors"
          aria-label={fullscreen ? "Réduire" : "Plein écran"}
        >
          {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>

        {!activeOrder.courier_id && !fullscreen && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card border rounded-xl px-4 py-2 text-sm font-medium shadow-md">
            En attente d'un livreur…
          </div>
        )}

        {/* Overlay flottant en plein écran */}
        {fullscreen && (
          <div className="absolute bottom-6 left-3 right-3 z-10 space-y-2">
            {/* Indicateur hors-ligne */}
            {isOffline && (
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-lg">
                  <WifiOff className="h-3 w-3" /> Dernière position connue
                </span>
              </div>
            )}
            {!activeOrder.courier_id && (
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 bg-card border text-xs px-3 py-1.5 rounded-full font-medium shadow-md">
                  En attente d'un livreur…
                </span>
              </div>
            )}

            {/* Card statut + action */}
            <div className="bg-card/92 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Badge className={`${STATUS_COLOR[activeOrder.status]} gap-1.5 text-xs`}>
                  {getStatusIcon(activeOrder.status)}
                  {STATUS_LABEL[activeOrder.status]}
                </Badge>
                {route && (
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 shrink-0">
                    <Navigation className="h-3 w-3" />
                    {formatDuration(route.durationS)} · {formatDist(route.distanceM)}
                  </span>
                )}
              </div>

              {(activeOrder.status === "delivering" ||
                (activeOrder.status === "delivered" && activeOrder.payment_status !== "released")) && (
                <Button
                  size="sm"
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={confirmingReceived}
                  onClick={() => markReceived(activeOrder.id)}
                >
                  {confirmingReceived
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Confirmation…</>
                    : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />J'ai reçu ma commande</>}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status panel — masqué en plein écran */}
      <div className={`w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l bg-card overflow-y-auto p-5 space-y-5 shrink-0 ${fullscreen ? "hidden" : ""}`}>

        {/* Sélecteur de commandes — visible si plusieurs commandes actives */}
        {activeOrders.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              disabled={!hasPrev}
              onClick={() => setSelectedId(activeOrders[currentIdx - 1].id)}
              className="rounded-lg border p-1.5 hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-xs font-semibold">Commande {currentIdx + 1} / {activeOrders.length}</p>
              <p className="text-[10px] text-muted-foreground font-mono">#{activeOrder.id.slice(0, 6).toUpperCase()}</p>
            </div>
            <button
              disabled={!hasNext}
              onClick={() => setSelectedId(activeOrders[currentIdx + 1].id)}
              className="rounded-lg border p-1.5 hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <div>
          <h2 className="font-bold text-lg">Suivi en direct</h2>
          <p className="text-sm text-muted-foreground">Commande passée {new Date(activeOrder.created_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
        </div>

        {/* Status badge */}
        <Badge className={`${STATUS_COLOR[activeOrder.status]} gap-1.5 text-sm px-3 py-1.5`}>
          {getStatusIcon(activeOrder.status)}
          {STATUS_LABEL[activeOrder.status]}
        </Badge>

        {/* ETA & itinéraire — visible uniquement quand le livreur est en route */}
        {route && ["ready", "picked_up", "delivering"].includes(activeOrder.status) && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700">
              <Navigation className="h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-bold">{formatDist(route.distanceM)}</p>
                <p className="text-xs text-blue-600">Arrivée estimée dans {formatDuration(route.durationS)}</p>
              </div>
            </div>
            {route.steps.length > 0 && (
              <div className="pt-2 border-t border-blue-200 text-xs text-blue-700 space-y-1">
                <p className="font-medium">Prochain arrêt</p>
                <p className="text-blue-600">{route.steps[0]?.instruction}</p>
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="space-y-2">
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary rounded-full h-3 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{progress}% du trajet complété</p>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {(["pending","accepted","preparing","ready","picked_up","delivering","delivered"] as OrderStatus[]).map((s, i) => {
            const statusIdx = ["pending","accepted","preparing","ready","picked_up","delivering","delivered"].indexOf(activeOrder.status);
            const done = i <= statusIdx;
            return (
              <div key={s} className={`flex items-center gap-3 text-sm ${done ? "text-foreground" : "text-muted-foreground/50"}`}>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors
                  ${done ? "border-primary bg-primary text-primary-foreground" : "border-muted"}`}>
                  {done && <CheckCircle2 className="h-3.5 w-3.5" />}
                </div>
                <span>{STATUS_LABEL[s]}</span>
              </div>
            );
          })}
        </div>

        {/* Bouton "Marquer reçu" — visible uniquement en livraison active ou après confirmation livreur */}
        {(activeOrder.status === "delivering" ||
          (activeOrder.status === "delivered" && activeOrder.payment_status !== "released")) && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <PartyPopper className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">
                {activeOrder.status === "delivered" ? "Votre commande a été livrée !" : "Votre commande arrive !"}
              </p>
                <p className="text-xs text-green-700 mt-0.5">
                  Confirmez la réception pour libérer le paiement au restaurant et au livreur.
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="sm"
              disabled={confirmingReceived}
              onClick={() => markReceived(activeOrder.id)}
            >
              {confirmingReceived
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Confirmation…</>
                : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />J'ai reçu ma commande</>}
            </Button>
          </div>
        )}

        {/* Order summary */}
        <div className="rounded-xl border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Récapitulatif</p>
          <p className="text-sm font-medium">{itemsSummary(activeOrder.items)}</p>
          {activeOrder.dropoff_address && (
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
              {activeOrder.dropoff_address}
            </p>
          )}
          <p className="text-sm font-bold text-primary">{formatFCFA(Number(activeOrder.total))}</p>
        </div>
      </div>
    </div>
  );
}
