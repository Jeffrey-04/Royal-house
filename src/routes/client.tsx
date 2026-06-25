import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, UtensilsCrossed, ShoppingBag, MapPin, Gift,
  Bell, CreditCard, User, Search, Crown, LogOut, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { Input } from "@/components/ui/input";
import type { CartItem, Extra } from "@/lib/orders";
import { SectionAccueil, SectionCommander } from "./-client-sections-a";
import { SectionCommandes, SectionSuivi } from "./-client-sections-b";
import { SectionNotifications, SectionRecompenses, SectionProfil, SectionPaiements } from "./-client-sections-c";

export type ClientSection =
  | "accueil" | "commander" | "commandes" | "suivi"
  | "recompenses" | "notifications" | "paiements" | "profil";

export const Route = createFileRoute("/client")({
  head: () => ({ meta: [{ title: "Royal House — Espace Client" }] }),
  component: ClientPage,
  ssr: false,
});

// ——————————————————————————————————————————————
// Root
// ——————————————————————————————————————————————
function ClientPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [section, setSection] = useState<ClientSection>("accueil");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  // True once we've verified/refreshed the JWT — gates all queries to prevent 403 on expired tokens.
  const [sessionReady, setSessionReady] = useState(false);
  // Prevent double-invocation in React StrictMode (dev) and avoid rate-limiting (429).
  const refreshAttempted = useRef(false);

  useEffect(() => {
    if (!user || refreshAttempted.current) return;
    refreshAttempted.current = true;

    supabase.auth.refreshSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        // Don't call signOut() — it also hits the server and gets 403 when the
        // token is already invalid. Instead wipe supabase auth keys directly.
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

  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    enabled: !!user && sessionReady,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user!.id)
        .single();
      return data;
    },
  });

  const { data: notifCount = 0 } = useQuery({
    queryKey: ["client-notif-count", user?.id],
    enabled: !!user && sessionReady,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("client_id", user!.id)
        .not("status", "in", "(delivered,cancelled)");
      return count ?? 0;
    },
  });

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

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function addToCart(item: { id: string; name: string; price: number }, extras?: Extra[]) {
    setCart(prev => {
      const hasExtras = extras && extras.length > 0;
      if (!hasExtras) {
        // Pas de suppléments : incrémenter la quantité si déjà présent
        const ex = prev.find(c => c.id === item.id && !c.extras?.length);
        if (ex) return prev.map(c => c === ex ? { ...c, qty: c.qty + 1 } : c);
        return [...prev, { ...item, qty: 1 }];
      }
      // Avec suppléments : toujours ajouter une nouvelle ligne
      return [...prev, { ...item, qty: 1, extras }];
    });
  }

  const goSection = (s: ClientSection) => { setSection(s); setSearch(""); };

  const cartProps = {
    cart,
    addToCart,
    updateQty: (id: string, delta: number) =>
      setCart(prev => prev.map(c => c.id === id ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0)),
    removeFromCart: (id: string) => setCart(p => p.filter(c => c.id !== id)),
    clearCart: () => setCart([]),
  };

  const TITLES: Record<ClientSection, string> = {
    accueil: "Tableau de bord", commander: "Commander", commandes: "Mes commandes",
    suivi: "Suivi en direct", recompenses: "Récompenses", notifications: "Notifications",
    paiements: "Paiements", profil: "Mon profil",
  };

  const handleSignOut = () => {
    // Wipe auth storage directly — avoids hitting /auth/v1/logout which returns
    // 403 when the token is already invalid, causing an unclearable loop.
    Object.keys(localStorage)
      .filter(k => k.startsWith("sb-") && k.includes("auth"))
      .forEach(k => localStorage.removeItem(k));
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ClientSidebar section={section} setSection={goSection} notifCount={notifCount} onSignOut={handleSignOut} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ClientHeader
          title={TITLES[section]}
          profile={profile}
          userEmail={user.email}
          notifCount={notifCount}
          cartCount={cartCount}
          search={search}
          setSearch={(v) => { setSearch(v); if (section !== "commander") setSection("commander"); }}
          onNotif={() => goSection("notifications")}
          onCart={() => goSection("commander")}
        />
        <main className={`flex-1 ${section === "suivi" ? "overflow-hidden" : "overflow-y-auto"} pb-24 md:pb-0`}>
          {!sessionReady ? (
            <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Vérification de la session…</span>
            </div>
          ) : (
            <>
              {section === "accueil" && (
                <SectionAccueil userId={user.id} profile={profile} {...cartProps}
                  onCommander={() => goSection("commander")}
                  onSuivi={() => goSection("suivi")}
                  onCommandes={() => goSection("commandes")}
                />
              )}
              {section === "commander" && (
                <SectionCommander userId={user.id} search={search} setSearch={setSearch} {...cartProps}
                  onCheckout={() => goSection("commandes")}
                />
              )}
              {section === "commandes" && <SectionCommandes userId={user.id} onSuivi={() => goSection("suivi")} />}
              {section === "suivi" && <SectionSuivi userId={user.id} />}
              {section === "recompenses" && <SectionRecompenses userId={user.id} />}
              {section === "notifications" && <SectionNotifications userId={user.id} />}
              {section === "paiements" && <SectionPaiements userId={user.id} />}
              {section === "profil" && <SectionProfil user={user} profile={profile} onSignOut={handleSignOut} onPaiements={() => goSection("paiements")} onSuivi={() => goSection("suivi")} />}
            </>
          )}
        </main>
        <ClientBottomNav section={section} setSection={goSection} />
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————
// Bottom navbar (mobile)
// ——————————————————————————————————————————————
const BOTTOM_NAV_CLIENT: Array<{ id: ClientSection; icon: LucideIcon; label: string }> = [
  { id: "accueil",   icon: LayoutDashboard, label: "Accueil" },
  { id: "commander", icon: UtensilsCrossed, label: "Menu" },
  { id: "commandes", icon: ShoppingBag,     label: "Commandes" },
  { id: "recompenses", icon: Gift,           label: "Récompenses" },
  { id: "profil",    icon: User,            label: "Profil" },
];

function ClientBottomNav({ section, setSection }: {
  section: ClientSection;
  setSection: (s: ClientSection) => void;
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
      {BOTTOM_NAV_CLIENT.map(item => {
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

// ——————————————————————————————————————————————
// Sidebar
// ——————————————————————————————————————————————
const NAV_TOP: Array<{ id: ClientSection; icon: LucideIcon; label: string }> = [
  { id: "accueil",     icon: LayoutDashboard, label: "Accueil" },
  { id: "commander",   icon: UtensilsCrossed, label: "Commander" },
  { id: "commandes",   icon: ShoppingBag,     label: "Commandes" },
  { id: "suivi",       icon: MapPin,          label: "Suivi" },
  { id: "recompenses", icon: Gift,            label: "Récompenses" },
];
const NAV_BOTTOM: Array<{ id: ClientSection; icon: LucideIcon; label: string }> = [
  { id: "notifications", icon: Bell,       label: "Notifications" },
  { id: "paiements",     icon: CreditCard, label: "Paiements" },
  { id: "profil",        icon: User,       label: "Mon profil" },
];

function ClientSidebar({ section, setSection, notifCount, onSignOut }: {
  section: ClientSection;
  setSection: (s: ClientSection) => void;
  notifCount: number;
  onSignOut: () => void;
}) {
  return (
    <aside className="w-16 hidden md:flex flex-col items-center py-4 border-r bg-card shrink-0">
      <div className="mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
          <Crown className="h-5 w-5 text-primary-foreground" />
        </div>
      </div>
      <nav className="flex flex-col items-center gap-1 flex-1">
        {NAV_TOP.map(item => (
          <SideNavBtn key={item.id} active={section === item.id} label={item.label} onClick={() => setSection(item.id)}>
            <item.icon className="h-5 w-5" />
          </SideNavBtn>
        ))}
      </nav>
      <nav className="flex flex-col items-center gap-1 mt-auto">
        {NAV_BOTTOM.map(item => (
          <SideNavBtn
            key={item.id}
            active={section === item.id}
            label={item.label}
            onClick={() => setSection(item.id)}
            badge={item.id === "notifications" ? notifCount : 0}
          >
            <item.icon className="h-5 w-5" />
          </SideNavBtn>
        ))}
        <button
          onClick={onSignOut}
          title="Déconnexion"
          className="mt-2 w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </nav>
    </aside>
  );
}

function SideNavBtn({ active, label, onClick, children, badge = 0 }: {
  active: boolean; label: string; onClick: () => void; children: ReactNode; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all
        ${active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
    >
      {children}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

// ——————————————————————————————————————————————
// Header
// ——————————————————————————————————————————————
function ClientHeader({ title, profile, userEmail, notifCount, cartCount, search, setSearch, onNotif, onCart }: {
  title: string;
  profile: { full_name: string | null } | null | undefined;
  userEmail: string | undefined;
  notifCount: number;
  cartCount: number;
  search: string;
  setSearch: (v: string) => void;
  onNotif: () => void;
  onCart: () => void;
}) {
  const name = profile?.full_name || userEmail?.split("@")[0] || "Client";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <header className="h-16 flex items-center gap-4 px-5 border-b bg-card shrink-0">
      <h1 className="text-lg font-bold shrink-0 truncate md:w-40">{title}</h1>

      {/* Search — desktop only */}
      <div className="hidden md:flex flex-1 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un plat…"
          className="pl-9 h-9 bg-background"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Bell */}
        <button
          onClick={onNotif}
          className="relative h-9 w-9 rounded-lg border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bell className="h-4 w-4" />
          {notifCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
          )}
        </button>

        {/* Cart */}
        {cartCount > 0 && (
          <button
            onClick={onCart}
            className="relative h-9 w-9 rounded-lg border bg-background flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {cartCount}
            </span>
          </button>
        )}

        {/* User — desktop only */}
        <div className="hidden md:flex items-center gap-2 pl-2 border-l ml-1">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight truncate max-w-[120px]">{name}</p>
            <p className="text-xs text-muted-foreground leading-tight">Espace Client</p>
          </div>
        </div>
      </div>
    </header>
  );
}
