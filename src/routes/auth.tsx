import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bike, ShoppingBag, Crown, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, type AppRole } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_NAME } from "@/lib/orders";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `Connexion — ${APP_NAME}` },
      { name: "description", content: "Connectez-vous ou créez un compte client ou livreur." },
    ],
  }),
  component: AuthPage,
  ssr: false,
});

type View = "signin" | "signup" | "forgot" | "forgot-sent" | "reset";

const roleOptions: { value: AppRole; label: string; Icon: typeof ShoppingBag }[] = [
  { value: "client",  label: "Client",  Icon: ShoppingBag },
  { value: "courier", label: "Livreur", Icon: Bike },
];

function AuthPage() {
  const navigate = useNavigate();
  const { user, role, loading } = useSession();
  const [tab, setTab]               = useState<"signin" | "signup">("signin");
  const [view, setView]             = useState<View>("signin");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [fullName, setFullName]     = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("client");
  const [busy, setBusy]             = useState(false);
  const [showPwd, setShowPwd]       = useState(false);

  // Redirect when already logged-in
  useEffect(() => {
    if (loading || !user || !role) return;
    const dest = role === "restaurant" ? "/admin" : role === "courier" ? "/courier" : "/client";
    navigate({ to: dest as any, replace: true });
  }, [user, role, loading, navigate]);

  // Catch Supabase PASSWORD_RECOVERY event (user clicked email link)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setView("reset");
    });
    return () => subscription.unsubscribe();
  }, []);

  function switchTab(v: string) {
    setTab(v as "signin" | "signup");
    setView(v as View);
    setShowPwd(false);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
      });
      if (error) throw error;
      if (!data.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
      }
      const { error: roleErr } = await supabase.rpc("assign_signup_role", { _role: selectedRole });
      if (roleErr && !/already assigned/i.test(roleErr.message)) throw roleErr;
      toast.success(`Bienvenue ${fullName.split(" ")[0] || ""} !`);
      const dest = selectedRole === "courier" ? "/courier" : "/client";
      navigate({ to: dest as any, replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Erreur lors de l'inscription");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setView("forgot-sent");
    } catch (err: any) {
      toast.error(err.message ?? "Erreur lors de l'envoi");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe mis à jour !");
      setPassword("");
      setView("signin");
      setTab("signin");
    } catch (err: any) {
      toast.error(err.message ?? "Erreur lors de la mise à jour");
    } finally {
      setBusy(false);
    }
  };

  // ── Password field with show/hide toggle ──────────────────────────────────
  const PwdToggle = (
    <button
      type="button"
      onClick={() => setShowPwd(p => !p)}
      tabIndex={-1}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
    >
      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 grid place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-[var(--shadow-card)]">

          {/* Brand */}
          <div className="flex items-center gap-2 mb-1">
            <Crown className="h-5 w-5 text-primary" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">{APP_NAME}</span>
          </div>

          {/* ── View: Forgot password ── */}
          {view === "forgot" && (
            <>
              <button
                onClick={() => setView("signin")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Retour
              </button>
              <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Entrez votre email — nous vous enverrons un lien de réinitialisation.
              </p>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-forgot">Email</Label>
                  <Input
                    id="email-forgot"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Envoi…" : "Envoyer le lien"}
                </Button>
              </form>
            </>
          )}

          {/* ── View: Link sent ── */}
          {view === "forgot-sent" && (
            <>
              <div className="text-4xl mb-4">📬</div>
              <h1 className="text-2xl font-bold">Email envoyé</h1>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.
                Vérifiez votre boîte mail (et vos spams).
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setView("signin"); setTab("signin"); }}
              >
                Retour à la connexion
              </Button>
            </>
          )}

          {/* ── View: Reset password (after clicking email link) ── */}
          {view === "reset" && (
            <>
              <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Choisissez un nouveau mot de passe pour votre compte.
              </p>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pwd-reset">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="pwd-reset"
                      type={showPwd ? "text" : "password"}
                      required
                      minLength={6}
                      autoFocus
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    {PwdToggle}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Mise à jour…" : "Mettre à jour le mot de passe"}
                </Button>
              </form>
            </>
          )}

          {/* ── View: Sign in / Sign up ── */}
          {(view === "signin" || view === "signup") && (
            <>
              <h1 className="text-2xl font-bold">Bienvenue</h1>
              <p className="text-sm text-muted-foreground mt-1">Connectez-vous ou créez un compte.</p>

              <Tabs value={tab} onValueChange={switchTab} className="mt-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Connexion</TabsTrigger>
                  <TabsTrigger value="signup">Inscription</TabsTrigger>
                </TabsList>

                {/* Sign in */}
                <TabsContent value="signin" className="mt-6">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email-in">Email</Label>
                      <Input
                        id="email-in"
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pwd-in">Mot de passe</Label>
                        <button
                          type="button"
                          onClick={() => setView("forgot")}
                          className="text-xs text-primary hover:underline"
                        >
                          Mot de passe oublié ?
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="pwd-in"
                          type={showPwd ? "text" : "password"}
                          required
                          minLength={4}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="pr-10"
                        />
                        {PwdToggle}
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy ? "Connexion…" : "Se connecter"}
                    </Button>
                  </form>
                </TabsContent>

                {/* Sign up */}
                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name-up">Nom complet</Label>
                      <Input
                        id="name-up"
                        required
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="Marie Dupont"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-up">Email</Label>
                      <Input
                        id="email-up"
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pwd-up">Mot de passe</Label>
                      <div className="relative">
                        <Input
                          id="pwd-up"
                          type={showPwd ? "text" : "password"}
                          required
                          minLength={6}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="pr-10"
                        />
                        {PwdToggle}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Je suis</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {roleOptions.map(({ value, label, Icon }) => (
                          <button
                            type="button"
                            key={value}
                            onClick={() => setSelectedRole(value)}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-sm font-medium transition-colors ${
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
                      {busy ? "Création…" : "Créer mon compte"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
