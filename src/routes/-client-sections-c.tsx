import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell, CheckCircle2, Clock, Package, Bike, ChefHat,
  Star, Gift, TrendingUp, CreditCard,
  User, Phone, Mail, LogOut, Pencil, Check, X, Receipt, Lock, Unlock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_LABEL, STATUS_COLOR, formatFCFA,
  ROYAL_HOUSE_ID, type CartItem, type OrderStatus,
} from "@/lib/orders";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import momoUrl from "@/assets/MOMO.png?url";
import omUrl   from "@/assets/OM.png?url";

// ——————————————————————————————————————————————
// Types
// ——————————————————————————————————————————————
type OrderRow = {
  id: string; status: OrderStatus; total: string | number | null;
  items: CartItem[] | null; created_at: string;
};
type ProfileRow = { full_name: string | null; phone: string | null } | null | undefined;

// ——————————————————————————————————————————————
// Helpers
// ——————————————————————————————————————————————
function getNotifMessage(status: OrderStatus): string {
  switch (status) {
    case "pending":    return "Votre commande est en attente de confirmation.";
    case "accepted":   return "Votre commande a été acceptée par le restaurant.";
    case "preparing":  return "Le restaurant prépare votre commande.";
    case "ready":      return "Votre commande est prête, en attente d'un livreur.";
    case "picked_up":  return "Un livreur a récupéré votre commande.";
    case "delivering": return "Votre commande est en route !";
    case "delivered":  return "Votre commande a été livrée. Bon appétit !";
    case "cancelled":  return "Votre commande a été annulée.";
    default:           return "Mise à jour de votre commande.";
  }
}

function getNotifIcon(status: OrderStatus) {
  switch (status) {
    case "preparing":  return <ChefHat className="h-4 w-4" />;
    case "ready":      return <Package className="h-4 w-4" />;
    case "picked_up":
    case "delivering": return <Bike className="h-4 w-4" />;
    case "delivered":  return <CheckCircle2 className="h-4 w-4" />;
    default:           return <Bell className="h-4 w-4" />;
  }
}

function getLoyaltyLevel(points: number): { label: string; color: string; next: number; emoji: string } {
  if (points >= 2500) return { label: "VIP", color: "text-primary", next: Infinity, emoji: "👑" };
  if (points >= 1000) return { label: "Or",   color: "text-warning-foreground", next: 2500, emoji: "🥇" };
  if (points >= 500)  return { label: "Argent", color: "text-muted-foreground", next: 1000, emoji: "🥈" };
  return { label: "Bronze", color: "text-amber-600", next: 500, emoji: "🥉" };
}

// ——————————————————————————————————————————————
// SectionNotifications
// ——————————————————————————————————————————————
export function SectionNotifications({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["client-notif-orders", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, total, items, created_at")
        .eq("client_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as OrderRow[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`client-notif-rt-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `client_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["client-notif-orders", userId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, queryClient]);

  const active = orders.filter(o => !["delivered", "cancelled"].includes(o.status));
  const done = orders.filter(o => ["delivered", "cancelled"].includes(o.status));

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card animate-pulse h-16" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <Bell className="h-16 w-16 opacity-20" />
        <p className="text-lg font-medium">Aucune notification</p>
        <p className="text-sm">Vous serez notifié à chaque mise à jour de commande.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold text-base flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            En cours ({active.length})
          </h2>
          {active.map(order => (
            <NotifItem key={order.id} order={order} unread />
          ))}
        </section>
      )}
      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold text-base text-muted-foreground">Précédentes</h2>
          {done.map(order => (
            <NotifItem key={order.id} order={order} unread={false} />
          ))}
        </section>
      )}
    </div>
  );
}

function NotifItem({ order, unread }: { order: OrderRow; unread: boolean }) {
  const items = (order.items ?? []) as CartItem[];
  const firstItem = items[0]?.name ?? "Commande";

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${unread ? "bg-primary/5 border-primary/20" : "bg-card"}`}>
      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5
        ${unread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
        {getNotifIcon(order.status)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{firstItem}{items.length > 1 ? ` +${items.length - 1}` : ""}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{getNotifMessage(order.status)}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {new Date(order.created_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
        </p>
      </div>
      {unread && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
    </div>
  );
}

// ——————————————————————————————————————————————
// SectionRecompenses
// ——————————————————————————————————————————————
export function SectionRecompenses({ userId }: { userId: string }) {
  const { data: orders = [] } = useQuery({
    queryKey: ["client-rewards", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, status, created_at, items")
        .eq("client_id", userId)
        .order("created_at", { ascending: false });
      return (data ?? []) as OrderRow[];
    },
  });

  const { points, totalSpent } = useMemo(() => {
    const delivered = orders.filter(o => o.status === "delivered");
    const totalSpent = delivered.reduce((s, o) => s + Number(o.total), 0);
    return { points: Math.floor(totalSpent / 100), totalSpent };
  }, [orders]);

  const level = getLoyaltyLevel(points);
  const progress = level.next === Infinity
    ? 100
    : Math.min(100, Math.round(((points - (level.label === "Or" ? 1000 : level.label === "Argent" ? 500 : 0)) /
        (level.next - (level.label === "Or" ? 1000 : level.label === "Argent" ? 500 : 0))) * 100));

  const deliveredOrders = orders.filter(o => o.status === "delivered").slice(0, 10);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Points card */}
      <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground">
        <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(ellipse at 80% 20%, white 0%, transparent 60%)" }} />
        <div className="relative z-10">
          <p className="text-primary-foreground/75 text-sm font-medium">Mes points fidélité</p>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-5xl font-extrabold">{points}</p>
            <p className="text-primary-foreground/70 mb-1">pts</p>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-2xl">{level.emoji}</span>
            <div>
              <p className="font-bold text-lg">Niveau {level.label}</p>
              {level.next !== Infinity && (
                <p className="text-primary-foreground/70 text-xs">
                  {level.next - points} pts pour le niveau suivant
                </p>
              )}
            </div>
          </div>
          {level.next !== Infinity && (
            <div className="mt-3 space-y-1">
              <div className="w-full bg-primary-foreground/20 rounded-full h-2">
                <div className="bg-primary-foreground rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-primary-foreground/70">{progress}%</p>
            </div>
          )}
        </div>
      </div>

      {/* Levels */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { emoji: "🥉", label: "Bronze", min: 0, max: 499 },
          { emoji: "🥈", label: "Argent", min: 500, max: 999 },
          { emoji: "🥇", label: "Or", min: 1000, max: 2499 },
          { emoji: "👑", label: "VIP", min: 2500, max: Infinity },
        ].map(lvl => (
          <div
            key={lvl.label}
            className={`rounded-xl border p-3 text-center transition-all
              ${points >= lvl.min ? "bg-card border-primary/30 shadow-sm" : "bg-card opacity-40"}`}
          >
            <p className="text-2xl">{lvl.emoji}</p>
            <p className="font-bold text-sm mt-1">{lvl.label}</p>
            <p className="text-xs text-muted-foreground">
              {lvl.max === Infinity ? `${lvl.min}+` : `${lvl.min}–${lvl.max}`} pts
            </p>
          </div>
        ))}
      </div>

      {/* How to earn */}
      <div className="rounded-xl border bg-accent/30 p-4 space-y-2">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />Comment gagner des points ?
        </h3>
        <p className="text-sm text-muted-foreground">
          1 point pour chaque tranche de 100 FCFA dépensée sur une commande livrée.
        </p>
        <p className="text-sm text-muted-foreground">
          Vous avez dépensé {formatFCFA(totalSpent)} au total = <strong>{points} points</strong>.
        </p>
      </div>

      {/* Points history */}
      {deliveredOrders.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-bold text-base">Historique des points</h3>
          {deliveredOrders.map(order => {
            const earned = Math.floor(Number(order.total) / 100);
            return (
              <div key={order.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Star className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Commande livrée</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">+{earned} pts</p>
                  <p className="text-xs text-muted-foreground">{formatFCFA(Number(order.total))}</p>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

// ——————————————————————————————————————————————
// Helpers paiement
// ——————————————————————————————————————————————
type PaymentRow = {
  id: string; status: OrderStatus; total: string | number | null;
  items: CartItem[] | null; created_at: string;
  payment_method: string | null; payment_status: string | null;
};

const METHOD_META: Record<string, { label: string; logo: string; color: string }> = {
  orange_money: { label: "Orange Money",    logo: omUrl,   color: "text-orange-600" },
  mtn_money:   { label: "MTN Mobile Money", logo: momoUrl, color: "text-yellow-600" },
};

// ——————————————————————————————————————————————
// SectionPaiements
// ——————————————————————————————————————————————
export function SectionPaiements({ userId }: { userId: string }) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["client-payments", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, total, items, created_at, payment_method, payment_status")
        .eq("client_id", userId)
        .not("payment_method", "is", null)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as PaymentRow[];
    },
  });

  const { totalSpent, released, held } = useMemo(() => {
    const total = orders.reduce((s, o) => s + Number(o.total), 0);
    const released = orders.filter(o => o.payment_status === "released").reduce((s, o) => s + Number(o.total), 0);
    const held = orders.filter(o => o.payment_status === "held").reduce((s, o) => s + Number(o.total), 0);
    return { totalSpent: total, released, held };
  }, [orders]);

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card animate-pulse h-16" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <CreditCard className="h-16 w-16 opacity-20" />
        <p className="text-lg font-medium">Aucun paiement</p>
        <p className="text-sm">Vos paiements Mobile Money apparaîtront ici après chaque commande.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      {/* Résumé */}
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total payé</p>
            <p className="text-2xl font-extrabold text-primary">{formatFCFA(totalSpent)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{orders.length} transaction{orders.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        {/* Libéré vs retenu */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-lg bg-green-50 border border-green-100 p-2.5 flex items-center gap-2">
            <Unlock className="h-4 w-4 text-green-600 shrink-0" />
            <div>
              <p className="text-[10px] text-green-700 font-medium">Libéré</p>
              <p className="text-xs font-bold text-green-800">{formatFCFA(released)}</p>
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5 flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <p className="text-[10px] text-amber-700 font-medium">En attente</p>
              <p className="text-xs font-bold text-amber-800">{formatFCFA(held)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des transactions */}
      <div className="space-y-2">
        {orders.map(order => {
          const items = (order.items ?? []) as CartItem[];
          const firstItem = items[0]?.name ?? "Commande";
          const method = order.payment_method ? METHOD_META[order.payment_method] : null;
          const isReleased = order.payment_status === "released";
          return (
            <div key={order.id} className="rounded-xl border bg-card px-4 py-3 space-y-2">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden
                  ${isReleased ? "bg-green-50" : "bg-amber-50"}`}>
                  {method
                    ? <img src={method.logo} alt={method.label} className="h-8 w-8 object-contain" />
                    : <CreditCard className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {firstItem}{items.length > 1 ? ` +${items.length - 1}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{formatFCFA(Number(order.total))}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t">
                {method && (
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${method.color}`}>
                    <img src={method.logo} alt={method.label} className="h-4 w-4 object-contain" />
                    {method.label}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5
                  ${isReleased
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"}`}>
                  {isReleased
                    ? <><Unlock className="h-3 w-3" />Libéré</>
                    : <><Lock className="h-3 w-3" />En attente</>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————
// SectionProfil
// ——————————————————————————————————————————————
export function SectionProfil({ user, profile, onSignOut }: {
  user: SupabaseUser;
  profile: ProfileRow;
  onSignOut: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, full_name: name.trim() || null, phone: phone.trim() || null });
    setSaving(false);
    if (error) { toast.error("Erreur lors de la sauvegarde."); return; }
    toast.success("Profil mis à jour.");
    queryClient.invalidateQueries({ queryKey: ["client-profile", user.id] });
    setEditing(false);
  }

  const displayName = profile?.full_name || user.email?.split("@")[0] || "Client";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-extrabold">
          {initials}
        </div>
        <div className="text-center">
          <p className="font-bold text-xl">{displayName}</p>
          <p className="text-sm text-muted-foreground">Client Royal House</p>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Informations personnelles</h3>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Pencil className="h-3.5 w-3.5" />Modifier
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setName(profile?.full_name ?? ""); setPhone(profile?.phone ?? ""); }}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors border">
                <X className="h-3.5 w-3.5" />
              </button>
              <button onClick={save} disabled={saving}
                className="h-7 w-7 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Email (read-only) */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />Adresse e-mail
          </label>
          <p className="text-sm bg-muted/40 rounded-lg px-3 py-2 text-muted-foreground">{user.email}</p>
        </div>

        {/* Name */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />Nom complet
          </label>
          {editing ? (
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Votre nom complet" />
          ) : (
            <p className="text-sm px-3 py-2">{profile?.full_name || <span className="text-muted-foreground italic">Non renseigné</span>}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />Téléphone
          </label>
          {editing ? (
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+237 6XX XXX XXX" type="tel" />
          ) : (
            <p className="text-sm px-3 py-2">{profile?.phone || <span className="text-muted-foreground italic">Non renseigné</span>}</p>
          )}
        </div>

        {editing && (
          <Button className="w-full" onClick={save} disabled={saving}>
            {saving ? "Sauvegarde…" : "Enregistrer les modifications"}
          </Button>
        )}
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
        <h3 className="font-semibold text-sm text-destructive">Zone sensible</h3>
        <Button variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-2" />Se déconnecter
        </Button>
      </div>
    </div>
  );
}
