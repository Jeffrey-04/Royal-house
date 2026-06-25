import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode } from "react";
import { LogOut, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, type AppRole } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_NAME } from "@/lib/orders";

const roleLabel: Record<AppRole, string> = {
  client: "Espace Client",
  restaurant: "Espace Restaurant",
  courier: "Espace Livreur",
};

const roleHome: Record<AppRole, string> = {
  client: "/client",
  restaurant: "/admin",
  courier: "/courier",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, loading } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to={role ? (roleHome[role] as any) : "/"} className="flex items-center gap-2 font-bold text-lg">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Crown className="h-5 w-5" />
            </span>
            <span>{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-2">
            {role && <Badge variant="secondary" className="hidden sm:inline-flex">{roleLabel[role]}</Badge>}
            {user ? (
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            ) : !loading && pathname !== "/auth" ? (
              <Button asChild size="sm">
                <Link to="/auth">Connexion</Link>
              </Button>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
