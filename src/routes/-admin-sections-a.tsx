import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  LayoutDashboard, ClipboardList, MapPin, Utensils, History, TrendingUp,
  Crown, LogOut, Clock, X, Check, Receipt, CheckCircle2,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarTrigger, SidebarGroup, SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA, STATUS_LABEL, STATUS_COLOR, ROYAL_HOUSE_ID } from "@/lib/orders";
import type { Database } from "@/integrations/supabase/types";

// ============ TYPES ============

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export type CartItem = { id: string; name: string; price: number; qty: number };

export type OrderWithProfile = OrderRow & {
  profiles?: { full_name: string | null; phone: string | null } | null;
};

export type WeeklyBucket = {
  date: string;
  isoDate: string;
  recettes: number;
  commandes: number;
};

export type Section = "dashboard" | "commandes" | "suivi" | "menu" | "historique" | "rapports";

// ============ HELPERS ============

export function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `Il y a ${diff}s`;
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  return `Il y a ${Math.floor(diff / 3600)}h`;
}

export function itemsSummary(items: CartItem[]): string {
  if (!items?.length) return "Aucun article";
  const first2 = items.slice(0, 2).map(i => `${i.name} ×${i.qty}`).join(", ");
  return items.length > 2 ? `${first2} +${items.length - 2} autre${items.length - 2 > 1 ? "s" : ""}` : first2;
}

export function buildTopItems(orders: OrderRow[]) {
  const map = new Map<string, { name: string; qty: number; revenue: number }>();
  orders.filter(o => o.status !== "cancelled").forEach(o => {
    const items = o.items as CartItem[] | null;
    items?.forEach(item => {
      const e = map.get(item.name) ?? { name: item.name, qty: 0, revenue: 0 };
      e.qty += item.qty;
      e.revenue += item.price * item.qty;
      map.set(item.name, e);
    });
  });
  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
}

export function buildWeeklyData(orders: Array<{ created_at: string; total: string | number | null; status: string }>): WeeklyBucket[] {
  const buckets: WeeklyBucket[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      isoDate: d.toISOString().slice(0, 10),
      recettes: 0,
      commandes: 0,
    };
  });
  orders.filter(o => o.status === "delivered").forEach(o => {
    const b = buckets.find(x => x.isoDate === o.created_at.slice(0, 10));
    if (b) { b.recettes += Number(o.total ?? 0); b.commandes += 1; }
  });
  return buckets;
}

// ============ ADMIN SHELL ============

const NAV_ITEMS: { section: Section; label: string; icon: React.ElementType; badge?: boolean }[] = [
  { section: "dashboard",  label: "Tableau de bord", icon: LayoutDashboard },
  { section: "commandes",  label: "Commandes",        icon: ClipboardList, badge: true },
  { section: "suivi",      label: "Suivi en direct",  icon: MapPin,        badge: true },
  { section: "menu",       label: "Menu",             icon: Utensils },
  { section: "historique", label: "Historique",       icon: History },
  { section: "rapports",   label: "Rapports",         icon: TrendingUp },
];

const SECTION_TITLES: Record<Section, string> = {
  dashboard:   "Tableau de bord",
  commandes:   "Commandes",
  suivi:       "Suivi en direct",
  menu:        "Menu",
  historique:  "Historique",
  rapports:    "Rapports",
};

export function AdminShell({
  user, activeSection, setSection, onLogout, activeCount, children,
}: {
  user: { email?: string };
  activeSection: Section;
  setSection: (s: Section) => void;
  onLogout: () => void;
  activeCount: number;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Crown className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm truncate">Royal House</span>
            <Badge variant="secondary" className="ml-auto text-[10px] shrink-0">Admin</Badge>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarMenu>
              {NAV_ITEMS.map(item => (
                <SidebarMenuItem key={item.section}>
                  <SidebarMenuButton
                    isActive={activeSection === item.section}
                    onClick={() => setSection(item.section)}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                    {item.badge && activeCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                        {activeCount > 9 ? "9+" : activeCount}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-2 p-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
              {user.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            <span className="flex-1 truncate text-xs text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onLogout}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 backdrop-blur px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="font-semibold text-sm">{SECTION_TITLES[activeSection]}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground hidden sm:block">En direct</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// ============ KPI CARD ============

function KpiCard({ label, value, icon: Icon, accent = false }: {
  label: string; value: string | number; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "bg-primary/5 border-primary/20" : "bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight truncate">{value}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ============ REVENUE BAR CHART PREVIEW ============

function RevenueBarChartPreview({ data }: { data: WeeklyBucket[] }) {
  const hasData = data.some(d => d.recettes > 0);
  if (!hasData) return (
    <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
      Aucune livraison sur les 7 derniers jours
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.9 0.01 60)" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
        <YAxis
          tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
          width={40}
        />
        <Tooltip formatter={(v: number) => [formatFCFA(v), "Recettes"]} />
        <Bar dataKey="recettes" fill="oklch(0.65 0.21 25)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============ SECTION DASHBOARD ============

export function SectionDashboard() {
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-all-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total, created_at, items")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const isToday = (s: string) => new Date(s) >= todayStart;
    const todays = orders.filter(o => isToday(o.created_at));
    const todaysDelivered = todays.filter(o => o.status === "delivered");
    const active = orders.filter(o => !["delivered", "cancelled"].includes(o.status));
    const revenueToday = todaysDelivered.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const taux = todays.length > 0 ? Math.round((todaysDelivered.length / todays.length) * 100) + "%" : "—";
    return { commandesToday: todays.length, activeOrders: active.length, revenueToday, taux };
  }, [orders]);

  const topItems = useMemo(() => buildTopItems(orders as any), [orders]);
  const weeklyBuckets = useMemo(() => buildWeeklyData(orders), [orders]);
  const recentActivity = orders.slice(0, 8);

  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Commandes aujourd'hui" value={stats.commandesToday} icon={Receipt} accent />
        <KpiCard label="En cours" value={stats.activeOrders} icon={Clock} />
        <KpiCard label="Recettes du jour" value={formatFCFA(stats.revenueToday)} icon={TrendingUp} accent />
        <KpiCard label="Taux de livraison" value={stats.taux} icon={CheckCircle2} />
      </div>

      {/* Chart + Top plats */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Revenue chart — col-span-2 */}
        <div className="md:col-span-2 rounded-2xl border bg-card p-5">
          <h3 className="font-semibold mb-1">Revenus 7 derniers jours</h3>
          <p className="text-xs text-muted-foreground mb-4">Commandes livrées uniquement</p>
          <RevenueBarChartPreview data={weeklyBuckets} />
        </div>

        {/* Top 5 plats */}
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold mb-4">Top plats</h3>
          {topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune commande encore</p>
          ) : (
            <div className="space-y-3">
              {topItems.map((item, i) => {
                const maxQty = topItems[0]?.qty ?? 1;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">#{i + 1} {item.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground ml-2">{item.qty} vendus</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.round((item.qty / maxQty) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activité récente */}
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-semibold mb-4">Activité récente</h3>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune activité récente</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map(o => (
              <div key={o.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <span className="text-xs text-muted-foreground w-10 shrink-0">
                  {new Date(o.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-xs font-mono text-muted-foreground">#{o.id.slice(0, 6).toUpperCase()}</span>
                <Badge className={`${STATUS_COLOR[o.status as keyof typeof STATUS_COLOR]} text-[10px]`}>
                  {STATUS_LABEL[o.status as keyof typeof STATUS_LABEL]}
                </Badge>
                <span className="ml-auto text-xs font-semibold">{formatFCFA(Number(o.total ?? 0))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SECTION COMMANDES ============

type FilterStatus = "all" | "pending" | "accepted" | "preparing" | "ready" | "picked_up" | "delivering";

const FILTER_LABELS: Record<FilterStatus, string> = {
  all:        "Toutes",
  pending:    "En attente",
  accepted:   "Acceptées",
  preparing:  "En préparation",
  ready:      "Prêtes",
  picked_up:  "Récupérées",
  delivering: "En livraison",
};

const NEXT_ACTION: Partial<Record<string, { label: string; next: string }>> = {
  pending:   { label: "Accepter",      next: "accepted"  },
  accepted:  { label: "Commencer",     next: "preparing" },
  preparing: { label: "Marquer prête", next: "ready"     },
};

function OrderCard({
  order,
  updateStatus,
  cancelOrder,
}: {
  order: OrderWithProfile;
  updateStatus: (id: string, status: string) => Promise<void>;
  cancelOrder: (id: string) => Promise<void>;
}) {
  const action = NEXT_ACTION[order.status];
  const items = order.items as CartItem[] | null;
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-semibold text-sm">#{order.id.slice(0, 6).toUpperCase()}</span>
          <span className="ml-2 text-xs text-muted-foreground">{relativeTime(order.created_at)}</span>
        </div>
        <Badge className={`${STATUS_COLOR[order.status as keyof typeof STATUS_COLOR]} text-[10px] shrink-0`}>
          {STATUS_LABEL[order.status as keyof typeof STATUS_LABEL]}
        </Badge>
      </div>

      {/* Client */}
      {order.profiles && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{order.profiles.full_name ?? "Client"}</span>
          {order.profiles.phone && <span className="ml-2">{order.profiles.phone}</span>}
        </div>
      )}

      {/* Articles */}
      <p className="text-xs text-muted-foreground truncate">
        {itemsSummary(items ?? [])}
      </p>

      {/* Adresse */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{order.dropoff_address}</span>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm">{formatFCFA(Number(order.total ?? 0))}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => cancelOrder(order.id)}
          >
            <X className="h-3 w-3 mr-1" />
            Annuler
          </Button>
          {action && (
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => updateStatus(order.id, action.next)}
            >
              <Check className="h-3 w-3 mr-1" />
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SectionCommandes({ updateStatus, cancelOrder }: {
  updateStatus: (id: string, status: string) => Promise<void>;
  cancelOrder: (id: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<FilterStatus>("all");

  const { data: activeOrders = [] } = useQuery({
    queryKey: ["admin-active-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .not("status", "in", '("delivered","cancelled")')
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OrderWithProfile[];
    },
    staleTime: 10_000,
  });

  const filteredOrders = filter === "all"
    ? activeOrders
    : activeOrders.filter(o => o.status === filter);

  return (
    <div className="p-6 space-y-5">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(FILTER_LABELS) as [FilterStatus, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
            {key === "all" && activeOrders.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px]">
                {activeOrders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders grid */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {filter === "all" ? "Aucune commande en cours" : `Aucune commande "${FILTER_LABELS[filter]}"`}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              updateStatus={updateStatus}
              cancelOrder={cancelOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
