import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChefHat, Check, Clock, MapPin, Plus, Trash2, Pencil, X, LayoutDashboard, History, Utensils, ClipboardList, TrendingUp, Receipt, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { AppShell } from "@/components/AppShell";
import { MapView, type MapMarker } from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ROYAL_HOUSE_ID,
  APP_NAME,
  STATUS_LABEL,
  STATUS_COLOR,
  formatFCFA,
  type OrderStatus,
} from "@/lib/orders";

export const Route = createFileRoute("/restaurant")({
  head: () => ({ meta: [{ title: `Espace Restaurant — ${APP_NAME}` }] }),
  component: RestaurantPage,
  ssr: false,
});

function RestaurantPage() {
  const { user, role, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || role !== "restaurant")) navigate({ to: "/auth", replace: true });
  }, [user, role, loading, navigate]);

  if (loading || !user || role !== "restaurant") {
    return <AppShell><div className="flex-1 grid place-items-center text-muted-foreground">Chargement…</div></AppShell>;
  }

  return (
    <AppShell>
      <Tabs defaultValue="orders" className="flex-1 flex flex-col">
        <div className="border-b px-4 bg-card">
          <TabsList className="my-2">
            <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-1.5" />Tableau de bord</TabsTrigger>
            <TabsTrigger value="orders"><ClipboardList className="h-4 w-4 mr-1.5" />Commandes en cours</TabsTrigger>
            <TabsTrigger value="history"><History className="h-4 w-4 mr-1.5" />Historique</TabsTrigger>
            <TabsTrigger value="menu"><Utensils className="h-4 w-4 mr-1.5" />Menu</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="dashboard" className="flex-1 m-0 overflow-y-auto">
          <Dashboard />
        </TabsContent>
        <TabsContent value="orders" className="flex-1 m-0">
          <OrdersDashboard userId={user.id} />
        </TabsContent>
        <TabsContent value="history" className="flex-1 m-0 overflow-y-auto">
          <RestaurantHistory />
        </TabsContent>
        <TabsContent value="menu" className="flex-1 m-0 overflow-y-auto">
          <MenuManager />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

// ============ DASHBOARD ============
function Dashboard() {
  const queryClient = useQueryClient();

  const { data: orders } = useQuery({
    queryKey: ["restaurant-all-orders", ROYAL_HOUSE_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("rest-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${ROYAL_HOUSE_ID}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["restaurant-all-orders", ROYAL_HOUSE_ID] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const stats = useMemo(() => {
    const all = orders ?? [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todays = all.filter((o) => new Date(o.created_at) >= today);
    const active = all.filter((o) => !["delivered", "cancelled"].includes(o.status));
    const delivered = all.filter((o) => o.status === "delivered");
    const revenueToday = todays.filter((o) => o.status === "delivered").reduce((s, o) => s + Number(o.total), 0);
    const totalRevenue = delivered.reduce((s, o) => s + Number(o.total), 0);
    return { all: all.length, todays: todays.length, active: active.length, delivered: delivered.length, revenueToday, totalRevenue };
  }, [orders]);

  const topItems = useMemo(() => {
    const counts = new Map<string, { name: string; qty: number; revenue: number }>();
    (orders ?? []).filter((o) => o.status !== "cancelled").forEach((o) => {
      ((o.items as any[] | null) ?? []).forEach((it: any) => {
        const prev = counts.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
        prev.qty += it.qty;
        prev.revenue += it.qty * it.price;
        counts.set(it.name, prev);
      });
    });
    return Array.from(counts.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [orders]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tableau de bord</h2>
        <p className="text-sm text-muted-foreground">Vue d'ensemble en temps réel de {APP_NAME}.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Commandes aujourd'hui" value={String(stats.todays)} icon={<Receipt className="h-4 w-4" />} accent />
        <Stat label="En cours" value={String(stats.active)} icon={<Clock className="h-4 w-4" />} />
        <Stat label="Recettes du jour" value={formatFCFA(stats.revenueToday)} icon={<TrendingUp className="h-4 w-4" />} accent />
        <Stat label="Total livrées" value={String(stats.delivered)} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold mb-3">🔥 Plats les plus commandés</h3>
          {topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pas encore de données.</p>
          ) : (
            <div className="space-y-2">
              {topItems.map((it, i) => (
                <div key={it.name} className="flex items-center gap-3">
                  <span className="text-xl font-bold w-6 text-muted-foreground">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-muted-foreground">{it.qty} vendus · {formatFCFA(it.revenue)}</div>
                  </div>
                  <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(it.qty / topItems[0].qty) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold mb-3">📊 Aperçu global</h3>
          <div className="space-y-2 text-sm">
            <Row label="Total commandes" value={String(stats.all)} />
            <Row label="Total livrées" value={String(stats.delivered)} />
            <Row label="Recettes totales (livrées)" value={formatFCFA(stats.totalRevenue)} />
            <Row label="Panier moyen" value={stats.delivered ? formatFCFA(stats.totalRevenue / stats.delivered) : "—"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "bg-primary/5 border-primary/30" : "bg-card"}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="font-bold text-2xl mt-1">{value}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}

// ============ ORDERS (live) ============
function OrdersDashboard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: restaurant } = useQuery({
    queryKey: ["royal-house", ROYAL_HOUSE_ID],
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("*").eq("id", ROYAL_HOUSE_ID).maybeSingle();
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["restaurant-orders", ROYAL_HOUSE_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, profiles!orders_client_id_fkey(full_name, phone)")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["restaurant-courier-locs", ROYAL_HOUSE_ID],
    enabled: !!orders?.length,
    queryFn: async () => {
      const ids = orders!.map((o) => o.id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("courier_locations").select("*").in("order_id", ids);
      return data ?? [];
    },
    refetchInterval: 4000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`rest-orders`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${ROYAL_HOUSE_ID}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["restaurant-orders", ROYAL_HOUSE_ID] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "courier_locations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["restaurant-courier-locs", ROYAL_HOUSE_ID] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const activeOrders = useMemo(
    () => (orders ?? []).filter((o) => !["delivered", "cancelled"].includes(o.status)),
    [orders],
  );
  const locById = useMemo(
    () => new Map((locations ?? []).map((l) => [l.order_id, l])),
    [locations],
  );

  const markers: MapMarker[] = useMemo(() => {
    if (!restaurant) return [];
    const m: MapMarker[] = [
      { id: "rest", lat: restaurant.lat, lng: restaurant.lng, kind: "restaurant", label: restaurant.name },
    ];
    activeOrders.forEach((o) => {
      m.push({ id: `drop-${o.id}`, lat: o.dropoff_lat, lng: o.dropoff_lng, kind: "dropoff", label: `Cmd. #${o.id.slice(0, 6)}` });
      const loc = locById.get(o.id);
      if (loc) m.push({ id: `cour-${o.id}`, lat: loc.lat, lng: loc.lng, kind: "courier", label: "Livreur", pulse: o.id === selected });
    });
    return m;
  }, [restaurant, activeOrders, locById, selected]);

  if (!restaurant) {
    return <div className="flex-1 grid place-items-center text-muted-foreground p-6">Restaurant introuvable.</div>;
  }

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) return toast.error(error.message);
    await supabase.from("order_events").insert({ order_id: orderId, status: newStatus, created_by: userId });
    toast.success(`Statut → ${STATUS_LABEL[newStatus]}`);
  };

  const selectedOrder = activeOrders.find((o) =>
    o.id === selected || `drop-${o.id}` === selected || `cour-${o.id}` === selected
  );

  return (
    <div className="flex-1 grid lg:grid-cols-[1fr_440px] gap-0">
      <div className="relative min-h-[400px] lg:min-h-0 p-4">
        <MapView
          markers={markers}
          fitToMarkers
          onMarkerClick={(id) => {
            const oid = id.startsWith("drop-") ? id.slice(5) : id.startsWith("cour-") ? id.slice(5) : id;
            setSelected(oid === "rest" ? null : oid);
          }}
          className="absolute inset-4"
        />
      </div>
      <aside className="border-l bg-card flex flex-col max-h-[calc(100vh-7rem)] overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><ChefHat className="h-5 w-5 text-primary" />{restaurant.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{activeOrders.length} commande{activeOrders.length > 1 ? "s" : ""} en cours</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {selectedOrder ? (
            <OrderDetail order={selectedOrder} onClose={() => setSelected(null)} onUpdate={updateStatus} />
          ) : activeOrders.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Aucune commande pour le moment.
            </div>
          ) : (
            activeOrders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelected(o.id)}
                className="w-full text-left rounded-xl border bg-background p-4 hover:border-primary transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">#{o.id.slice(0, 6)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(o.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <Badge className={`border ${STATUS_COLOR[o.status as OrderStatus]}`}>{STATUS_LABEL[o.status as OrderStatus]}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-2 truncate flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />{o.dropoff_address}
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span>{((o.items as any[] | null) ?? []).reduce((s: number, i: any) => s + i.qty, 0)} articles</span>
                  <span className="font-semibold">{formatFCFA(Number(o.total))}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function OrderDetail({
  order, onClose, onUpdate,
}: { order: any; onClose: () => void; onUpdate: (id: string, s: OrderStatus) => void }) {
  const next: Record<string, { label: string; status: OrderStatus } | null> = {
    pending: { label: "Accepter", status: "accepted" },
    accepted: { label: "Commencer la préparation", status: "preparing" },
    preparing: { label: "Marquer prête", status: "ready" },
    ready: null,
    picked_up: null,
    delivering: null,
  };
  const action = next[order.status];

  return (
    <div className="rounded-xl border bg-background p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">← Retour</button>
        <Badge className={`border ${STATUS_COLOR[order.status as OrderStatus]}`}>{STATUS_LABEL[order.status as OrderStatus]}</Badge>
      </div>
      <div>
        <div className="font-bold">Commande #{order.id.slice(0, 6)}</div>
        <div className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("fr-FR")}</div>
      </div>
      <div className="text-sm">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Client</div>
        <div className="font-medium">{order.profiles?.full_name || "Client"}</div>
        {order.profiles?.phone && <div className="text-xs text-muted-foreground">{order.profiles.phone}</div>}
      </div>
      <div className="text-sm">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Adresse</div>
        <div>{order.dropoff_address}</div>
      </div>
      <div className="text-sm">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Articles</div>
        <div className="space-y-1">
          {((order.items as any[] | null) ?? []).map((it: any, i: number) => (
            <div key={i} className="flex justify-between">
              <span>{it.qty}× {it.name}</span>
              <span className="text-muted-foreground">{formatFCFA(it.price * it.qty)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold pt-2 border-t mt-2">
            <span>Total</span>
            <span>{formatFCFA(Number(order.total))}</span>
          </div>
        </div>
      </div>
      {action && (
        <Button className="w-full" onClick={() => onUpdate(order.id, action.status)}>
          <Check className="mr-2 h-4 w-4" /> {action.label}
        </Button>
      )}
    </div>
  );
}

// ============ HISTORY ============
function RestaurantHistory() {
  const { data: orders } = useQuery({
    queryKey: ["restaurant-history", ROYAL_HOUSE_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, profiles!orders_client_id_fkey(full_name)")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .in("status", ["delivered", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-3">
      <h2 className="text-2xl font-bold">Historique des commandes</h2>
      <p className="text-sm text-muted-foreground">100 dernières commandes livrées ou annulées.</p>
      <div className="space-y-2">
        {(orders ?? []).length === 0 && (
          <div className="text-center text-sm text-muted-foreground border border-dashed rounded-xl p-8">
            Aucune commande clôturée.
          </div>
        )}
        {(orders ?? []).map((o) => (
          <div key={o.id} className="rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">#{o.id.slice(0, 6)} · {(o as any).profiles?.full_name || "Client"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(o.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </div>
              <Badge className={`border ${STATUS_COLOR[o.status as OrderStatus]}`}>{STATUS_LABEL[o.status as OrderStatus]}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />{o.dropoff_address}
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">{((o.items as any[] | null) ?? []).reduce((s: number, i: any) => s + i.qty, 0)} articles</span>
              <span className="font-semibold">{formatFCFA(Number(o.total))}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ MENU MANAGEMENT ============
function MenuManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["menu-admin", ROYAL_HOUSE_ID],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["menu-admin", ROYAL_HOUSE_ID] });

  const toggleAvail = async (item: any) => {
    const { error } = await (supabase as any).from("menu_items").update({ available: !item.available }).eq("id", item.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce plat ?")) return;
    const { error } = await (supabase as any).from("menu_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Plat supprimé");
    refresh();
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Menu du restaurant</h2>
          <p className="text-sm text-muted-foreground">Gérez les plats proposés à vos clients.</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau plat
        </Button>
      </div>

      {showForm && (
        <MenuItemForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); refresh(); }}
        />
      )}

      <div className="space-y-2">
        {(items ?? []).length === 0 && !showForm && (
          <div className="text-center text-sm text-muted-foreground border border-dashed rounded-xl p-8">
            Aucun plat. Cliquez sur « Nouveau plat » pour commencer.
          </div>
        )}
        {(items ?? []).map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-xl border bg-background p-4">
            <span className="text-2xl">{item.emoji ?? "🍽️"}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{item.name}</div>
              {item.description && <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>}
              <div className="text-xs mt-1 flex gap-2 items-center">
                <span className="font-semibold text-primary">{formatFCFA(Number(item.price))}</span>
                {item.category && <Badge variant="secondary" className="text-xs">{item.category}</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                <Switch checked={item.available} onCheckedChange={() => toggleAvail(item)} />
                <span className="text-muted-foreground">{item.available ? "Dispo" : "Indispo"}</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(item); setShowForm(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(item.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuItemForm({ initial, onClose, onSaved }: { initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [category, setCategory] = useState(initial?.category ?? "Plats signatures");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🍽️");
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        restaurant_id: ROYAL_HOUSE_ID,
        name,
        description: description || null,
        price: Number(price) || 0,
        category: category || null,
        emoji: emoji || null,
      };
      const { error } = initial
        ? await (supabase as any).from("menu_items").update(payload).eq("id", initial.id)
        : await (supabase as any).from("menu_items").insert(payload);
      if (error) throw error;
      toast.success(initial ? "Plat mis à jour" : "Plat ajouté");
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{initial ? "Modifier le plat" : "Nouveau plat"}</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-[80px_1fr] gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Emoji</Label>
          <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} className="text-center text-xl" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nom</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Prix (FCFA)</Label>
          <Input type="number" step="100" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Catégorie</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Plats signatures, Boissons…" />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        <Button type="submit" disabled={busy}>{busy ? "…" : "Enregistrer"}</Button>
      </div>
    </form>
  );
}
