import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bike, Check, MapPin, Package, Play, History, ClipboardList,
  LayoutDashboard, TrendingUp, Receipt, CheckCircle2, Wallet,
  User, LogOut, Crown, Loader2, ChevronRight,
  Navigation, ArrowLeft, ArrowRight, ArrowUp, CornerDownLeft, Flag,
  Maximize2, Minimize2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { MapView, type MapMarker, type VehicleType } from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatFCFA, STATUS_LABEL, STATUS_COLOR, type OrderStatus,
} from "@/lib/orders";
import { playNotificationSound } from "@/lib/sound";
import { Input } from "@/components/ui/input";

// Frais de livraison : montant fixe stocké sur chaque commande (delivery_fee)
// Calculé à la commande selon la distance routière restaurant→client (Mapbox Directions)

import { fetchRoute, formatDist, formatDuration, type RouteData, type RouteStep } from "@/lib/mapbox";

function StepIcon({ type, modifier }: { type: string; modifier?: string }) {
  if (type === "arrive")  return <Flag className="h-4 w-4 text-green-600" />;
  if (type === "depart")  return <Navigation className="h-4 w-4 text-primary" />;
  if (modifier === "left"  || modifier === "sharp left"  || modifier === "slight left")
    return <ArrowLeft className="h-4 w-4" />;
  if (modifier === "right" || modifier === "sharp right" || modifier === "slight right")
    return <ArrowRight className="h-4 w-4" />;
  if (modifier === "uturn") return <CornerDownLeft className="h-4 w-4" />;
  return <ArrowUp className="h-4 w-4" />;
}

type CourierSection = "dashboard" | "live" | "wallet" | "historique" | "profil";

export const Route = createFileRoute("/courier")({
  head: () => ({ meta: [{ title: "Espace Livreur — Royal House" }] }),
  component: CourierPage,
  ssr: false,
});

// ============ PAGE SHELL ============

function CourierPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [section, setSection] = useState<CourierSection>("dashboard");
  const [sessionReady, setSessionReady] = useState(false);
  const refreshAttempted = useRef(false);

  useEffect(() => {
    if (!user || refreshAttempted.current) return;
    refreshAttempted.current = true;
    supabase.auth.refreshSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        Object.keys(localStorage)
          .filter(k => k.startsWith("sb-") && k.includes("auth"))
          .forEach(k => localStorage.removeItem(k));
        navigate({ to: "/auth", replace: true });
        return;
      }
      setSessionReady(true);
    });
  }, [user, navigate]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  if (loading || !user) {
    return (
      <div className="h-screen grid place-items-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Crown className="h-6 w-6 text-primary animate-pulse" />
          Chargement…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <CourierSidebar section={section} setSection={setSection} onSignOut={handleSignOut} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <CourierHeader user={user} section={section} />
        <main className={`flex-1 ${section === "live" ? "overflow-hidden flex flex-col" : "overflow-y-auto"} pb-24 md:pb-0`}>
          {!sessionReady ? (
            <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Vérification de la session…</span>
            </div>
          ) : (
            <>
              {section === "dashboard"  && <SectionDashboard userId={user.id} onLive={() => setSection("live")} />}
              {section === "live"       && <SectionLive userId={user.id} />}
              {section === "wallet"     && <SectionWallet userId={user.id} />}
              {section === "historique" && <SectionHistorique userId={user.id} />}
              {section === "profil"     && <SectionProfil user={user} onSignOut={handleSignOut} />}
            </>
          )}
        </main>
        <CourierBottomNav section={section} setSection={setSection} />
      </div>
    </div>
  );
}

// ============ BOTTOM NAVBAR (mobile) ============

const BOTTOM_NAV_COURIER: { id: CourierSection; icon: typeof Bike; label: string }[] = [
  { id: "dashboard",   icon: LayoutDashboard, label: "Tableau" },
  { id: "live",        icon: ClipboardList,   label: "Courses" },
  { id: "wallet",      icon: Wallet,          label: "Wallet" },
  { id: "historique",  icon: History,         label: "Historique" },
  { id: "profil",      icon: User,            label: "Profil" },
];

function CourierBottomNav({ section, setSection }: {
  section: CourierSection;
  setSection: (s: CourierSection) => void;
}) {
  return (
    <nav className="
      md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50
      flex items-center gap-1
      bg-neutral-900/70 backdrop-blur-2xl
      border border-white/10
      rounded-4xl px-2 py-2
      shadow-[0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]
    ">
      {BOTTOM_NAV_COURIER.map(item => {
        const active = section === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={`flex flex-col items-center gap-0.5 px-4 py-3 rounded-3xl transition-all duration-200
              ${active
                ? "bg-white/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                : "text-white/50 hover:text-white/75"}`}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ============ SIDEBAR ============

const NAV_ITEMS: { id: CourierSection; icon: typeof Bike; label: string }[] = [
  { id: "dashboard",   icon: LayoutDashboard, label: "Tableau de bord" },
  { id: "live",        icon: ClipboardList,   label: "Courses en direct" },
  { id: "wallet",      icon: Wallet,          label: "Mon Wallet" },
  { id: "historique",  icon: History,         label: "Historique" },
  { id: "profil",      icon: User,            label: "Mon profil" },
];

function CourierSidebar({ section, setSection, onSignOut }: {
  section: CourierSection;
  setSection: (s: CourierSection) => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="w-16 hidden md:flex flex-col items-center py-4 border-r bg-card shrink-0">
      <div className="mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
          <Bike className="h-5 w-5 text-primary-foreground" />
        </div>
      </div>
      <nav className="flex flex-col items-center gap-1 flex-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            title={item.label}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all
              ${section === item.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <item.icon className="h-5 w-5" />
          </button>
        ))}
      </nav>
      <button
        onClick={onSignOut}
        title="Déconnexion"
        className="mt-2 w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </aside>
  );
}

// ============ HEADER ============

const SECTION_TITLES: Record<CourierSection, string> = {
  dashboard:  "Tableau de bord",
  live:       "Courses en direct",
  wallet:     "Mon Wallet",
  historique: "Historique",
  profil:     "Mon profil",
};

function CourierHeader({ user, section }: { user: { email?: string }; section: CourierSection }) {
  const name = user.email?.split("@")[0] ?? "Livreur";
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <header className="h-16 flex items-center gap-4 px-5 border-b bg-card shrink-0">
      <h1 className="text-lg font-bold">{SECTION_TITLES[section]}</h1>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          En ligne
        </span>
        <div className="flex items-center gap-2 pl-3 border-l">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight">{name}</p>
            <p className="text-xs text-muted-foreground leading-tight">Livreur</p>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============ SECTION DASHBOARD ============

function SectionDashboard({ userId, onLive }: { userId: string; onLive: () => void }) {
  const { data: delivered = [] } = useQuery({
    queryKey: ["courier-delivered", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, delivery_fee, created_at, dropoff_address")
        .eq("courier_id", userId)
        .eq("status", "delivered")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: activeCount = 0 } = useQuery({
    queryKey: ["courier-active-count", userId],
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("courier_id", userId)
        .not("status", "in", "(delivered,cancelled)");
      return count ?? 0;
    },
    refetchInterval: 15_000,
  });

  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayOrders = delivered.filter(o => new Date(o.created_at) >= todayStart);
    const fee = (o: typeof delivered[number]) => Number((o as any).delivery_fee ?? 0);
    const totalEarnings = delivered.reduce((s, o) => s + fee(o), 0);
    const todayEarnings = todayOrders.reduce((s, o) => s + fee(o), 0);
    return {
      totalDelivered: delivered.length,
      todayDelivered: todayOrders.length,
      totalEarnings,
      todayEarnings,
    };
  }, [delivered]);

  // Données 7 jours pour le graphique
  const weeklyData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
    const iso = d.toISOString().slice(0, 10);
    const dayOrders = delivered.filter(o => o.created_at.slice(0, 10) === iso);
    return {
      date: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      gains: Math.round(dayOrders.reduce((s, o) => s + Number((o as any).delivery_fee ?? 0), 0)),
      courses: dayOrders.length,
    };
  }), [delivered]);

  const hasChartData = weeklyData.some(d => d.gains > 0);
  const recent = delivered.slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Courses en cours" value={activeCount} icon={Bike} onClick={onLive} />
        <KpiCard label="Livrées aujourd'hui" value={stats.todayDelivered} icon={CheckCircle2} />
        <KpiCard label="Gains du jour" value={formatFCFA(stats.todayEarnings)} icon={Receipt} accent />
        <KpiCard label="Total livraisons" value={stats.totalDelivered} icon={TrendingUp} />
      </div>

      {/* Graphique + Wallet preview */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5">
          <h3 className="font-semibold mb-1">Gains — 7 derniers jours</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Frais fixes de livraison selon distance (500 – 2 500 FCFA)
          </p>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.9 0.01 60)" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <YAxis
                  tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                  tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={40}
                />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === "gains" ? [formatFCFA(v), "Gains"] : [v, "Courses"]}
                />
                <Bar dataKey="gains" fill="oklch(0.65 0.21 25)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
              Aucune livraison confirmée cette semaine
            </div>
          )}
        </div>

        {/* Wallet card */}
        <div className="rounded-2xl bg-primary text-primary-foreground p-5 flex flex-col justify-between shadow-md">
          <div>
            <div className="flex items-center gap-2 opacity-80 mb-3">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Mon Wallet</span>
            </div>
            <p className="text-3xl font-bold leading-tight">{formatFCFA(stats.totalEarnings)}</p>
            <p className="text-xs opacity-70 mt-1">Solde cumulé total</p>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20 text-xs space-y-1 opacity-80">
            <div className="flex justify-between">
              <span>{stats.totalDelivered} livraison{stats.totalDelivered > 1 ? "s" : ""}</span>
              <span>{formatFCFA(stats.totalEarnings)}</span>
            </div>
            <div className="flex justify-between">
              <span>Frais calculés à la distance</span>
              <span>500–2500 FCFA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activité récente */}
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-semibold mb-4">Activité récente</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune livraison terminée. Acceptez une course depuis{" "}
            <button onClick={onLive} className="text-primary underline underline-offset-2">Courses en direct</button>.
          </p>
        ) : (
          <div className="space-y-0">
            {recent.map(o => (
              <div key={o.id} className="flex items-center gap-3 py-3 border-b last:border-0">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">#{o.id.slice(0, 6).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />{o.dropoff_address}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-green-600">+{formatFCFA(Number((o as any).delivery_fee ?? 0))}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent, onClick }: {
  label: string; value: string | number; icon: typeof Bike; accent?: boolean; onClick?: () => void;
}) {
  const cls = `rounded-2xl border p-4 text-left w-full transition-all
    ${accent ? "bg-primary/5 border-primary/20" : "bg-card"}
    ${onClick ? "cursor-pointer hover:border-primary/40" : ""}`;
  return onClick ? (
    <button onClick={onClick} className={cls}>
      <KpiCardInner label={label} value={value} Icon={Icon} accent={accent} />
    </button>
  ) : (
    <div className={cls}>
      <KpiCardInner label={label} value={value} Icon={Icon} accent={accent} />
    </div>
  );
}

function KpiCardInner({ label, value, Icon, accent }: {
  label: string; value: string | number; Icon: typeof Bike; accent?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      </div>
      <div className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-xl
        ${accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

// ============ SECTION LIVE ============

function SectionLive({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const watchRef = useRef<number | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["courier-profile", userId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("vehicle, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
  });
  const vehicle = (profile?.vehicle as VehicleType | undefined) ?? 'moto';
  const mapboxProfile = vehicle === 'bike' ? 'cycling' : 'driving';

  const { data: orders = [] } = useQuery({
    queryKey: ["courier-live", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, restaurants(name, address)")
        .or(`courier_id.eq.${userId},and(courier_id.is.null,status.eq.ready)`)
        .not("status", "in", "(delivered,cancelled)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myLocations = [] } = useQuery({
    queryKey: ["courier-locs", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("courier_locations").select("*").eq("courier_id", userId);
      return data ?? [];
    },
    refetchInterval: 3000,
  });

  // Dérivés déclarés avant les useEffect qui les référencent (évite TDZ Rollup)
  const myOrders   = orders.filter(o => o.courier_id === userId);
  const available  = orders.filter(o => !o.courier_id);
  const locById    = useMemo(() => new Map(myLocations.map(l => [l.order_id, l])), [myLocations]);
  const selectedOrder = orders.find(o => o.id === selected);

  // ID stable de la commande en cours de livraison (évite TDZ dans le useEffect GPS)
  const deliveringOrderId = orders.find(o => o.status === "delivering" && o.courier_id === userId)?.id ?? null;

  // Realtime orders — son quand une nouvelle commande devient disponible
  const prevAvailableCount = useRef(0);
  useEffect(() => {
    const ch = supabase
      .channel(`courier-live-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["courier-live", userId] });
        queryClient.invalidateQueries({ queryKey: ["courier-active-count", userId] });
      })
      .subscribe();

    // Fallback poll si WebSocket down
    const poll = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["courier-live", userId] });
    }, 30_000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [userId, queryClient]);

  // Son si nouvelles commandes disponibles
  useEffect(() => {
    if (available.length > prevAvailableCount.current) {
      playNotificationSound();
      toast.info(`${available.length} commande${available.length > 1 ? "s" : ""} disponible${available.length > 1 ? "s" : ""}`);
    }
    prevAvailableCount.current = available.length;
  }, [available.length]);

  // GPS réel via watchPosition — active uniquement pendant une livraison en cours
  useEffect(() => {
    if (!deliveringOrderId) {
      if (watchRef.current !== null) {
        navigator.geolocation?.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return;
    }
    if (watchRef.current !== null) return; // déjà actif
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        await supabase.from("courier_locations").upsert({
          order_id: deliveringOrderId,
          courier_id: userId,
          lat,
          lng,
          updated_at: new Date().toISOString(),
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [deliveringOrderId, userId]);

  // Calcul de l'itinéraire Mapbox dès qu'une course est sélectionnée (et m'appartient)
  useEffect(() => {
    if (!selectedOrder || selectedOrder.courier_id !== userId) {
      setRoute(null);
      return;
    }
    const toLng = Number(selectedOrder.dropoff_lng);
    const toLat = Number(selectedOrder.dropoff_lat);
    if (!Number.isFinite(toLng) || !Number.isFinite(toLat)) { setRoute(null); return; }

    let fromLng: number, fromLat: number;
    if (selectedOrder.status === "picked_up") {
      // Livreur encore au restaurant
      fromLng = Number(selectedOrder.pickup_lng);
      fromLat = Number(selectedOrder.pickup_lat);
    } else {
      // En livraison → utiliser position GPS courante
      const loc = locById.get(selectedOrder.id);
      if (!loc) { setRoute(null); return; }
      fromLng = loc.lng;
      fromLat = loc.lat;
    }
    if (!Number.isFinite(fromLng) || !Number.isFinite(fromLat)) { setRoute(null); return; }

    setRouteLoading(true);
    fetchRoute(fromLng, fromLat, toLng, toLat, mapboxProfile).then(r => {
      setRoute(r);
      setRouteLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder?.id, selectedOrder?.status, mapboxProfile]);

  const markers: MapMarker[] = useMemo(() => {
    const m: MapMarker[] = [];
    orders.forEach(o => {
      // Afficher le point de livraison (destination) pour toutes les commandes disponibles
      if (Number.isFinite(Number(o.dropoff_lat)) && Number.isFinite(Number(o.dropoff_lng)))
        m.push({ id: `drop-${o.id}`, lat: Number(o.dropoff_lat), lng: Number(o.dropoff_lng), kind: "dropoff", label: o.dropoff_address });
    });
    // UN SEUL marqueur livreur basé sur la position GPS la plus récente
    const myLocs = myOrders
      .map(o => locById.get(o.id))
      .filter((loc): loc is NonNullable<typeof loc> => !!loc);
    if (myLocs.length > 0) {
      const latest = myLocs.reduce((a, b) =>
        (a.updated_at ?? "") >= (b.updated_at ?? "") ? a : b
      );
      m.push({ id: "me", lat: latest.lat, lng: latest.lng, kind: "courier", label: "Vous", pulse: true, vehicle });
    }
    return m;
  }, [orders, locById, myOrders, vehicle]);

  const acceptOrder = async (orderId: string, pickupLat: number, pickupLng: number) => {
    const { data: accepted, error } = await supabase.rpc("accept_order", {
      p_order_id: orderId,
      p_courier_id: userId,
    });
    if (error) return toast.error(error.message);
    if (!accepted) return toast.error("Cette commande a déjà été prise par un autre livreur.");
    await supabase.from("order_events").insert({
      order_id: orderId, status: "picked_up", created_by: userId,
      note: "Pris en charge par le livreur",
    });
    // Position initiale = restaurant
    await supabase.from("courier_locations")
      .upsert({ order_id: orderId, courier_id: userId, lat: pickupLat, lng: pickupLng });
    queryClient.invalidateQueries({ queryKey: ["courier-live", userId] });
    setSelected(orderId);
    playNotificationSound();
    toast.success("Course acceptée !");
  };

  const startDelivery = async (orderId: string) => {
    const { error } = await supabase
      .from("orders").update({ status: "delivering" as OrderStatus }).eq("id", orderId);
    if (error) return toast.error(error.message);
    await supabase.from("order_events").insert({
      order_id: orderId, status: "delivering", created_by: userId, note: "En route vers le client",
    });
    queryClient.invalidateQueries({ queryKey: ["courier-live", userId] });
    playNotificationSound();
    toast.success("Livraison démarrée !");
  };

  const finishDelivery = async (orderId: string) => {
    const { error } = await supabase
      .from("orders").update({ status: "delivered" as OrderStatus }).eq("id", orderId);
    if (error) return toast.error(error.message);
    await supabase.from("order_events").insert({
      order_id: orderId, status: "delivered", created_by: userId, note: "Livraison confirmée par le livreur",
    });
    queryClient.invalidateQueries({ queryKey: ["courier-live", userId] });
    queryClient.invalidateQueries({ queryKey: ["courier-delivered", userId] });
    setSelected(null);
    setRoute(null);
    playNotificationSound();
    toast.success("Livraison terminée !");
  };

  // Bloquer le scroll body en mode plein écran
  useEffect(() => {
    document.body.style.overflow = fullscreen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [fullscreen]);

  return (
    <div className="flex-1 h-full grid lg:grid-cols-[1fr_420px]">
      {/* Map container */}
      <div className={fullscreen
        ? "fixed inset-0 z-[100]"
        : "relative min-h-[320px] lg:min-h-0 p-4 pb-28 md:pb-4"
      }>
        <MapView
          markers={markers}
          fitToMarkers={!route && markers.length > 0}
          routeLine={route?.coords}
          onMarkerClick={(id) => setSelected(id.replace(/^(pickup|drop|me)-/, ""))}
          className={fullscreen ? "absolute inset-0" : "absolute inset-4"}
        />

        {/* Bouton plein écran (mobile uniquement) */}
        <button
          onClick={() => setFullscreen(f => !f)}
          className="lg:hidden absolute top-4 right-4 z-10 h-10 w-10 rounded-xl bg-background/85 backdrop-blur border shadow-md flex items-center justify-center hover:bg-background transition-colors"
          aria-label={fullscreen ? "Réduire" : "Plein écran"}
        >
          {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>

        {/* Overlay flottant en plein écran */}
        {fullscreen && (
          <div className="absolute bottom-6 left-3 right-3 z-10">
            {selectedOrder ? (
              <div className="bg-card/92 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{(selectedOrder as any).restaurants?.name ?? "Commande"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />{(selectedOrder as any).dropoff_address}
                    </p>
                  </div>
                  {route && (
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Navigation className="h-3 w-3" />{formatDuration(route.durationS)}
                    </span>
                  )}
                </div>
                {/* Bouton action principal */}
                {(selectedOrder as any).courier_id !== userId && (
                  <Button className="w-full" size="sm"
                    onClick={() => { acceptOrder((selectedOrder as any).id, (selectedOrder as any).pickup_lat, (selectedOrder as any).pickup_lng); setFullscreen(false); }}>
                    Accepter la course
                  </Button>
                )}
                {(selectedOrder as any).courier_id === userId && (selectedOrder as any).status === "picked_up" && (
                  <Button className="w-full" size="sm" onClick={() => startDelivery((selectedOrder as any).id)}>
                    Démarrer la livraison
                  </Button>
                )}
                {(selectedOrder as any).courier_id === userId && (selectedOrder as any).status === "delivering" && (
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" size="sm"
                    onClick={() => finishDelivery((selectedOrder as any).id)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Livraison terminée
                  </Button>
                )}
              </div>
            ) : (
              <div className="bg-card/92 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 shadow-2xl flex items-center justify-between">
                <span className="text-sm font-medium">
                  {available.length} course{available.length !== 1 ? "s" : ""} disponible{available.length !== 1 ? "s" : ""}
                  {myOrders.length > 0 && ` · ${myOrders.length} en cours`}
                </span>
                <button onClick={() => setFullscreen(false)} className="text-xs text-primary font-semibold">
                  Voir →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aside — masqué en plein écran */}
      <aside className={`border-l bg-card flex flex-col overflow-hidden ${fullscreen ? "hidden lg:flex" : ""}`}>
        <div className="p-4 border-b">
          <h2 className="font-bold flex items-center gap-2">
            <Bike className="h-4 w-4 text-primary" />Mes courses
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {myOrders.length} en cours · {available.length} disponible{available.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {selectedOrder ? (
            <OrderDetail
              order={selectedOrder}
              isMine={selectedOrder.courier_id === userId}
              route={route}
              routeLoading={routeLoading}
              onAccept={() => acceptOrder(selectedOrder.id, selectedOrder.pickup_lat, selectedOrder.pickup_lng)}
              onStart={() => startDelivery(selectedOrder.id)}
              onFinish={() => finishDelivery(selectedOrder.id)}
              onClose={() => { setSelected(null); setRoute(null); }}
            />
          ) : (
            <>
              {myOrders.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">En cours</p>
                  <div className="space-y-2">
                    {myOrders.map(o => <OrderRow key={o.id} order={o} onClick={() => setSelected(o.id)} />)}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">Disponibles</p>
                {available.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
                    Aucune course disponible.<br />En attente de commandes prêtes…
                  </div>
                ) : (
                  <div className="space-y-2">
                    {available.map(o => <OrderRow key={o.id} order={o} onClick={() => setSelected(o.id)} />)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function OrderRow({ order, onClick }: { order: any; onClick: () => void }) {
  const items = (order.items as any[] | null) ?? [];
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border bg-background p-3 hover:border-primary transition group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{order.restaurants?.name ?? "Restaurant"}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" />{order.dropoff_address}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge className={`border ${STATUS_COLOR[order.status as OrderStatus]} text-[10px]`}>
            {STATUS_LABEL[order.status as OrderStatus]}
          </Badge>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition" />
        </div>
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="text-muted-foreground">{items.reduce((s: number, i: any) => s + i.qty, 0)} articles</span>
        <span className="font-semibold">{formatFCFA(Number(order.total))}</span>
      </div>
    </button>
  );
}

function OrderDetail({ order, isMine, route, routeLoading, onAccept, onStart, onFinish, onClose }: {
  order: any; isMine: boolean;
  route: RouteData | null; routeLoading: boolean;
  onAccept: () => void; onStart: () => void; onFinish: () => void; onClose: () => void;
}) {
  const items = (order.items as any[] | null) ?? [];
  const fee = Number(order.delivery_fee ?? 0);

  return (
    <div className="rounded-xl border bg-background p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">← Retour</button>
        <Badge className={`border ${STATUS_COLOR[order.status as OrderStatus]} text-[10px]`}>
          {STATUS_LABEL[order.status as OrderStatus]}
        </Badge>
      </div>

      {/* Restaurant */}
      <div>
        <p className="font-bold">{order.restaurants?.name}</p>
        <p className="text-xs text-muted-foreground">{order.restaurants?.address}</p>
      </div>

      {/* Destination */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Livrer à</p>
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />{order.dropoff_address}
        </div>
      </div>

      {/* Résumé d'itinéraire Mapbox */}
      {isMine && (
        <div className="rounded-xl border bg-blue-50 border-blue-200 p-3">
          {routeLoading ? (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />Calcul de l'itinéraire…
            </div>
          ) : route ? (
            <div className="space-y-2">
              {/* Distance + durée */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-blue-700 font-semibold text-sm">
                  <Navigation className="h-4 w-4" />
                  {formatDist(route.distanceM)}
                </div>
                <span className="text-xs text-blue-600 font-medium">
                  ≈ {formatDuration(route.durationS)}
                </span>
              </div>
              {/* Instructions tour par tour (3 premières étapes) */}
              <div className="space-y-1.5 pt-1 border-t border-blue-200">
                {route.steps.slice(0, 4).map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-blue-800">
                    <div className="shrink-0 mt-0.5 text-blue-500">
                      <StepIcon type={step.maneuverType} modifier={step.modifier} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span>{step.instruction}</span>
                      {step.distanceM > 0 && (
                        <span className="ml-1 text-blue-500">({formatDist(step.distanceM)})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-blue-600">Itinéraire non disponible — vérifiez les coordonnées.</p>
          )}
        </div>
      )}

      {/* Articles */}
      {items.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Articles</p>
          <div className="space-y-1">
            {items.map((it: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{it.qty}× {it.name}</span>
                <span className="text-muted-foreground">{formatFCFA(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gain */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Frais de livraison (votre gain)</span>
        <span className="font-bold text-primary">{formatFCFA(fee)}</span>
      </div>

      {/* Actions */}
      {!isMine && (
        <Button className="w-full" onClick={onAccept}>
          <Package className="mr-2 h-4 w-4" />Récupérer la commande
        </Button>
      )}
      {isMine && order.status === "picked_up" && (
        <Button className="w-full" onClick={onStart}>
          <Play className="mr-2 h-4 w-4" />Démarrer la livraison
        </Button>
      )}
      {isMine && order.status === "delivering" && (
        <div className="space-y-2">
          <div className="rounded-xl bg-green-50 text-green-700 text-sm text-center p-3 font-medium border border-green-200">
            <Check className="h-4 w-4 inline mr-1" />En route — GPS actif, position envoyée automatiquement
          </div>
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={onFinish}>
            <Check className="mr-2 h-4 w-4" />Livraison terminée
          </Button>
        </div>
      )}
    </div>
  );
}

// ============ SECTION WALLET ============

function SectionWallet({ userId }: { userId: string }) {
  const { data: transactions = [] } = useQuery({
    queryKey: ["courier-wallet", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, delivery_fee, created_at, dropoff_address")
        .eq("courier_id", userId)
        .eq("status", "delivered")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const balance = useMemo(
    () => transactions.reduce((s, o) => s + Number((o as any).delivery_fee ?? 0), 0),
    [transactions],
  );

  // Répartition mensuelle pour le mini-chart
  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach(o => {
      const key = o.created_at.slice(0, 7); // YYYY-MM
      map.set(key, (map.get(key) ?? 0) + Number((o as any).delivery_fee ?? 0));
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, gains]) => ({
        month: new Date(month + "-01").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
        gains: Math.round(gains),
      }));
  }, [transactions]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Balance card */}
      <div className="rounded-3xl bg-primary text-primary-foreground p-8 shadow-lg space-y-4">
        <div className="flex items-center gap-2 opacity-80">
          <Wallet className="h-4 w-4" />
          <span className="text-sm font-medium">Solde disponible</span>
        </div>
        <p className="text-5xl font-bold tracking-tight">{formatFCFA(balance)}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs opacity-70">
            {transactions.length} livraison{transactions.length > 1 ? "s" : ""} confirmée{transactions.length > 1 ? "s" : ""}
            &nbsp;· frais fixes selon distance
          </span>
          <Button variant="secondary" size="sm" className="ml-auto" disabled>
            Retirer des fonds
          </Button>
        </div>
        <p className="text-xs opacity-50">
          Les retraits seront disponibles prochainement. Vos gains s'accumulent automatiquement à chaque livraison confirmée par le client.
        </p>
      </div>

      {/* Graphique mensuel */}
      {monthlyData.length > 1 && (
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold mb-1">Gains par mois</h3>
          <p className="text-xs text-muted-foreground mb-4">6 derniers mois</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.9 0.01 60)" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis
                tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={40}
              />
              <Tooltip formatter={(v: number) => [formatFCFA(v), "Gains"]} />
              <Bar dataKey="gains" fill="oklch(0.65 0.21 25)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Historique des transactions */}
      <div className="rounded-2xl border bg-card">
        <div className="p-5 border-b">
          <h3 className="font-semibold">Historique des gains</h3>
          <p className="text-xs text-muted-foreground">
            Chaque livraison confirmée par le client génère automatiquement vos frais de service.
          </p>
        </div>
        {transactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Aucune livraison confirmée pour l'instant.
          </div>
        ) : (
          <div className="divide-y">
            {transactions.map(o => (
              <div key={o.id} className="flex items-center gap-4 p-4">
                <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Course #{o.id.slice(0, 6).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />{o.dropoff_address}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-green-600">+{formatFCFA(Number((o as any).delivery_fee ?? 0))}</p>
                  <p className="text-xs text-muted-foreground">commande {formatFCFA(Number(o.total))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SECTION HISTORIQUE ============

function SectionHistorique({ userId }: { userId: string }) {
  const [filter, setFilter] = useState<"all" | "delivered" | "cancelled">("all");

  const { data: orders = [] } = useQuery({
    queryKey: ["courier-history", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, total, delivery_fee, created_at, dropoff_address, items, restaurants(name)")
        .eq("courier_id", userId)
        .in("status", ["delivered", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const totalEarned = orders
    .filter(o => o.status === "delivered")
    .reduce((s, o) => s + Number((o as any).delivery_fee ?? 0), 0);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Historique</h2>
          <p className="text-sm text-muted-foreground">
            {orders.length} courses · {formatFCFA(totalEarned)} gagnés au total
          </p>
        </div>
        <div className="flex gap-2">
          {(["all", "delivered", "cancelled"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition
                ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {f === "all" ? "Toutes" : f === "delivered" ? "Livrées" : "Annulées"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground border border-dashed rounded-xl p-10">
          Aucune course trouvée.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => {
            const items = (o.items as any[] | null) ?? [];
            return (
              <div key={o.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">#{o.id.slice(0, 6).toUpperCase()}</span>
                      <span className="text-xs text-muted-foreground">· {(o as any).restaurants?.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />{o.dropoff_address}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={`border ${STATUS_COLOR[o.status as OrderStatus]} text-[10px] block mb-1`}>
                      {STATUS_LABEL[o.status as OrderStatus]}
                    </Badge>
                    {o.status === "delivered" && (
                      <p className="text-xs font-semibold text-green-600">+{formatFCFA(Number((o as any).delivery_fee ?? 0))}</p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{items.reduce((s: number, i: any) => s + i.qty, 0)} articles</span>
                  <span className="font-medium text-foreground">{formatFCFA(Number(o.total))}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ SECTION PROFIL ============

function SectionProfil({ user, onSignOut }: { user: { email?: string; id: string }; onSignOut: () => void }) {
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["courier-profile", user.id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, vehicle")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  // Champs éditables
  const [fullName, setFullName] = useState("");
  const [phone,    setPhone]    = useState("");
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  // Synchronise les champs dès que le profil est chargé
  useEffect(() => {
    if (profile && !editing) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile, editing]);

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["courier-profile", user.id] });
    setEditing(false);
    playNotificationSound();
    toast.success("Profil mis à jour");
  };

  // Véhicule
  const [savingVehicle, setSavingVehicle] = useState(false);
  const currentVehicle = (profile?.vehicle as VehicleType | undefined) ?? "moto";

  const setVehicle = async (v: VehicleType) => {
    setSavingVehicle(true);
    const { error } = await supabase.from("profiles").update({ vehicle: v }).eq("id", user.id);
    setSavingVehicle(false);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["courier-profile", user.id] });
    toast.success("Moyen de transport mis à jour");
  };

  const VEHICLES: { id: VehicleType; emoji: string; label: string; sub: string }[] = [
    { id: "bike", emoji: "🚲", label: "Vélo",    sub: "Itinéraire cyclable" },
    { id: "moto", emoji: "🛵", label: "Moto",    sub: "Itinéraire routier"  },
    { id: "car",  emoji: "🚗", label: "Voiture", sub: "Itinéraire routier"  },
  ];

  const displayName = profile?.full_name || user.email?.split("@")[0] || "Livreur";
  const initials    = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">

      {/* Avatar */}
      <div className="rounded-2xl border bg-card p-6 flex flex-col items-center text-center gap-3">
        <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
          {initials}
        </div>
        <div>
          <p className="font-bold text-lg">{displayName}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <Badge className="mt-2 bg-primary/10 text-primary border-0 text-xs font-medium">Livreur</Badge>
        </div>
      </div>

      {/* Informations personnelles éditables */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Informations personnelles</h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-primary hover:underline"
            >
              Modifier
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nom complet</label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jean Dupont"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Téléphone</label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+237 6XX XXX XXX"
                type="tel"
                className="h-9"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditing(false); setFullName(profile?.full_name ?? ""); setPhone(profile?.phone ?? ""); }}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button size="sm" onClick={saveProfile} disabled={saving}>
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Enregistrement…</> : "Enregistrer"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm space-y-3">
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-muted-foreground">Nom</span>
              <span className="font-medium">{profile?.full_name || <span className="text-muted-foreground italic">Non renseigné</span>}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Téléphone</span>
              <span className="font-medium">{profile?.phone || <span className="text-muted-foreground italic">Non renseigné</span>}</span>
            </div>
          </div>
        )}
      </div>

      {/* Moyen de déplacement */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-sm">Moyen de déplacement</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Affecte l'icône sur la carte et le calcul d'ETA</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {VEHICLES.map(v => (
            <button
              key={v.id}
              disabled={savingVehicle}
              onClick={() => setVehicle(v.id)}
              className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 transition-all
                ${currentVehicle === v.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-background hover:border-primary/40"}`}
            >
              <span className="text-2xl">{v.emoji}</span>
              <span className="text-xs font-semibold">{v.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight text-center">{v.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Déconnexion */}
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Se déconnecter</p>
          <p className="text-xs text-muted-foreground">Votre session sera fermée.</p>
        </div>
        <Button variant="destructive" size="sm" onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-1.5" />Déconnexion
        </Button>
      </div>
    </div>
  );
}
