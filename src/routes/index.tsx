import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Crown, Star, MapPin, Clock, Phone, Mail,
  ChefHat, Facebook, Instagram, Twitter, Play, ShoppingBag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { APP_NAME, ROYAL_HOUSE_ID, formatFCFA } from "@/lib/orders";

// ── Open-source imagery (Unsplash) ───────────────────────────────────────────
const U = "https://images.unsplash.com/photo-";
const IMG = {
  heroFloat1: `${U}1565299624946-b28f40a0ae38?auto=format&fit=crop&w=320&q=80`,
  heroFloat2: `${U}1555939594-58d7cb561ad1?auto=format&fit=crop&w=280&q=80`,
  feature:    `${U}1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80`,
  gallery: [
    `${U}1482049016688-2d3e1b311543?auto=format&fit=crop&w=800&q=80`,
    `${U}1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=400&q=80`,
    `${U}1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80`,
    `${U}1540189549336-e6e99f3cc1d3?auto=format&fit=crop&w=400&q=80`,
  ],
  ctaFloat1: `${U}1565299624946-b28f40a0ae38?auto=format&fit=crop&w=240&q=80`,
  ctaFloat2: `${U}1555939594-58d7cb561ad1?auto=format&fit=crop&w=240&q=80`,
};

const TESTIMONIALS = [
  { name: "Aminata Nguemdjeu", handle: "@aminata_y",   rating: 5, color: "bg-amber-50  border-amber-100",  text: "Chaque plat est une expérience divine. J'ai commandé le Ndolé trois fois en une semaine — je ne m'en lasse pas !" },
  { name: "Kevin Mbarga",      handle: "@kev_mba",     rating: 4, color: "bg-pink-50   border-pink-100",   text: "Livraison ultra rapide et le Poulet DG était encore chaud à l'arrivée. Royal House, c'est sérieux." },
  { name: "Sophie Atangana",   handle: "@sophieyaound", rating: 5, color: "bg-purple-50 border-purple-100", text: "L'appli est super fluide, le suivi en direct c'est génial. Je recommande à tous mes amis !" },
  { name: "Patrick Essomba",   handle: "@pat_essomba", rating: 4, color: "bg-blue-50   border-blue-100",   text: "Bonne qualité, bons prix. Le poisson braisé était excellent. Continuez comme ça !" },
];

type MenuItem = {
  id: string; name: string; price: number;
  description: string | null; category: string;
  image_url: string | null;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — Commande & livraison en temps réel` },
      { name: "description", content: `Commandez chez ${APP_NAME}, payez en ligne et suivez votre livreur en direct sur la carte.` },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, role, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    const dest = role === "restaurant" ? "/admin" : role === "courier" ? "/courier" : "/client";
    navigate({ to: dest as any, replace: true });
  }, [user, role, loading, navigate]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden font-sans">
      <LandingNav />
      <main>
        <HeroSection />
        <SignatureDishesSection />
        <GallerySection />
        <TestimonialsSection />
        <CtaBannerSection />
      </main>
      <LandingFooter />
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: "Accueil",   href: "#accueil" },
  { label: "Menu",      href: "#menu" },
  { label: "Avis",      href: "#avis" },
  { label: "Contact",   href: "#contact" },
];

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/90 backdrop-blur-xl shadow-sm border-b" : "bg-transparent"}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <span className="h-8 w-8 grid place-items-center rounded-xl bg-primary text-primary-foreground">
            <Crown className="h-4 w-4" />
          </span>
          <span>{APP_NAME}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(l => (
            <a key={l.label} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        <Link to="/auth">
          <button className="flex items-center gap-2 bg-foreground text-background rounded-full px-4 py-2 text-sm font-semibold hover:opacity-80 transition-opacity">
            <ShoppingBag className="h-3.5 w-3.5" />
            Commander
          </button>
        </Link>
      </div>
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section id="accueil" className="relative pt-10 sm:pt-16 pb-0 overflow-hidden">
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        {/* Floating food photos */}
        <div className="absolute left-0 sm:-left-8 top-6 hidden lg:block pointer-events-none select-none">
          <img
            src={IMG.heroFloat1}
            alt=""
            className="w-36 h-36 object-cover rounded-[1.75rem] shadow-2xl rotate-[-8deg]"
          />
        </div>
        <div className="absolute right-0 sm:-right-8 top-2 hidden lg:block pointer-events-none select-none">
          <img
            src={IMG.heroFloat2}
            alt=""
            className="w-32 h-40 object-cover rounded-[1.75rem] shadow-2xl rotate-[7deg]"
          />
        </div>

        {/* Icon */}
        <div className="inline-flex items-center justify-center mb-5">
          <ChefHat className="h-9 w-9 text-primary" strokeWidth={1.5} />
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08]">
          Savourez le goût<br />
          <span className="text-primary">de la perfection.</span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
          Ingrédients frais, recettes savoureuses et passion pour la bonne cuisine — livrés à Yaoundé.
        </p>

        <div className="mt-8">
          <Link to="/auth">
            <button className="inline-flex items-center gap-2.5 bg-primary text-primary-foreground rounded-full px-8 py-3.5 text-base font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
              Commander maintenant
              <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </div>

      {/* Feature image with play overlay */}
      <div className="mt-12 mx-auto max-w-5xl px-4">
        <div className="relative rounded-[2rem] overflow-hidden shadow-2xl">
          <img
            src={IMG.feature}
            alt="Plats Royal House"
            className="w-full h-64 sm:h-96 object-cover"
          />
          <div className="absolute inset-0 bg-black/10" />
          <a
            href="#menu"
            className="absolute inset-0 flex items-center justify-center group"
            aria-label="Voir le menu"
          >
            <div className="h-16 w-16 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-200">
              <Play className="h-6 w-6 fill-foreground text-foreground ml-1" />
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Signature Dishes (fetched from DB) ───────────────────────────────────────
function SignatureDishesSection() {
  const [activeCategory, setActiveCategory] = useState("Tous");

  const { data: items = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["landing-menu"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, price, description, category, image_url")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .eq("available", true)
        .order("sort_order")
        .limit(18);
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
  });

  const categories = ["Tous", ...Array.from(new Set(items.map(i => i.category))).sort()];
  const filtered = activeCategory === "Tous" ? items : items.filter(i => i.category === activeCategory);

  return (
    <section id="menu" className="py-20 sm:py-24 px-4">
      <div className="mx-auto max-w-6xl">
        {/* Heading */}
        <div className="text-center mb-10">
          <span className="text-3xl block mb-3">✨</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Nos Plats Signatures</h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Des classiques aux créations culinaires modernes, notre menu est conçu pour séduire vos papilles. Chaque plat est préparé avec les meilleurs ingrédients.
          </p>
        </div>

        {/* Category pills */}
        {!isLoading && categories.length > 1 && (
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  activeCategory === cat
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:border-foreground/40 bg-background"
                }`}
              >
                {cat === "Tous" ? `Tout le menu` : cat}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border animate-pulse h-60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-5xl mb-3">🍽️</p>
            <p className="font-medium">Aucun plat dans cette catégorie.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filtered.slice(0, 9).map(item => (
              <div key={item.id} className="group rounded-2xl border bg-card overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <div className="h-44 bg-muted overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl select-none">🍽️</div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-semibold text-sm leading-tight">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-primary font-bold text-sm">{formatFCFA(item.price)}</span>
                    <Link to="/auth">
                      <button className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity">
                        Ajouter
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* See all CTA */}
        {!isLoading && filtered.length > 9 && (
          <div className="text-center mt-10">
            <Link to="/auth">
              <button className="inline-flex items-center gap-2 border border-foreground rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-foreground hover:text-background transition-colors">
                Voir tout le menu <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Gallery ───────────────────────────────────────────────────────────────────
function GallerySection() {
  return (
    <section className="py-20 sm:py-24 px-4 border-y bg-card">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-10">
          <ChefHat className="h-9 w-9 text-primary mx-auto mb-3" strokeWidth={1.5} />
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Un festin pour les yeux</h2>
        </div>

        {/* Mosaic */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ height: "22rem" }}>
          <div className="col-span-2 rounded-2xl overflow-hidden">
            <img src={IMG.gallery[0]} alt="Plat signature" className="w-full h-full object-cover" />
          </div>
          <div className="rounded-2xl overflow-hidden">
            <img src={IMG.gallery[1]} alt="Dessert" className="w-full h-full object-cover" />
          </div>
          <div className="grid grid-rows-2 gap-3">
            <div className="rounded-2xl overflow-hidden">
              <img src={IMG.gallery[2]} alt="Salade fraîche" className="w-full h-full object-cover" />
            </div>
            <div className="rounded-2xl overflow-hidden">
              <img src={IMG.gallery[3]} alt="Plat du jour" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────────
function TestimonialsSection() {
  return (
    <section id="avis" className="py-20 sm:py-24 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <span className="text-xl">❤️</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Ils nous adorent</h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            De l'entrée au dessert, notre menu ravit les papilles. Chaque plat est préparé avec les ingrédients les plus frais et une extra dose d'amour.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className={`rounded-2xl border p-5 space-y-3 ${t.color}`}>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className={`h-3.5 w-3.5 ${s < t.rating ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"}`} />
                ))}
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">"{t.text}"</p>
              <div className="flex items-center gap-2.5 pt-1 border-t border-black/5">
                <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {t.name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.handle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA Banner ────────────────────────────────────────────────────────────────
function CtaBannerSection() {
  return (
    <section className="py-10 sm:py-16 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="relative rounded-3xl overflow-hidden bg-foreground text-background px-6 py-14 text-center">
          {/* Floating images */}
          <div className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 hidden sm:block pointer-events-none select-none">
            <img src={IMG.ctaFloat1} alt="" className="w-24 h-24 object-cover rounded-2xl rotate-[-6deg] opacity-80" />
          </div>
          <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 hidden sm:block pointer-events-none select-none">
            <img src={IMG.ctaFloat2} alt="" className="w-24 h-24 object-cover rounded-2xl rotate-[6deg] opacity-80" />
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 mb-4 opacity-60 text-sm">
              <Crown className="h-4 w-4" />
              {APP_NAME}
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ne tardez pas — Commandez&nbsp;!
            </h2>
            <p className="mt-3 text-sm opacity-60 max-w-xs mx-auto">
              Ingrédients frais, recettes savoureuses et livraison rapide à Yaoundé.
            </p>
            <div className="mt-7">
              <Link to="/auth">
                <button className="inline-flex items-center gap-2.5 bg-primary text-primary-foreground rounded-full px-8 py-3.5 text-base font-bold hover:opacity-90 transition-opacity shadow-xl shadow-primary/30">
                  Commander maintenant
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer id="contact" className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <p className="font-semibold mb-4">Naviguer</p>
            <ul className="space-y-2.5 text-muted-foreground">
              {["Accueil", "Menu", "À propos", "Contact"].map(l => (
                <li key={l}><a href="#" className="hover:text-foreground transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-4">Menu</p>
            <ul className="space-y-2.5 text-muted-foreground">
              {["Ndolé", "Poulet DG", "Poisson Braisé", "Eru", "Koki"].map(l => (
                <li key={l}>
                  <Link to="/auth" className="hover:text-foreground transition-colors">{l}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-4">Suivez-nous</p>
            <ul className="space-y-2.5 text-muted-foreground">
              {[
                { label: "Facebook",  Icon: Facebook },
                { label: "Instagram", Icon: Instagram },
                { label: "Twitter",   Icon: Twitter },
              ].map(({ label, Icon }) => (
                <li key={label}>
                  <a href="#" className="flex items-center gap-2 hover:text-foreground transition-colors">
                    <Icon className="h-3.5 w-3.5" />{label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-4">Contact</p>
            <ul className="space-y-2.5 text-muted-foreground text-xs">
              <li className="flex items-start gap-2">
                <Phone className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>+237 6XX XXX XXX</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Yaoundé, Cameroun</span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>contact@royalhouse.cm</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Lun – Dim · 7h – 22h</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© 2026 {APP_NAME}. Tous droits réservés.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground transition-colors">Mentions légales</a>
            <a href="#" className="hover:text-foreground transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-foreground transition-colors">Style Guide</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
