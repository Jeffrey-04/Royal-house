import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { ROYAL_HOUSE_ID } from "@/lib/orders";
import { AdminShell, SectionDashboard, SectionCommandes, type Section } from "./-admin-sections-a";
import { SectionSuivi, SectionMenu, SectionHistorique } from "./-admin-sections-b";
import { SectionRapports } from "./-admin-sections-c";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Royal House" }] }),
  component: AdminPage,
  ssr: false,
});

function AdminPage() {
  const navigate = useNavigate();
  const { user, role, loading } = useSession();
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const queryClient = useQueryClient();

  // Active orders count for sidebar badge (separate key from SectionCommandes full query)
  const { data: activeOrders = [] } = useQuery({
    queryKey: ["admin-active-orders-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .not("status", "in", '("delivered","cancelled")');
      if (error) throw error;
      return data;
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth", replace: true }); return; }
    if (role !== "restaurant") { navigate({ to: "/client", replace: true }); return; }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("admin-orders-rt")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "orders",
        filter: `restaurant_id=eq.${ROYAL_HOUSE_ID}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-all-orders"] });
        queryClient.invalidateQueries({ queryKey: ["admin-active-orders"] });
        queryClient.invalidateQueries({ queryKey: ["admin-active-orders-count"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const handleLogout = () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith("sb-") && k.includes("auth"))
      .forEach(k => localStorage.removeItem(k));
    navigate({ to: "/auth", replace: true });
  };

  async function updateStatus(orderId: string, nextStatus: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus as never })
      .eq("id", orderId)
      .select("id")
      .single();
    if (error) { toast.error(`Erreur: ${error.message}`); return; }
    await supabase.from("order_events").insert({
      order_id: orderId, status: nextStatus as never, created_by: user!.id,
    });
    queryClient.invalidateQueries({ queryKey: ["admin-active-orders"] });
    queryClient.invalidateQueries({ queryKey: ["admin-active-orders-count"] });
    queryClient.invalidateQueries({ queryKey: ["admin-all-orders"] });
  }

  async function cancelOrder(orderId: string) {
    if (!confirm("Annuler cette commande ?")) return;
    await updateStatus(orderId, "cancelled");
  }

  if (loading || !user || role !== "restaurant") return null;

  return (
    <AdminShell
      user={user}
      activeSection={activeSection}
      setSection={setActiveSection}
      onLogout={handleLogout}
      activeCount={activeOrders.length}
    >
      {activeSection === "dashboard"  && <SectionDashboard />}
      {activeSection === "commandes"  && <SectionCommandes updateStatus={updateStatus} cancelOrder={cancelOrder} />}
      {activeSection === "suivi"      && <SectionSuivi updateStatus={updateStatus} />}
      {activeSection === "menu"       && <SectionMenu />}
      {activeSection === "historique" && <SectionHistorique />}
      {activeSection === "rapports"   && <SectionRapports />}
    </AdminShell>
  );
}
