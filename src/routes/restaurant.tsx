import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChefHat, Check, Clock, MapPin, Plus, Trash2, Pencil, X, LayoutDashboard, History, Utensils, ClipboardList, TrendingUp, Receipt, CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
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

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
  components: Array<{ name: string; price: number }> | null;
  available: boolean;
};

function MenuManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: items = [] } = useQuery<MenuItem[]>({
    queryKey: ["menu-admin", ROYAL_HOUSE_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items" as any)
        .select("id, name, description, price, category, image_url, components, available")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as MenuItem[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["menu-admin", ROYAL_HOUSE_ID] });

  const toggleAvail = async (item: MenuItem) => {
    const { error } = await supabase
      .from("menu_items" as any)
      .update({ available: !item.available })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce plat ?")) return;
    const { error } = await supabase.from("menu_items" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Plat supprimé");
    refresh();
  };

  const openNew  = () => { setEditing(null);  setShowForm(true); };
  const openEdit = (item: MenuItem) => { setEditing(item); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Menu du restaurant</h2>
          <p className="text-sm text-muted-foreground">Gérez les plats proposés à vos clients.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />Nouveau plat
        </Button>
      </div>

      {/* Formulaire de création / édition */}
      {showForm && (
        <MenuItemForm
          key={editing?.id ?? "new"}
          initial={editing}
          onClose={closeForm}
          onSaved={() => { closeForm(); refresh(); }}
        />
      )}

      {/* Liste des plats */}
      {items.length === 0 && !showForm ? (
        <div className="text-center text-sm text-muted-foreground border border-dashed rounded-xl p-10">
          Aucun plat pour l'instant. Cliquez sur « Nouveau plat » pour commencer.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border bg-background p-3"
            >
              {/* Miniature */}
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-16 h-12 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-16 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 text-2xl">
                  🍽️
                </div>
              )}

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-primary">{formatFCFA(Number(item.price))}</span>
                  {item.category && (
                    <Badge variant="secondary" className="text-xs py-0">{item.category}</Badge>
                  )}
                  {Array.isArray(item.components) && item.components.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      · {item.components.length} supplément{item.components.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={item.available}
                    onCheckedChange={() => toggleAvail(item)}
                  />
                  <span className="text-xs text-muted-foreground w-12">
                    {item.available ? "Dispo" : "Indispo"}
                  </span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(item.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ FORMULAIRE PLAT ============

type MenuSupp = { name: string; price: number };

function MenuItemForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: MenuItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [name,        setName]        = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price,       setPrice]       = useState(String(initial?.price ?? ""));
  const [category,    setCategory]    = useState(initial?.category ?? "Plats signatures");
  const [imageUrl,    setImageUrl]    = useState(initial?.image_url ?? "");
  const [uploading,   setUploading]   = useState(false);
  const [supps,       setSupps]       = useState<MenuSupp[]>(
    Array.isArray(initial?.components) ? (initial.components as MenuSupp[]) : []
  );
  const [busy, setBusy] = useState(false);

  /* ── Upload photo ── */
  const pickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext  = file.name.split(".").pop() ?? "jpg";
      const path = `${ROYAL_HOUSE_ID}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("menu-images")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (err: any) {
      toast.error("Échec de l'upload : " + (err.message ?? "erreur inconnue"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  /* ── Suppléments ── */
  const addSupp    = () => setSupps(s => [...s, { name: "", price: 0 }]);
  const updateSupp = (i: number, field: keyof MenuSupp, val: string | number) =>
    setSupps(s => s.map((x, j) => j === i ? { ...x, [field]: val } : x));
  const removeSupp = (i: number) =>
    setSupps(s => s.filter((_, j) => j !== i));

  /* ── Sauvegarde ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Le nom du plat est obligatoire."); return; }
    if (!price || Number(price) <= 0) { toast.error("Le prix doit être supérieur à 0."); return; }

    setBusy(true);
    try {
      const payload = {
        restaurant_id: ROYAL_HOUSE_ID,
        name:          name.trim(),
        description:   description.trim() || null,
        price:         Number(price),
        category:      category.trim() || null,
        image_url:     imageUrl || null,
        components:    supps.filter(s => s.name.trim()),
      };

      const { error } = initial
        ? await supabase.from("menu_items" as any).update(payload).eq("id", initial.id)
        : await supabase.from("menu_items" as any).insert(payload);

      if (error) throw error;
      toast.success(initial ? "Plat mis à jour ✓" : "Plat ajouté ✓");
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Une erreur est survenue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border bg-card shadow-sm overflow-hidden"
    >
      {/* Barre de titre */}
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h3 className="font-semibold text-base">
          {initial ? "Modifier le plat" : "Nouveau plat"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Zone photo ── */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Photo du plat</label>
          <div
            onClick={pickFile}
            className={`relative w-full rounded-xl border-2 border-dashed transition-colors cursor-pointer overflow-hidden
              ${uploading ? "border-primary/40 bg-primary/5" : "border-muted-foreground/20 bg-muted/30 hover:bg-muted/60 hover:border-primary/40"}`}
            style={{ height: 180 }}
          >
            {imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt="Aperçu"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <ImagePlus className="h-6 w-6 text-white" />
                  <span className="text-white text-sm font-medium">Changer la photo</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 select-none">
                {uploading
                  ? <Loader2 className="h-9 w-9 text-primary animate-spin" />
                  : <ImagePlus className="h-9 w-9 text-muted-foreground/60" />
                }
                <p className="text-sm text-muted-foreground">
                  {uploading ? "Upload en cours…" : "Cliquez pour ajouter une photo"}
                </p>
                <p className="text-xs text-muted-foreground/60">JPG · PNG · WebP — max 5 Mo</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
            disabled={uploading}
          />
          {imageUrl && (
            <button
              type="button"
              onClick={() => setImageUrl("")}
              className="text-xs text-destructive hover:underline"
            >
              Supprimer la photo
            </button>
          )}
        </div>

        {/* ── Nom ── */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nom du plat *</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex : Ndolé Royal, Poulet DG…"
            required
          />
        </div>

        {/* ── Description ── */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ingrédients, accompagnements, allergènes…"
            rows={2}
          />
        </div>

        {/* ── Prix + Catégorie ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Prix (FCFA) *</label>
            <Input
              type="number"
              min="0"
              step="100"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="3 500"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Catégorie</label>
            <Input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Plats signatures, Boissons…"
            />
          </div>
        </div>

        {/* ── Suppléments ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Suppléments</p>
              <p className="text-xs text-muted-foreground">
                Extras que le client peut ajouter à ce plat
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addSupp}>
              <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
            </Button>
          </div>

          {supps.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              Pas de supplément — ex : Plantain extra (500 FCFA), Miondo (300 FCFA)
            </div>
          ) : (
            <div className="space-y-2">
              {supps.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    value={s.name}
                    onChange={e => updateSupp(i, "name", e.target.value)}
                    placeholder="Nom du supplément"
                    className="flex-1 h-9"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={s.price}
                    onChange={e => updateSupp(i, "price", Number(e.target.value))}
                    placeholder="Prix"
                    className="w-28 h-9"
                  />
                  <button
                    type="button"
                    onClick={() => removeSupp(i)}
                    className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Mettre 0 pour un supplément gratuit.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pied de formulaire */}
      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-muted/20">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Annuler
        </Button>
        <Button type="submit" disabled={busy || uploading}>
          {busy
            ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enregistrement…</>
            : initial ? "Mettre à jour" : "Ajouter le plat"
          }
        </Button>
      </div>
    </form>
  );
}
