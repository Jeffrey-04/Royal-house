import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode } from "react";
import { toast } from "sonner";
import {
  Plus, Minus, Trash2, MapPin, ChevronRight,
  ShoppingBag, Star, TrendingUp, Package, Phone,
  Locate, Loader2, CheckCircle2, CreditCard, ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapView } from "@/components/MapView";
import type { MapMarker } from "@/components/MapView";
import {
  STATUS_LABEL, STATUS_COLOR, statusProgress, formatFCFA, cartItemTotal,
  ROYAL_HOUSE_ID, type CartItem, type Extra, type OrderStatus,
} from "@/lib/orders";
import momoUrl from "@/assets/MOMO.png?url";
import omUrl   from "@/assets/OM.png?url";

// ——————————————————————————————————————————————
// Config
// ——————————————————————————————————————————————
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string;

// ——————————————————————————————————————————————
// Types
// ——————————————————————————————————————————————
type MenuItem = {
  id: string; name: string; price: number;
  description: string | null; category: string;
  image_url: string | null;
  components: Array<{ name: string; price: number }> | null;
};
type OrderRow = {
  id: string; status: OrderStatus; total: string | number | null;
  items: CartItem[] | null; dropoff_address: string | null; created_at: string;
  dropoff_lat?: number | null; dropoff_lng?: number | null; courier_id?: string | null;
};

// Coordonnées du restaurant (point de départ de chaque livraison)
const RESTAURANT_LAT = 3.8480;
const RESTAURANT_LNG = 11.5021;

// Grille tarifaire fixe selon la distance routière restaurant → client
const DELIVERY_FEE_TIERS: Array<{ maxKm: number; fee: number }> = [
  { maxKm: 2,        fee: 500  },
  { maxKm: 5,        fee: 1000 },
  { maxKm: 10,       fee: 1500 },
  { maxKm: 20,       fee: 2000 },
  { maxKm: Infinity, fee: 2500 },
];

function getDeliveryFee(distanceKm: number): number {
  return DELIVERY_FEE_TIERS.find(t => distanceKm <= t.maxKm)?.fee ?? 2500;
}

/** Distance routière via Mapbox Directions API. Retourne null si la requête échoue. */
async function getRoadDistanceKm(dropoffLat: number, dropoffLng: number): Promise<number | null> {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${RESTAURANT_LNG},${RESTAURANT_LAT};${dropoffLng},${dropoffLat}` +
    `?access_token=${MAPBOX_TOKEN}&overview=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const meters: number | undefined = json.routes?.[0]?.distance;
    return meters != null ? meters / 1000 : null;
  } catch {
    return null;
  }
}

/** Fallback Haversine × 1.35 (facteur route/vol d'oiseau) si Mapbox échoue. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.35;
}

// ——————————————————————————————————————————————
// Shared hook
// ——————————————————————————————————————————————
function useMenuItems() {
  return useQuery({
    queryKey: ["menu-items", ROYAL_HOUSE_ID],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, price, description, category, image_url, components")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .eq("available", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as MenuItem[];
    },
  });
}

// ——————————————————————————————————————————————
// SectionAccueil
// ——————————————————————————————————————————————
export function SectionAccueil({ userId, profile, cart, addToCart, updateQty, removeFromCart, clearCart, onCommander, onSuivi, onCommandes }: {
  userId: string;
  profile: { full_name: string | null } | null | undefined;
  cart: CartItem[];
  addToCart: (item: { id: string; name: string; price: number }, extras?: Extra[]) => void;
  updateQty: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  onCommander: () => void;
  onSuivi: () => void;
  onCommandes: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: items = [] } = useMenuItems();

  const { data: orders = [] } = useQuery({
    queryKey: ["client-orders-dash", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, total, items, dropoff_address, dropoff_lat, dropoff_lng, courier_id, created_at")
        .eq("client_id", userId).order("created_at", { ascending: false }).limit(10);
      return (data ?? []) as OrderRow[];
    },
  });

  // Real-time order updates
  useEffect(() => {
    const ch = supabase
      .channel(`dash-orders-rt-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `client_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["client-orders-dash", userId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, queryClient]);

  const stats = useMemo(() => {
    const delivered = orders.filter(o => o.status === "delivered");
    const totalSpent = delivered.reduce((s, o) => s + Number(o.total), 0);
    return { total: orders.length, points: Math.floor(totalSpent / 100), totalSpent };
  }, [orders]);

  const activeOrder = orders.find(o => !["delivered", "cancelled"].includes(o.status));
  const isDelivering = activeOrder && ["picked_up", "delivering"].includes(activeOrder.status);
  const recentOrders = orders.slice(0, 4);
  const hasCart = cart.length > 0;

  // Courier & restaurant location (only when actively delivering)
  const { data: restaurant } = useQuery({
    queryKey: ["restaurant-loc"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("name, lat, lng").eq("id", ROYAL_HOUSE_ID).maybeSingle();
      return data;
    },
  });

  const { data: courierLoc } = useQuery({
    queryKey: ["courier-loc-dash", activeOrder?.courier_id],
    enabled: !!activeOrder?.courier_id && !!isDelivering,
    refetchInterval: 4_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("courier_locations").select("lat, lng")
        .eq("courier_id", activeOrder!.courier_id!).maybeSingle();
      return data;
    },
  });

  const trackingMarkers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (restaurant?.lat && restaurant?.lng)
      m.push({ id: "restaurant", kind: "restaurant", lat: restaurant.lat, lng: restaurant.lng });
    if (activeOrder?.dropoff_lat && activeOrder?.dropoff_lng)
      m.push({ id: "dropoff", kind: "dropoff", lat: activeOrder.dropoff_lat, lng: activeOrder.dropoff_lng });
    if (courierLoc?.lat && courierLoc?.lng)
      m.push({ id: "courier", kind: "courier", lat: courierLoc.lat, lng: courierLoc.lng });
    return m;
  }, [restaurant, activeOrder, courierLoc]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const firstName = profile?.full_name?.split(" ")[0] || "là";

  return (
    <div className="p-5 max-w-7xl mx-auto">
      <div className={`grid gap-5 ${hasCart || activeOrder ? "xl:grid-cols-[1fr_300px]" : ""}`}>
        {/* ── LEFT ── */}
        <div className="space-y-5 min-w-0">
          {/* Hero banner */}
          <div className="relative overflow-hidden rounded-2xl bg-primary px-7 py-9">
            <div
              className="absolute inset-0 opacity-15"
              style={{ background: "radial-gradient(ellipse at 85% 50%, white 0%, transparent 65%)" }}
            />
            <div className="relative z-10 max-w-sm">
              <p className="text-primary-foreground/75 text-sm font-medium">{greeting},</p>
              <h2 className="text-3xl font-extrabold text-primary-foreground mt-0.5 mb-2">{firstName} 👑</h2>
              <p className="text-primary-foreground/70 text-sm mb-4">
                Qu'avez-vous envie de manger aujourd'hui ?
              </p>
              <Button size="sm" variant="secondary" onClick={onCommander}>
                Commander maintenant <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>

          {/* ── Delivery tracking widget (only when courier is on the way) ── */}
          {isDelivering && activeOrder && (
            <DeliveryTrackingWidget
              order={activeOrder}
              markers={trackingMarkers}
              onSuivi={onSuivi}
            />
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Commandes" value={String(stats.total)} icon={<ShoppingBag className="h-4 w-4" />} />
            <StatCard label="Points fidélité" value={String(stats.points)} icon={<Star className="h-4 w-4" />} accent />
            <StatCard label="Dépensé" value={formatFCFA(stats.totalSpent)} icon={<TrendingUp className="h-4 w-4" />} />
          </div>

          {/* Featured items */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base">Nos spécialités</h3>
              <button onClick={onCommander} className="text-xs text-primary flex items-center gap-0.5 hover:underline">
                Voir tout <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.slice(0, 6).map(item => {
                const inCart = cart.find(c => c.id === item.id);
                const hasComponents = (item.components?.length ?? 0) > 0;
                return (
                  <div key={item.id} className="rounded-xl border bg-card p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow">
                    <MenuItemImage imageUrl={item.image_url} name={item.name} className="h-20 rounded-lg" />
                    <p className="font-medium text-sm leading-tight text-center">{item.name}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-primary font-bold text-sm">{formatFCFA(item.price)}</span>
                      {hasComponents ? (
                        <CustomizeDialog item={item} onAdd={addToCart}>
                          <button className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors
                            ${inCart ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"}`}>
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </CustomizeDialog>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors
                            ${inCart ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {inCart && <p className="text-xs text-primary text-center font-medium">× {inCart.qty}</p>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent orders */}
          {recentOrders.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base">Commandes récentes</h3>
                <button onClick={onCommandes} className="text-xs text-primary flex items-center gap-0.5 hover:underline">
                  Voir tout <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {recentOrders.map(order => (
                  <RecentOrderRow key={order.id} order={order} onCommander={onCommander} onSuivi={onSuivi} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        {(hasCart || activeOrder) && (
          <div className="space-y-4 shrink-0">
            {/* Active order preparation status (before pickup) */}
            {activeOrder && !isDelivering && (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Commande en cours</h3>
                  <button onClick={onSuivi} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                    Suivre <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Badge className={`${STATUS_COLOR[activeOrder.status]} gap-1`}>
                  <Package className="h-3 w-3" />
                  {STATUS_LABEL[activeOrder.status]}
                </Badge>
                <div className="space-y-1">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all duration-700"
                      style={{ width: `${statusProgress(activeOrder.status)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{statusProgress(activeOrder.status)}% complété</p>
                </div>
                <p className="text-sm font-bold text-primary">{formatFCFA(Number(activeOrder.total))}</p>
              </div>
            )}

            {/* Cart panel */}
            {hasCart && (
              <CartPanel
                cart={cart}
                updateQty={updateQty}
                removeFromCart={removeFromCart}
                clearCart={clearCart}
                userId={userId}
                onSuccess={onCommandes}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————
// SectionCommander
// ——————————————————————————————————————————————
export function SectionCommander({ userId, search, setSearch, cart, addToCart, updateQty, removeFromCart, clearCart, onCheckout }: {
  userId: string;
  search: string;
  setSearch: (v: string) => void;
  cart: CartItem[];
  addToCart: (item: { id: string; name: string; price: number }, extras?: Extra[]) => void;
  updateQty: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  onCheckout: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState("Tous");
  const { data: items = [], isLoading } = useMenuItems();
  const hasCart = cart.length > 0;

  const categories = useMemo(
    () => ["Tous", ...Array.from(new Set(items.map(i => i.category)))],
    [items]
  );

  const filtered = useMemo(() => {
    let result = activeCategory !== "Tous" ? items.filter(i => i.category === activeCategory) : items;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
    }
    return result;
  }, [items, activeCategory, search]);

  return (
    <div className="p-5 max-w-7xl mx-auto">
      <div className={`grid gap-5 ${hasCart ? "xl:grid-cols-[1fr_300px]" : ""}`}>
        <div className="space-y-4 min-w-0">
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                  ${activeCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border bg-card animate-pulse h-44" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-5xl mb-3">🍽️</p>
              <p className="font-medium">Aucun plat trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-6">
              {filtered.map(item => {
                const inCart = cart.find(c => c.id === item.id);
                const hasComponents = (item.components?.length ?? 0) > 0;
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border bg-card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
                  >
                    <MenuItemImage imageUrl={item.image_url} name={item.name} className="h-28 rounded-xl" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm leading-tight">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                      {hasComponents && (
                        <p className="text-[10px] text-primary/70 mt-1">+ suppléments disponibles</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-1">
                      <span className="text-primary font-bold text-sm">{formatFCFA(item.price)}</span>
                      {hasComponents ? (
                        <CustomizeDialog item={item} onAdd={addToCart}>
                          <button className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors
                            ${inCart ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"}`}>
                            <Plus className="h-4 w-4" />
                          </button>
                        </CustomizeDialog>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors
                            ${inCart ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {inCart && <p className="text-xs text-primary font-medium">× {inCart.qty} dans le panier</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart panel */}
        {hasCart && (
          <div className="xl:sticky xl:top-5 xl:self-start">
            <CartPanel
              cart={cart}
              updateQty={updateQty}
              removeFromCart={removeFromCart}
              clearCart={clearCart}
              userId={userId}
              onSuccess={onCheckout}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————
// Geocoding helpers
// ——————————————————————————————————————————————
async function geocodeAddress(text: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const q = encodeURIComponent(`${text}, Yaoundé, Cameroun`);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${MAPBOX_TOKEN}&country=cm&language=fr&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const f = json.features?.[0];
  if (!f) return null;
  return { lng: f.center[0], lat: f.center[1], label: f.place_name };
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=fr&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return json.features?.[0]?.place_name ?? null;
}

// ——————————————————————————————————————————————
// CartPanel (shared)
// ——————————————————————————————————————————————
type PaymentMethod = "orange_money" | "mtn_money";
type CartStep = "cart" | "payment" | "processing";

const PAYMENT_METHODS: { id: PaymentMethod; label: string; color: string; bg: string; logo: string }[] = [
  { id: "orange_money", label: "Orange Money",    logo: omUrl,   color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  { id: "mtn_money",   label: "MTN Mobile Money", logo: momoUrl, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
];

export function CartPanel({ cart, updateQty, removeFromCart, clearCart, userId, onSuccess }: {
  cart: CartItem[];
  updateQty: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  userId: string;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<CartStep>("cart");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("orange_money");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "geocoding" | "ok" | "error">("idle");
  const [deliveryFee, setDeliveryFee] = useState(500);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recalcule les frais dès que les coordonnées du client changent
  useEffect(() => {
    if (!coords) return;
    setDistanceLoading(true);
    getRoadDistanceKm(coords.lat, coords.lng).then(km => {
      const dist = km ?? haversineKm(RESTAURANT_LAT, RESTAURANT_LNG, coords.lat, coords.lng);
      setDistanceKm(dist);
      setDeliveryFee(getDeliveryFee(dist));
      setDistanceLoading(false);
    });
  }, [coords]);

  const subtotal = cart.reduce((s, i) => s + cartItemTotal(i), 0);
  const total = subtotal + deliveryFee;

  // Auto-geocode when user stops typing
  function handleAddressChange(val: string) {
    setAddress(val);
    setCoords(null);
    setDistanceKm(null);
    setDeliveryFee(500);
    setGeoState("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) return;
    debounceRef.current = setTimeout(async () => {
      setGeoState("geocoding");
      const result = await geocodeAddress(val);
      if (result) {
        setCoords({ lat: result.lat, lng: result.lng });
        setAddress(result.label);
        setGeoState("ok");
      } else {
        setGeoState("error");
      }
    }, 900);
  }

  // Share current GPS position
  async function locateMe() {
    if (!navigator.geolocation) { toast.error("Géolocalisation non supportée."); return; }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        setGeoState("geocoding");
        const label = await reverseGeocode(lat, lng);
        setAddress(label ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setGeoState("ok");
      },
      () => {
        setGeoState("error");
        toast.error("Impossible d'obtenir votre position.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // Étape 1 → 2 : valider l'adresse puis passer au paiement
  async function goToPayment() {
    if (!address.trim()) { toast.error("Entrez une adresse de livraison."); return; }
    if (!coords && geoState !== "ok") {
      setGeoState("geocoding");
      const result = await geocodeAddress(address);
      if (result) {
        setCoords({ lat: result.lat, lng: result.lng });
        setAddress(result.label);
        setGeoState("ok");
      } else {
        setGeoState("error");
      }
    }
    setStep("payment");
  }

  // Étape 2 → 3 : confirmer le paiement fictif puis créer la commande
  async function confirmPayment() {
    if (!paymentPhone.trim()) { toast.error("Entrez votre numéro de téléphone."); return; }
    setStep("processing");

    // Simulation d'un traitement paiement (2 s)
    await new Promise(r => setTimeout(r, 2000));

    let finalCoords = coords;
    if (!finalCoords) {
      const result = await geocodeAddress(address);
      if (result) { finalCoords = { lat: result.lat, lng: result.lng }; }
    }

    const { error } = await supabase.from("orders").insert({
      restaurant_id: ROYAL_HOUSE_ID,
      client_id: userId,
      items: cart as unknown as never,
      total,
      delivery_fee: deliveryFee,
      status: "pending",
      payment_method: paymentMethod,
      payment_status: "held",
      dropoff_address: address.trim(),
      dropoff_lat: (finalCoords?.lat ?? null) as number,
      dropoff_lng: (finalCoords?.lng ?? null) as number,
      pickup_lat: RESTAURANT_LAT,
      pickup_lng: RESTAURANT_LNG,
    } as unknown as never);

    if (error) {
      toast.error("Erreur lors de la commande.");
      setStep("payment");
      return;
    }
    toast.success("Paiement confirmé — commande envoyée !");
    void queryClient.invalidateQueries({ queryKey: ["client-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["client-orders-dash"] });
    clearCart();
    setAddress("");
    setCoords(null);
    setGeoState("idle");
    setStep("cart");
    onSuccess();
  }

  const geoIcon = geoState === "locating" || geoState === "geocoding"
    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
    : geoState === "ok"
    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    : <Locate className="h-3.5 w-3.5" />;

  // ── Étape 3 : Traitement en cours ──
  if (step === "processing") {
    return (
      <div className="rounded-2xl border bg-card p-6 flex flex-col items-center gap-4 text-center">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-7 w-7 text-primary animate-spin" />
        </div>
        <div>
          <p className="font-bold text-base">Traitement en cours…</p>
          <p className="text-sm text-muted-foreground mt-1">
            Votre paiement {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label} est en cours de validation.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Ne fermez pas cette fenêtre.</p>
      </div>
    );
  }

  // ── Étape 2 : Sélection du mode de paiement ──
  if (step === "payment") {
    const method = PAYMENT_METHODS.find(m => m.id === paymentMethod)!;
    return (
      <div className="rounded-2xl border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep("cart")}
            className="h-7 w-7 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <h3 className="font-semibold text-sm flex-1">Mode de paiement</h3>
          <span className="text-xs font-bold text-primary">{formatFCFA(total)}</span>
        </div>

        {/* Sélection méthode */}
        <div className="space-y-2">
          {PAYMENT_METHODS.map(m => (
            <button
              key={m.id}
              onClick={() => setPaymentMethod(m.id)}
              className={`w-full rounded-xl border p-3 flex items-center gap-3 transition-all text-left
                ${paymentMethod === m.id ? `${m.bg} border-current ${m.color}` : "bg-background border-border hover:border-muted-foreground/40"}`}
            >
              <img src={m.logo} alt={m.label} className="h-8 w-8 object-contain shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${paymentMethod === m.id ? m.color : ""}`}>{m.label}</p>
                <p className="text-xs text-muted-foreground">Paiement mobile sécurisé</p>
              </div>
              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0
                ${paymentMethod === m.id ? "border-current bg-current" : "border-muted-foreground/40"}`}>
                {paymentMethod === m.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
            </button>
          ))}
        </div>

        {/* Numéro de téléphone */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />Numéro {method.label}
          </label>
          <Input
            value={paymentPhone}
            onChange={e => setPaymentPhone(e.target.value)}
            placeholder="+237 6XX XXX XXX"
            type="tel"
            className="h-9 text-sm"
          />
        </div>

        {/* Récapitulatif montant */}
        <div className="rounded-xl bg-muted/50 p-3 space-y-1 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Plats</span><span>{formatFCFA(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Livraison</span><span>{formatFCFA(deliveryFee)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm pt-1 border-t mt-1">
            <span>Total à payer</span>
            <span className="text-primary">{formatFCFA(total)}</span>
          </div>
        </div>

        {(!coords || geoState === "geocoding") && (
          <p className="text-xs text-amber-600 text-center">
            {geoState === "geocoding" ? "Localisation de l'adresse…" : "Veuillez valider une adresse de livraison."}
          </p>
        )}
        <Button className="w-full" size="sm" onClick={confirmPayment} disabled={!coords || geoState === "geocoding"}>
          <CreditCard className="h-3.5 w-3.5 mr-1.5" />
          Confirmer le paiement — {formatFCFA(total)}
        </Button>
      </div>
    );
  }

  // ── Étape 1 : Panier + adresse ──
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Mon panier</h3>
        <button onClick={clearCart} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
          Vider
        </button>
      </div>

      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {cart.map((item, idx) => (
          <div key={`${item.id}-${idx}`} className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">{formatFCFA(item.price)}</p>
              {item.extras && item.extras.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {item.extras.map((e, i) => (
                    <p key={i} className="text-[10px] text-primary/70">
                      + {e.name} ×{e.qty} ({formatFCFA(e.price * e.qty)})
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              <button
                onClick={() => updateQty(item.id, -1)}
                className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className="w-5 text-center text-xs font-bold">{item.qty}</span>
              <button
                onClick={() => updateQty(item.id, 1)}
                className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
              <button
                onClick={() => removeFromCart(item.id)}
                className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <span className="text-xs font-semibold w-16 text-right shrink-0 mt-0.5">
              {formatFCFA(cartItemTotal(item))}
            </span>
          </div>
        ))}
      </div>

      {/* Adresse + géolocalisation */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-primary" />Adresse de livraison
        </label>
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Input
              value={address}
              onChange={e => handleAddressChange(e.target.value)}
              placeholder="Quartier, rue, Yaoundé"
              className="h-8 text-xs pr-7"
            />
            {geoState !== "idle" && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {geoIcon}
              </span>
            )}
          </div>
          <button
            onClick={locateMe}
            title="Utiliser ma position actuelle"
            disabled={geoState === "locating"}
            className="h-8 w-8 shrink-0 rounded-lg border bg-background flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
          >
            {geoState === "locating"
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Locate className="h-3.5 w-3.5" />}
          </button>
        </div>
        {geoState === "ok" && coords && (
          <p className="text-[10px] text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Position localisée ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
          </p>
        )}
        {geoState === "error" && (
          <p className="text-[10px] text-destructive">Adresse introuvable — la commande sera passée sans coordonnées.</p>
        )}
      </div>

      <div className="border-t pt-2 space-y-1 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>Sous-total (plats)</span><span>{formatFCFA(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span className="flex items-center gap-1">
            Livraison
            {distanceLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {distanceKm !== null && !distanceLoading && (
              <span className="text-[10px] text-muted-foreground/70">({distanceKm.toFixed(1)} km)</span>
            )}
            {!coords && !distanceLoading && (
              <span className="text-[10px] text-muted-foreground/70">(adresse requise)</span>
            )}
          </span>
          <span className={distanceLoading ? "opacity-50" : ""}>{formatFCFA(deliveryFee)}</span>
        </div>
        <div className="flex justify-between font-bold text-sm pt-1 border-t">
          <span>Total</span>
          <span className="text-primary">{formatFCFA(total)}</span>
        </div>
      </div>

      <Button className="w-full" size="sm" onClick={goToPayment}
        disabled={geoState === "locating" || geoState === "geocoding" || !address.trim()}>
        {geoState === "locating" || geoState === "geocoding"
          ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Localisation…</>
          : <><CreditCard className="h-3.5 w-3.5 mr-1.5" />Passer au paiement — {formatFCFA(total)}</>}
      </Button>
    </div>
  );
}

// ——————————————————————————————————————————————
// MenuItemImage
// ——————————————————————————————————————————————
function MenuItemImage({ imageUrl, name, className }: { imageUrl: string | null; name: string; className?: string }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`w-full object-cover bg-muted ${className ?? ""}`}
      />
    );
  }
  return (
    <div className={`w-full bg-muted flex items-center justify-center text-4xl select-none ${className ?? ""}`}>
      🍽️
    </div>
  );
}

// ——————————————————————————————————————————————
// CustomizeDialog — suppléments
// ——————————————————————————————————————————————
function CustomizeDialog({ item, onAdd, children }: {
  item: MenuItem;
  onAdd: (item: { id: string; name: string; price: number }, extras?: Extra[]) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const components = item.components ?? [];
  const [qtys, setQtys] = useState<number[]>(() => components.map(() => 0));

  function handleAdd() {
    const extras: Extra[] = components
      .map((c, i) => ({ name: c.name, price: c.price, qty: qtys[i] }))
      .filter(e => e.qty > 0);
    onAdd(item, extras.length > 0 ? extras : undefined);
    setQtys(components.map(() => 0));
    setOpen(false);
  }

  const extrasTotal = components.reduce((s, c, i) => s + c.price * qtys[i], 0);

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-base">{item.name}</h3>
              <p className="text-sm text-muted-foreground">{formatFCFA(item.price)} — choisissez vos suppléments</p>
            </div>
            <div className="space-y-3">
              {components.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFCFA(c.price)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setQtys(prev => prev.map((q, j) => j === i ? Math.max(0, q - 1) : q))}
                      className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-sm font-bold">{qtys[i]}</span>
                    <button
                      onClick={() => setQtys(prev => prev.map((q, j) => j === i ? q + 1 : q))}
                      className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-bold text-primary">{formatFCFA(item.price + extrasTotal)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
                <Button size="sm" onClick={handleAdd}>Ajouter au panier</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ——————————————————————————————————————————————
// Sub-components
// ——————————————————————————————————————————————
function StatCard({ label, value, icon, accent }: {
  label: string; value: string; icon: ReactNode; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 space-y-1 ${accent ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}>
      <div className={accent ? "text-primary-foreground/80" : "text-muted-foreground"}>{icon}</div>
      <p className="font-bold text-lg leading-tight">{value}</p>
      <p className={`text-xs ${accent ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}

function RecentOrderRow({ order, onCommander, onSuivi }: {
  order: OrderRow; onCommander: () => void; onSuivi: () => void;
}) {
  const items = order.items ?? [];
  const active = !["delivered", "cancelled"].includes(order.status);
  const summary = items.slice(0, 2).map(i => i.name).join(", ") + (items.length > 2 ? ` +${items.length - 2}` : "");

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center text-xl shrink-0 select-none">
        {items[0] ? "🍽️" : "📦"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{summary || "Commande"}</p>
        <Badge variant="outline" className={`text-xs mt-0.5 ${STATUS_COLOR[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </Badge>
      </div>
      <div className="flex flex-col gap-1 items-end shrink-0">
        <span className="text-sm font-bold">{formatFCFA(Number(order.total))}</span>
        {active
          ? <button onClick={onSuivi} className="text-xs text-primary hover:underline">Suivre</button>
          : <button onClick={onCommander} className="text-xs text-muted-foreground hover:text-primary hover:underline">Recommander</button>
        }
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————
// DeliveryTrackingWidget
// Shown on dashboard when a courier is picking up / delivering the order.
// Matches the dark-card style of the reference images.
// ——————————————————————————————————————————————
function DeliveryTrackingWidget({ order, markers, onSuivi }: {
  order: OrderRow;
  markers: MapMarker[];
  onSuivi: () => void;
}) {
  const progress = statusProgress(order.status);
  const items = order.items ?? [];
  const firstItem = items[0]?.name ?? "Commande";
  const shortAddress = order.dropoff_address?.split(",")[0] ?? "Livraison";
  const isPickedUp = order.status === "picked_up";

  // Estimated ETA (rough simulation based on progress remaining)
  const etaMin = Math.max(2, Math.round(((100 - progress) / 100) * 25));

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* ── Card 1 : Livreur en route ── */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "#141414" }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white font-bold text-xl leading-tight">
              {isPickedUp ? "Livreur en chemin" : "En livraison 🛵"}
            </p>
            <p className="text-gray-400 text-sm mt-0.5">~{etaMin} min</p>
          </div>
          <div
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray-200 shrink-0"
            style={{ background: "#2a2a2a" }}
          >
            🛵 RH
          </div>
        </div>

        {/* Animated progress bar with vehicle */}
        <div className="relative h-12 select-none">
          {/* Track background */}
          <div className="absolute inset-y-3 left-0 right-0 rounded-full" style={{ background: "#2a2a2a" }} />
          {/* Neon filled track */}
          <div
            className="absolute inset-y-3 left-0 rounded-full transition-all duration-1000 ease-in-out"
            style={{
              width: `${Math.max(progress, 8)}%`,
              background: "oklch(0.68 0.19 38)",
              boxShadow: "0 0 14px oklch(0.68 0.19 38 / 0.7)",
            }}
          />
          {/* Vehicle icon */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-in-out"
            style={{ left: `calc(${Math.max(progress, 8)}% - 20px)` }}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-lg shadow-lg"
              style={{ background: "#ffffff" }}
            >
              🛵
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onSuivi}
            className="flex-1 rounded-xl py-3 text-sm font-medium text-white transition-colors"
            style={{ background: "#2a2a2a" }}
            onMouseOver={e => (e.currentTarget.style.background = "#333")}
            onMouseOut={e => (e.currentTarget.style.background = "#2a2a2a")}
          >
            Détails
          </button>
          <button
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
            style={{ background: "oklch(0.68 0.19 38)" }}
            title="Appeler le livreur (fonctionnalité à venir)"
          >
            <Phone className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* ── Card 2 : Mini carte ── */}
      <div className="rounded-2xl p-5 space-y-3 flex flex-col" style={{ background: "#141414" }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white font-bold text-xl leading-tight">Votre commande</p>
            <p className="text-gray-400 text-sm mt-0.5">~{etaMin} min</p>
          </div>
          <div
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray-200 flex items-center gap-1 shrink-0 max-w-[120px] truncate"
            style={{ background: "#2a2a2a" }}
          >
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{shortAddress}</span>
          </div>
        </div>

        {/* Mini map */}
        <div className="flex-1 min-h-28 rounded-xl overflow-hidden relative" style={{ background: "#0d1117" }}>
          {markers.length > 0 ? (
            <MapView markers={markers} fitToMarkers className="absolute inset-0" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
              📍 Localisation…
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onSuivi}
            className="flex-1 rounded-xl py-3 text-sm font-medium text-white transition-colors"
            style={{ background: "#2a2a2a" }}
            onMouseOver={e => (e.currentTarget.style.background = "#333")}
            onMouseOut={e => (e.currentTarget.style.background = "#2a2a2a")}
          >
            Voir le suivi
          </button>
          <button
            onClick={onSuivi}
            className="h-12 w-12 rounded-xl flex items-center justify-center text-xl shrink-0 transition-opacity hover:opacity-80"
            style={{ background: "oklch(0.68 0.19 38)" }}
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
