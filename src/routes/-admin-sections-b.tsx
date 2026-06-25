import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Check, X, Navigation, ImagePlus, Loader2, Utensils, Search } from "lucide-react";
import { fetchRoute, formatDist, formatDuration, type RouteData } from "@/lib/mapbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapView } from "@/components/MapView";
import type { MapMarker } from "@/components/MapView";
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA, ROYAL_HOUSE_ID, STATUS_LABEL, STATUS_COLOR } from "@/lib/orders";
import type { OrderStatus } from "@/lib/orders";

// Catégories prédéfinies pour le menu
const MENU_CATEGORIES = [
  "Plats signatures",
  "Grillades",
  "Sauces & ragoûts",
  "Accompagnements",
  "Entrées & salades",
  "Soupes & bouillons",
  "Boissons",
  "Desserts",
  "Autre",
];

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
        .not("status", "in", "(delivered,cancelled)")
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
// SectionMenu — types
// ---------------------------------------------------------------------------

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

type MenuSupp = { name: string; price: number };

// ---------------------------------------------------------------------------
// SectionMenu — formulaire plat
// ---------------------------------------------------------------------------

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

  const addSupp    = () => setSupps(s => [...s, { name: "", price: 0 }]);
  const updateSupp = (i: number, field: keyof MenuSupp, val: string | number) =>
    setSupps(s => s.map((x, j) => j === i ? { ...x, [field]: val } : x));
  const removeSupp = (i: number) => setSupps(s => s.filter((_, j) => j !== i));

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
    <form onSubmit={handleSubmit} className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Titre */}
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
        {/* Photo */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Photo du plat</Label>
          <div
            onClick={pickFile}
            className={`relative w-full rounded-xl border-2 border-dashed transition-colors cursor-pointer overflow-hidden
              ${uploading
                ? "border-primary/40 bg-primary/5"
                : "border-muted-foreground/20 bg-muted/30 hover:bg-muted/60 hover:border-primary/40"}`}
            style={{ height: 180 }}
          >
            {imageUrl ? (
              <>
                <img src={imageUrl} alt="Aperçu" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <ImagePlus className="h-6 w-6 text-white" />
                  <span className="text-white text-sm font-medium">Changer la photo</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 select-none">
                {uploading
                  ? <Loader2 className="h-9 w-9 text-primary animate-spin" />
                  : <ImagePlus className="h-9 w-9 text-muted-foreground/60" />}
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

        {/* Nom */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Nom du plat *</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex : Ndolé Royal, Poulet DG…"
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Description</Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ingrédients, accompagnements, allergènes…"
            rows={2}
          />
        </div>

        {/* Prix + Catégorie */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Prix (FCFA) *</Label>
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
            <Label className="text-sm font-medium">Catégorie</Label>
            <Select
              value={MENU_CATEGORIES.includes(category) ? category : "Autre"}
              onValueChange={val => setCategory(val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {MENU_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Champ libre si "Autre" */}
            {(!MENU_CATEGORIES.includes(category) || category === "Autre") && (
              <Input
                value={category === "Autre" ? "" : category}
                onChange={e => setCategory(e.target.value || "Autre")}
                placeholder="Précisez la catégorie…"
                className="mt-1.5 h-8 text-sm"
              />
            )}
          </div>
        </div>

        {/* Suppléments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Suppléments</p>
              <p className="text-xs text-muted-foreground">Extras que le client peut ajouter</p>
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

      {/* Pied */}
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

// ---------------------------------------------------------------------------
// SectionMenu (export) — grille + onglets catégories
// ---------------------------------------------------------------------------

export function SectionMenu() {
  const queryClient = useQueryClient();
  const [editing, setEditing]           = useState<MenuItem | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [activeCategory, setActiveCategory] = useState("Tous");

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

  const refresh   = () => queryClient.invalidateQueries({ queryKey: ["menu-admin", ROYAL_HOUSE_ID] });
  const openNew   = () => { setEditing(null); setShowForm(true); };
  const openEdit  = (item: MenuItem) => { setEditing(item); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const toggleAvail = async (item: MenuItem) => {
    const { error } = await supabase
      .from("menu_items" as any)
      .update({ available: !item.available })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Supprimer ce plat ?")) return;
    const { error } = await supabase.from("menu_items" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Plat supprimé");
    refresh();
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map(i => i.category ?? "Autres")));
    return ["Tous", ...cats];
  }, [items]);

  const filtered = useMemo(() =>
    activeCategory === "Tous"
      ? items
      : items.filter(i => (i.category ?? "Autres") === activeCategory),
    [items, activeCategory]
  );

  return (
    <div className="flex flex-col h-full">

      {/* Barre supérieure */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div>
          <h2 className="text-2xl font-bold">Menu</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} plat{items.length !== 1 ? "s" : ""} au total
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />Ajouter un plat
        </Button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="px-6 pb-4">
          <MenuItemForm
            key={editing?.id ?? "new"}
            initial={editing}
            onClose={closeForm}
            onSaved={() => { closeForm(); refresh(); }}
          />
        </div>
      )}

      {/* Onglets catégories */}
      <div className="px-6 pb-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {categories.map(cat => {
            const count = cat === "Tous"
              ? items.length
              : items.filter(i => (i.category ?? "Autres") === cat).length;
            const thumb = cat !== "Tous"
              ? items.find(i => (i.category ?? "Autres") === cat && i.image_url)?.image_url
              : null;
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all whitespace-nowrap
                  ${active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}
              >
                {thumb && (
                  <img src={thumb} alt={cat} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                )}
                <span>{cat}</span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md
                  ${active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grille de plats */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {items.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded-2xl gap-3 text-muted-foreground">
            <Utensils className="h-8 w-8 opacity-40" />
            <p className="text-sm">Aucun plat. Cliquez sur « Ajouter un plat » pour commencer.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded-2xl gap-2 text-muted-foreground">
            <p className="text-sm">Aucun plat dans cette catégorie.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(item => (
              <div
                key={item.id}
                className="group rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Photo */}
                <div className="relative w-full bg-muted" style={{ paddingBottom: "65%" }}>
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-4xl">
                      🍽️
                    </div>
                  )}
                  {/* Badge dispo */}
                  <div className="absolute top-2 left-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                      ${item.available ? "bg-green-500/90 text-white" : "bg-black/50 text-white"}`}>
                      {item.available ? "Disponible" : "Indisponible"}
                    </span>
                  </div>
                  {/* Actions hover */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(item)}
                      className="h-7 w-7 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center shadow hover:bg-white transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5 text-foreground" />
                    </button>
                    <button
                      onClick={() => remove(item.id)}
                      className="h-7 w-7 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center shadow hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>

                {/* Infos */}
                <div className="p-3 space-y-1.5">
                  <p className="font-semibold text-sm leading-tight line-clamp-2">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-bold text-primary">
                      {formatFCFA(Number(item.price))}
                    </span>
                    {Array.isArray(item.components) && item.components.length > 0 && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                        +{item.components.length} suppl.
                      </span>
                    )}
                  </div>
                  {/* Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t mt-1">
                    <span className="text-xs text-muted-foreground">
                      {item.available ? "Masquer du menu" : "Remettre en ligne"}
                    </span>
                    <Switch
                      checked={item.available}
                      onCheckedChange={() => toggleAvail(item)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionHistorique (export)
// ---------------------------------------------------------------------------

export function SectionHistorique() {
  const [search, setSearch] = useState("");

  // 1. Commandes livrées/annulées
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total, created_at, dropoff_address, client_id, items")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .in("status", ["delivered", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; status: string; total: number | null;
        created_at: string; dropoff_address: string | null;
        client_id: string; items: any;
      }>;
    },
  });

  // 2. Profils des clients (jointure manuelle : client_id → profiles.id)
  const clientIds = useMemo(() => [...new Set(orders.map(o => o.client_id))], [orders]);

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["admin-history-profiles", clientIds],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", clientIds);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map(p => [p.id, p])) as Record<
        string, { id: string; full_name: string | null; phone: string | null }
      >;
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const s = search.toLowerCase();
    return orders.filter(o => {
      const name = profilesMap[o.client_id]?.full_name ?? "";
      return (
        o.id.toLowerCase().startsWith(s) ||
        name.toLowerCase().includes(s) ||
        (o.dropoff_address ?? "").toLowerCase().includes(s)
      );
    });
  }, [orders, profilesMap, search]);

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Historique</h2>
          <p className="text-sm text-muted-foreground">
            {orders.length} commande{orders.length !== 1 ? "s" : ""} terminées
          </p>
        </div>
      </div>

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ID, nom client ou adresse…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {search ? "Aucun résultat pour cette recherche." : "Aucune commande terminée pour le moment."}
          </div>
        ) : (
          filtered.map(o => {
            const profile = profilesMap[o.client_id];
            const items = Array.isArray(o.items) ? o.items as Array<{ name: string; qty: number }> : [];
            return (
              <div
                key={o.id}
                className="flex items-start gap-4 rounded-xl border bg-card p-4 hover:bg-muted/20 transition-colors"
              >
                {/* Infos principales */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded">
                      #{o.id.slice(0, 8).toUpperCase()}
                    </span>
                    <Badge className={`${statusColor(o.status as OrderStatus)} text-[10px]`}>
                      {statusLabel(o.status as OrderStatus)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    {profile?.full_name ?? "Client inconnu"}
                    {profile?.phone && (
                      <span className="text-xs text-muted-foreground font-normal ml-2">{profile.phone}</span>
                    )}
                  </p>
                  {o.dropoff_address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{o.dropoff_address}</span>
                    </p>
                  )}
                  {items.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {items.slice(0, 3).map(i => `${i.name} ×${i.qty}`).join(" · ")}
                      {items.length > 3 && ` · +${items.length - 3} autre${items.length - 3 > 1 ? "s" : ""}`}
                    </p>
                  )}
                </div>

                {/* Montant */}
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold text-primary">
                    {formatFCFA(Number(o.total ?? 0))}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
