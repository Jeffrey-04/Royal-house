import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, MapPin, Timer, ChefHat, Bike, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/lib/use-session";
import { APP_NAME } from "@/lib/orders";

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
    <AppShell>
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at top, oklch(0.85 0.12 50) 0%, transparent 50%), radial-gradient(ellipse at bottom right, oklch(0.85 0.1 30) 0%, transparent 50%)",
          }}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <Crown className="h-3.5 w-3.5" />
              {APP_NAME} · Yaoundé · Suivi GPS en direct
            </span>
            <h1 className="mt-6 text-5xl sm:text-7xl font-extrabold tracking-tight">
              La table royale,<br />
              <span className="bg-gradient-to-r from-primary to-destructive bg-clip-text text-transparent">
                livrée à Yaoundé.
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl">
              Commandez nos plats signatures (Ndolé, Poulet DG, Poisson Braisé…), payez via MoMo, Orange Money ou carte, et suivez votre livreur en temps réel sur la carte.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="text-base">
                <Link to="/auth">
                  Commencer maintenant
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-20 grid gap-4 sm:grid-cols-3">
            {[
              { Icon: MapPin, title: "Client", desc: "Parcourez le menu, payez, suivez votre livreur en temps réel jusqu'à votre porte." },
              { Icon: ChefHat, title: "Restaurant", desc: "Gérez votre menu, recevez les commandes et suivez les livraisons sur une carte unique." },
              { Icon: Bike, title: "Livreur", desc: "Récupérez les commandes prêtes et partagez votre position automatiquement." },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="group rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-glow)]">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-semibold text-lg">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 flex items-center gap-3 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            Mises à jour en direct via WebSocket — pas besoin de rafraîchir.
          </div>
        </div>
      </section>
    </AppShell>
  );
}
