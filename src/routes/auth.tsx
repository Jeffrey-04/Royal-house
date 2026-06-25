import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChefHat, Bike, ShoppingBag, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, type AppRole } from "@/lib/use-session";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_NAME } from "@/lib/orders";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `Connexion — ${APP_NAME}` },
      { name: "description", content: "Connectez-vous ou créez un compte client, restaurant ou livreur." },
    ],
  }),
  component: AuthPage,
  ssr: false,
});

const roleOptions: { value: AppRole; label: string; Icon: typeof ShoppingBag }[] = [
  { value: "client", label: "Client", Icon: ShoppingBag },
  { value: "restaurant", label: "Restaurant", Icon: ChefHat },
  { value: "courier", label: "Livreur", Icon: Bike },
];

function AuthPage() {
  const navigate = useNavigate();
  const { user, role, loading } = useSession();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("client");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Wait until role is resolved — null means still loading or unassigned
    if (loading || !user || !role) return;
    const dest = role === "restaurant" ? "/admin" : role === "courier" ? "/courier" : "/client";
    navigate({ to: dest as any, replace: true });
  }, [user, role, loading, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      if (error) throw error;
      // Auto-confirm activé : on a directement une session. Sinon on se connecte tout de suite.
      if (!data.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
      }
      const { error: roleErr } = await supabase.rpc("assign_signup_role", { _role: selectedRole });
      if (roleErr && !/already assigned/i.test(roleErr.message)) throw roleErr;
      toast.success(`Bienvenue ${fullName.split(" ")[0] || ""} !`);
      // Navigate explicitly — onAuthStateChange won't re-fire after role assignment
      const dest = selectedRole === "restaurant" ? "/admin" : selectedRole === "courier" ? "/courier" : "/client";
      navigate({ to: dest as any, replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Erreur lors de l'inscription");
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).limit(1);
        if (!roles || roles.length === 0) {
          await supabase.rpc("assign_signup_role", { _role: "client" });
        }
      }
      toast.success("Bienvenue !");
    } catch (err: any) {
      toast.error(err.message ?? "Identifiants invalides");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="flex-1 grid place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="h-5 w-5 text-primary" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">{APP_NAME}</span>
          </div>
          <h1 className="text-2xl font-bold">Bienvenue</h1>
          <p className="text-sm text-muted-foreground mt-1">Connectez-vous ou créez un compte.</p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-in">Email</Label>
                  <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwd-in">Mot de passe</Label>
                  <Input id="pwd-in" type="password" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Connexion..." : "Se connecter"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name-up">Nom</Label>
                  <Input id="name-up" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Marie Dupont" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwd-up">Mot de passe</Label>
                  <Input id="pwd-up" type="password" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Je suis</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {roleOptions.map(({ value, label, Icon }) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setSelectedRole(value)}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-xs font-medium transition ${
                          selectedRole === value
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Création..." : "Créer mon compte"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}
