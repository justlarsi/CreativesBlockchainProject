import { AppLayout } from "@/components/AppLayout";
import { useMemo, useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, BookOpen, DollarSign, TrendingUp } from "lucide-react";
import { getCreatorDashboard, type CreatorDashboardResponse, type DashboardQueryParams } from "@/api/dashboard";

type DateRangePreset = "30d" | "90d" | "365d" | "all";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getRangeParams(preset: DateRangePreset): DashboardQueryParams | undefined {
  if (preset === "all") {
    return undefined;
  }

  const endDate = new Date();
  const startDate = new Date();
  const days = preset === "30d" ? 30 : preset === "90d" ? 90 : 365;
  startDate.setDate(endDate.getDate() - days);

  return {
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
  };
}

function categoryLabel(value: string): string {
  if (value === "image") return "Image";
  if (value === "audio") return "Audio";
  if (value === "video") return "Video";
  if (value === "text") return "Text";
  if (value === "document") return "Document";
  return value;
}

function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  if (!year || !month) return period;
  const value = new Date(Number(year), Number(month) - 1, 1);
  return value.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export default function Dashboard() {
  const [preset, setPreset] = useState<DateRangePreset>("90d");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<CreatorDashboardResponse | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setError(null);

    getCreatorDashboard("", getRangeParams(preset))
      .then((data) => {
        if (isMounted) {
          setDashboard(data);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setDashboard(null);
          setError(err instanceof Error ? err.message : "Failed to load dashboard analytics.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [preset, reloadNonce]);

  const revenueData = useMemo(
    () =>
      (dashboard?.revenue_over_time || []).map((point) => ({
        period: periodLabel(point.period),
        revenueMatic: Number(point.revenue_matic),
      })),
    [dashboard],
  );

  const infringementByStatus = useMemo(() => {
    const result: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      false_positive: 0,
      resolved: 0,
    };

    for (const row of dashboard?.infringement.by_status || []) {
      result[row.status] = row.total;
    }

    return result;
  }, [dashboard]);

  const stats = [
    {
      label: "Total Works",
      value: String(dashboard?.total_works || 0),
      helper: `${dashboard?.registered_works || 0} registered`,
      icon: BookOpen,
      color: "text-primary",
    },
    {
      label: "Revenue (MATIC)",
      value: dashboard?.revenue.total_matic || "0.000000",
      helper: `${dashboard?.revenue.total_wei || "0"} wei`,
      icon: DollarSign,
      color: "text-chart-3",
    },
    {
      label: "Licenses Sold",
      value: String(dashboard?.total_licenses_sold || 0),
      helper: "ACTIVE confirmations",
      icon: TrendingUp,
      color: "text-accent",
    },
    {
      label: "Infringement Alerts",
      value: String(dashboard?.infringement.total || 0),
      helper: `P:${infringementByStatus.pending} C:${infringementByStatus.confirmed} FP:${infringementByStatus.false_positive} R:${infringementByStatus.resolved}`,
      icon: AlertTriangle,
      color: "text-destructive",
    },
  ];

  return (
    <AppLayout title="Dashboard" subtitle="Creator analytics and performance metrics">
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Date range applies to KPI cards and revenue chart.</p>
          <select
            aria-label="Date range"
            value={preset}
            onChange={(event) => setPreset(event.target.value as DateRangePreset)}
            className="px-2.5 py-1.5 text-xs bg-muted rounded-lg border border-border"
          >
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last 365 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        {isLoading && (
          <div className="stat-card rounded-xl p-12 text-center">
            <p className="text-sm font-medium text-foreground">Loading dashboard metrics...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="stat-card rounded-xl p-12 text-center">
            <p className="text-sm font-medium text-foreground mb-1">Could not load dashboard</p>
            <p className="text-xs text-muted-foreground mb-4">{error}</p>
            <button onClick={() => setReloadNonce((value) => value + 1)} className="text-xs text-primary hover:underline">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && dashboard && (
          <>
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((stat, i) => (
            <div key={i} className="stat-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-primary">Step 13</span>
              </div>
              <div className="font-display font-bold text-2xl text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.helper}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 stat-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display font-semibold text-sm">Licensing Revenue</h3>
                <p className="text-xs text-muted-foreground mt-0.5">MATIC by month</p>
              </div>
              <span className="text-xs badge-verified px-2 py-0.5 rounded-full">{dashboard.revenue.total_matic} MATIC</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(174, 84%, 48%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(174, 84%, 48%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 18%, 16%)" />
                <XAxis dataKey="period" tick={{ fill: "hsl(215, 16%, 50%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215, 16%, 50%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(222, 25%, 10%)", border: "1px solid hsl(222, 18%, 18%)", borderRadius: "8px", color: "hsl(210, 40%, 96%)", fontSize: 12 }}
                  formatter={(v) => [`${v} MATIC`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenueMatic" stroke="hsl(174, 84%, 48%)" fill="url(#revenueGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="stat-card rounded-xl p-5">
            <h3 className="font-display font-semibold text-sm mb-4">Works by Category</h3>
            <div className="space-y-2.5">
              {dashboard.works_by_category.length === 0 && (
                <p className="text-xs text-muted-foreground">No works in selected range.</p>
              )}
              {dashboard.works_by_category.map((item) => (
                <div key={item.category} className="flex items-center justify-between gap-2">
                  <p className="text-xs text-foreground">{categoryLabel(item.category)}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.total} total · {item.registered} registered
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
