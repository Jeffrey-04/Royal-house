import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Check, X, Navigation } from "lucide-react";
import { fetchRoute, formatDist, formatDuration, type RouteData } from "@/lib/mapbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MapView } from "@/components/MapView";
import type { MapMarker } from "@/components/MapView";
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA, ROYAL_HOUSE_ID, STATUS_LABEL, STATUS_COLOR } from "@/lib/orders";
import type { OrderStatus } from "@/lib/orders";

// ---------------------------------------------------------------------------
// Helpers locaux
// ---------------------------------------------------------------------------
function statusLabel(status: string): string {
  return STATUS_LABEL[status as OrderStatus] ?? status;
}

function statusColor(status: string): string {
  return STATUS_COLOR[status as OrderStatus] ?? "";
}

// ---------------------------------------------------------------------------
// SectionSuivi — sous-composants internes
// ---------------------------------------------------------------------------

function OrderListPanel({
  orders,
  restaurant,
  onSelect,
}: {
  orders: any[];
  restaurant: any;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 border-b p-3">
        <span className="text-base">🍽️</span>
        <div>
          <p className="text-sm font-semibold">{restaurant?.name ?? "Royal House"}</p>
          <p className="text-xs text-muted-foreground">
            {orders.length} commande{orders.length !== 1 ? "s" : ""} en cours
          </p>
        </div>
      </div>
      {orders.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground text-center">
          Aucune commande pour le moment.
        </p>
      ) : (
        <div className="divide-y">
          {orders.map((o) => (
            <button
              key={o.id}
              className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
              onClick={() => onSelect(o.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-semibold">
                  #{o.id.slice(0, 6).toUpperCase()}
                </span>
                <Badge className={`${statusColor(o.status)} text-[10px]`}>
                  {statusLabel(o.status)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground truncate flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {o.dropoff_address}
              </p>
              <p className="mt-0.5 text-xs font-semibold">
                {formatFCFA(Number(o.total ?? 0))}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderDetailPanel({
  order,
  route,
  orders,
  currentIdx,
  onBack,
  onNavigate,
  onUpdate,
}: {
  order: any;
  route: RouteData | null;
  orders: any[];
  currentIdx: number;
  onBack: () => void;
  onNavigate: (id: string) => void;
  onUpdate: (id: string, status: string) => Promise<void>;
}) {
  const NEXT_STATUS: Partial<Record<string, { label: string; next: string }>> = {
    pending: { label: "Accepter", next: "accepted" },
    accepted: { label: "Commencer", next: "preparing" },
    preparing: { label: "Marquer prête", next: "ready" },
  };
  const action = NEXT_STATUS[order.status];
  const items = order.items as Array<{ name: string; qty: number; price: number }> | null;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < orders.length - 1;

  return (
    <div>
      <div className="flex items-center gap-2 border-b p-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1 hover:bg-muted transition-colors"
          title="Retour à la liste"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold flex-1">
          #{order.id.slice(0, 6).toUpperCase()}
        </span>
        <Badge className={`${statusColor(order.status)} text-[10px]`}>
          {statusLabel(order.status)}
        </Badge>
        {/* Navigation prev / next entre commandes */}
        {orders.length > 1 && (
          <div className="flex items-center gap-1 ml-1">
            <button
              disabled={!hasPrev}
              onClick={() => onNavigate(orders[currentIdx - 1].id)}
              className="rounded p-0.5 hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Commande précédente"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {currentIdx + 1}/{orders.length}
            </span>
            <button
              disabled={!hasNext}
              onClick={() => onNavigate(orders[currentIdx + 1].id)}
              className="rounded p-0.5 hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Commande suivante"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="p-3 space-y-3">
        {/* Timestamp */}
        <p className="text-xs text-muted-foreground">
          {new Date(order.created_at).toLocaleString("fr-FR")}
        </p>
        {/* Client */}
        {order.profiles && (
          <div className="rounded-xl bg-muted/50 p-3 space-y-1">
            <p className="text-xs font-semibold">Client</p>
            <p className="text-sm">{order.profiles.full_name ?? "—"}</p>
            {order.profiles.phone && (
              <p className="text-xs text-muted-foreground">{order.profiles.phone}</p>
            )}
          </div>
        )}
        {/* Adresse */}
        <div className="flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{order.dropoff_address}</p>
        </div>
        {/* Articles */}
        <div>
          <p className="text-xs font-semibold mb-2">Articles</p>
          <div className="space-y-1">
            {items?.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span>
                  {item.qty} × {item.name}
                </span>
                <span className="text-muted-foreground">
                  {formatFCFA(item.price * item.qty)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t text-sm font-semibold">
            <span>Total</span>
            <span>{formatFCFA(Number(order.total ?? 0))}</span>
          </div>
        </div>
        {/* ETA livreur */}
        {route && ["picked_up", "delivering"].includes(order.status) && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-blue-700">
              <Navigation className="h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="text-xs font-bold">{formatDist(route.distanceM)} · {formatDuration(route.durationS)}</p>
                <p className="text-[10px] text-blue-500">Temps estimé d'arrivée chez le client</p>
              </div>
            </div>
            {route.steps[0] && (
              <p className="text-[10px] text-blue-600 border-t border-blue-200 pt-1.5">
                {route.steps[0].instruction}
              </p>
            )}
          </div>
        )}
        {/* Action */}
        {action && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => onUpdate(order.id, action.next)}
          >
            <Check className="h-3.5 w-3.5 mr-1" /> {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionSuivi (export)
// ---------------------------------------------------------------------------

export function SectionSuivi({
  updateStatus,
}: {
  updateStatus: (id: string, status: string) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);

  // Restaurant
  const { data: restaurant } = useQuery({
    queryKey: ["royal-house"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", ROYAL_HOUSE_ID)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Commandes actives — jointure FK profiles supprimée (pas de FK directe orders→profiles)
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
      return data ?? [];
    },
    staleTime: 10_000,
  });

  // Positions livreurs (polling 4s)
  const activeIds = activeOrders.map((o) => o.id);
  const { data: courierLocs = [] } = useQuery({
    queryKey: ["admin-courier-locs"],
    queryFn: async () => {
      if (!activeIds.length) return [];
      const { data, error } = await supabase
        .from("courier_locations")
        .select("*")
        .in("order_id", activeIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: activeIds.length > 0,
    refetchInterval: 4_000,
  });

  const selectedOrder = activeOrders.find((o) => o.id === selectedId) ?? null;
  const locById = useMemo(
    () => new Map((courierLocs as any[]).map((cl) => [cl.order_id, cl])),
    [courierLocs],
  );

  // Calcul itinéraire pour la commande sélectionnée (livreur → client)
  useEffect(() => {
    if (!selectedOrder) { setRoute(null); return; }
    if (!["picked_up", "delivering"].includes(selectedOrder.status)) { setRoute(null); return; }
    const toLng = Number(selectedOrder.dropoff_lng);
    const toLat = Number(selectedOrder.dropoff_lat);
    if (!Number.isFinite(toLng) || !Number.isFinite(toLat)) { setRoute(null); return; }
    const loc = locById.get(selectedOrder.id);
    const fromLng = loc ? loc.lng : Number(selectedOrder.pickup_lng);
    const fromLat = loc ? loc.lat : Number(selectedOrder.pickup_lat);
    if (!Number.isFinite(fromLng) || !Number.isFinite(fromLat)) { setRoute(null); return; }
    fetchRoute(fromLng, fromLat, toLng, toLat).then(setRoute);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedOrder?.status]);

  const markers = useMemo((): MapMarker[] => {
    const ms: MapMarker[] = [];
    if (restaurant) {
      ms.push({ id: "restaurant", lat: restaurant.lat, lng: restaurant.lng, kind: "restaurant", label: restaurant.name });
    }
    activeOrders.forEach((o) => {
      if (Number.isFinite(Number(o.dropoff_lat)) && Number.isFinite(Number(o.dropoff_lng)))
        ms.push({ id: `drop-${o.id}`, lat: Number(o.dropoff_lat), lng: Number(o.dropoff_lng), kind: "dropoff", label: o.dropoff_address });
    });
    (courierLocs as any[]).forEach((cl) => {
      ms.push({ id: `courier-${cl.order_id}`, lat: cl.lat, lng: cl.lng, kind: "courier", pulse: true });
    });
    return ms;
  }, [restaurant, activeOrders, courierLocs]);

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <MapView
        markers={markers}
        fitToMarkers={!route && markers.length > 1}
        routeLine={route?.coords}
        center={[3.8917, 11.5167]}
        zoom={13}
        selectedId={selectedId}
        onMarkerClick={(id) => {
          const orderId = id.replace(/^(drop|courier)-/, "");
          setSelectedId(orderId);
        }}
        className="h-full w-full"
      />

      {/* Panel flottant */}
      <div className="absolute right-4 top-4 z-10 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border bg-card/95 backdrop-blur-sm shadow-lg">
        {selectedOrder ? (
          <OrderDetailPanel
            order={selectedOrder}
            route={route}
            orders={activeOrders}
            currentIdx={activeOrders.findIndex(o => o.id === selectedId)}
            onBack={() => { setSelectedId(null); setRoute(null); }}
            onNavigate={(id) => { setSelectedId(id); setRoute(null); }}
            onUpdate={updateStatus}
          />
        ) : (
          <OrderListPanel
            orders={activeOrders}
            restaurant={restaurant}
            onSelect={setSelectedId}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionMenu — sous-composant formulaire
// ---------------------------------------------------------------------------

function MenuItemForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState<string>(initial?.name ?? "");
  const [description, setDescription] = useState<string>(initial?.description ?? "");
  const [price, setPrice] = useState<string>(String(initial?.price ?? ""));
  const [category, setCategory] = useState<string>(initial?.category ?? "Plats signatures");
  const [emoji, setEmoji] = useState<string>(initial?.emoji ?? "🍽️");
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
        <Button type="button" variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-[80px_1fr] gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Emoji</Label>
          <Input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            className="text-center text-xl"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nom</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Prix (FCFA)</Label>
          <Input
            type="number"
            step="100"
            min="0"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Catégorie</Label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Plats signatures, Boissons…"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// SectionMenu (export)
// ---------------------------------------------------------------------------

export function SectionMenu() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: menuItems = [] } = useQuery({
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

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["menu-admin", ROYAL_HOUSE_ID] });

  const toggleAvail = async (item: any) => {
    const { error } = await (supabase as any)
      .from("menu_items")
      .update({ available: !item.available })
      .eq("id", item.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Supprimer ce plat ?")) return;
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
          <p className="text-sm text-muted-foreground">
            Gérez les plats proposés à vos clients.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nouveau plat
        </Button>
      </div>

      {showForm && (
        <MenuItemForm
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            refresh();
          }}
        />
      )}

      <div className="space-y-2">
        {menuItems.length === 0 && !showForm && (
          <div className="text-center text-sm text-muted-foreground border border-dashed rounded-xl p-8">
            Aucun plat. Cliquez sur « Nouveau plat » pour commencer.
          </div>
        )}
        {menuItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl border bg-background p-4"
          >
            <span className="text-2xl">{item.emoji ?? "🍽️"}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{item.name}</div>
              {item.description && (
                <div className="text-xs text-muted-foreground line-clamp-1">
                  {item.description}
                </div>
              )}
              <div className="text-xs mt-1 flex gap-2 items-center">
                <span className="font-semibold text-primary">
                  {formatFCFA(Number(item.price))}
                </span>
                {item.category && (
                  <Badge variant="secondary" className="text-xs">
                    {item.category}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                <Switch
                  checked={item.available}
                  onCheckedChange={() => toggleAvail(item)}
                />
                <span className="text-muted-foreground">
                  {item.available ? "Dispo" : "Indispo"}
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditing(item);
                  setShowForm(true);
                }}
              >
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

// ---------------------------------------------------------------------------
// SectionHistorique (export)
// ---------------------------------------------------------------------------

export function SectionHistorique() {
  const [search, setSearch] = useState("");

  const { data: orders } = useQuery({
    queryKey: ["admin-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, profiles!orders_client_id_fkey(full_name, phone)")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .in("status", ["delivered", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      (orders ?? []).filter((o) => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return (
          o.id.toLowerCase().startsWith(s) ||
          ((o as any).profiles?.full_name ?? "").toLowerCase().includes(s) ||
          o.dropoff_address.toLowerCase().includes(s)
        );
      }),
    [orders, search],
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Historique</h2>
        <p className="text-sm text-muted-foreground">
          {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>
      <Input
        placeholder="Rechercher par ID, client ou adresse…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun résultat</p>
        ) : (
          filtered.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold">
                    #{o.id.slice(0, 6).toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm mt-0.5">
                  {(o as any).profiles?.full_name ?? "Client inconnu"}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{o.dropoff_address}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge className={`${statusColor(o.status as any)} text-[10px] mb-1`}>
                  {statusLabel(o.status as any)}
                </Badge>
                <p className="text-sm font-semibold">
                  {formatFCFA(Number(o.total ?? 0))}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
