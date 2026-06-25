import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  formatFCFA,
  STATUS_LABEL,
  STATUS_COLOR,
  ROYAL_HOUSE_ID,
  type OrderStatus,
} from "@/lib/orders";

// ---------------------------------------------------------------------------
// Local helpers wrapping the record constants from orders.ts
// ---------------------------------------------------------------------------
function statusLabel(s: OrderStatus): string {
  return STATUS_LABEL[s] ?? s;
}

function statusColor(s: OrderStatus): string {
  return STATUS_COLOR[s] ?? "";
}

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------
export type WeeklyBucket = {
  /** ex: "lun. 12" */
  date: string;
  /** ex: "2026-06-16" */
  isoDate: string;
  recettes: number;
  commandes: number;
};

// ---------------------------------------------------------------------------
// buildWeeklyData
// ---------------------------------------------------------------------------
export function buildWeeklyData(
  orders: Array<{ created_at: string; total: string | number | null; status: string }>
): WeeklyBucket[] {
  const buckets: WeeklyBucket[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      isoDate: d.toISOString().slice(0, 10),
      recettes: 0,
      commandes: 0,
    };
  });

  orders
    .filter((o) => o.status === "delivered")
    .forEach((o) => {
      const b = buckets.find((x) => x.isoDate === o.created_at.slice(0, 10));
      if (b) {
        b.recettes += Number(o.total ?? 0);
        b.commandes += 1;
      }
    });

  return buckets;
}

// ---------------------------------------------------------------------------
// RevenueBarChart
// ---------------------------------------------------------------------------
const revenueChartConfig = {
  recettes: { label: "Recettes", color: "oklch(0.65 0.21 25)" },
  commandes: { label: "Commandes", color: "oklch(0.65 0.16 155)" },
} satisfies ChartConfig;

export function RevenueBarChart({
  data,
  className,
}: {
  data: WeeklyBucket[];
  className?: string;
}) {
  const hasData = data.some((d) => d.recettes > 0 || d.commandes > 0);

  if (!hasData) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-muted-foreground ${
          className ?? "h-[200px]"
        }`}
      >
        Aucune livraison sur les 7 derniers jours
      </div>
    );
  }

  return (
    <ChartContainer
      config={revenueChartConfig}
      className={className ?? "h-[200px] w-full"}
    >
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          yAxisId="left"
          tickFormatter={(v: number) =>
            v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
          }
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          width={45}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          width={30}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) =>
                name === "recettes"
                  ? [formatFCFA(Number(value)), "Recettes"]
                  : [String(value), "Commandes"]
              }
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          yAxisId="left"
          dataKey="recettes"
          fill="var(--color-recettes)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          yAxisId="right"
          dataKey="commandes"
          fill="var(--color-commandes)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// SectionRapports
// ---------------------------------------------------------------------------
export function SectionRapports() {
  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: weeklyOrders = [] } = useQuery({
    queryKey: ["admin-weekly-revenue"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("orders")
        .select("total, created_at, status")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: statusOrders = [] } = useQuery({
    queryKey: ["admin-status-breakdown"],
    queryFn: async () => {
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() - 30);
      const { data, error } = await supabase
        .from("orders")
        .select("status, total")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .gte("created_at", thirtyDays.toISOString());
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ["admin-all-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total, created_at, items")
        .eq("restaurant_id", ROYAL_HOUSE_ID)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  // ── Computations ─────────────────────────────────────────────────────────

  const weeklyBuckets = useMemo(
    () => buildWeeklyData(weeklyOrders),
    [weeklyOrders]
  );

  const weeklySummary = useMemo(() => {
    const totalRevenue = weeklyBuckets.reduce((s, b) => s + b.recettes, 0);
    const totalOrders = weeklyBuckets.reduce((s, b) => s + b.commandes, 0);
    const avgBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const bestDay = weeklyBuckets.reduce(
      (best, b) => (b.recettes > best.recettes ? b : best),
      weeklyBuckets[0] ?? {
        date: "—",
        isoDate: "",
        recettes: 0,
        commandes: 0,
      }
    );
    return { totalRevenue, totalOrders, avgBasket, bestDay };
  }, [weeklyBuckets]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    statusOrders.forEach((o) => {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    });
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([status, count]) => ({
        status,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
  }, [statusOrders]);

  const topDishes = useMemo(() => {
    type Dish = { name: string; qty: number; revenue: number };
    const map = new Map<string, Dish>();
    allOrders
      .filter((o) => o.status !== "cancelled")
      .forEach((o) => {
        const items = o.items as Array<{
          name: string;
          qty: number;
          price: number;
        }> | null;
        items?.forEach((item) => {
          const e = map.get(item.name) ?? {
            name: item.name,
            qty: 0,
            revenue: 0,
          };
          e.qty += item.qty;
          e.revenue += item.price * item.qty;
          map.set(item.name, e);
        });
      });
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [allOrders]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Titre */}
      <div>
        <h2 className="text-xl font-bold">Rapports</h2>
        <p className="text-sm text-muted-foreground">
          Analyse des 7 derniers jours
        </p>
      </div>

      {/* Revenue chart */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="mb-4">
          <h3 className="font-semibold">Revenus & Commandes livrées</h3>
          <p className="text-xs text-muted-foreground">7 derniers jours</p>
        </div>
        <RevenueBarChart data={weeklyBuckets} className="h-[280px] w-full" />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Recettes 7j</p>
          <p className="mt-1 text-xl font-bold">
            {formatFCFA(weeklySummary.totalRevenue)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Livraisons</p>
          <p className="mt-1 text-xl font-bold">{weeklySummary.totalOrders}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Panier moyen</p>
          <p className="mt-1 text-xl font-bold">
            {formatFCFA(Math.round(weeklySummary.avgBasket))}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Meilleur jour</p>
          <p className="mt-1 text-xl font-bold">
            {weeklySummary.bestDay.date}
          </p>
          {weeklySummary.bestDay.recettes > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatFCFA(weeklySummary.bestDay.recettes)}
            </p>
          )}
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold mb-1">Répartition des commandes</h3>
          <p className="text-xs text-muted-foreground mb-4">
            30 derniers jours · {statusOrders.length} commandes
          </p>
          <div className="space-y-3">
            {statusBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée</p>
            ) : (
              statusBreakdown.map(({ status, count, pct }) => (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge
                      className={`${statusColor(status as OrderStatus)} text-[10px]`}
                    >
                      {statusLabel(status as OrderStatus)}
                    </Badge>
                    <span className="text-sm font-medium">
                      {count}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top dishes */}
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold mb-1">Top 10 plats</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Classement par quantité vendue
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 text-xs">#</TableHead>
                <TableHead className="text-xs">Plat</TableHead>
                <TableHead className="text-right text-xs">Vendus</TableHead>
                <TableHead className="text-right text-xs">Recettes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topDishes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground py-8 text-sm"
                  >
                    Aucune donnée disponible
                  </TableCell>
                </TableRow>
              ) : (
                topDishes.map((dish, i) => (
                  <TableRow key={dish.name}>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {i + 1}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {dish.name}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {dish.qty}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {formatFCFA(dish.revenue)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
