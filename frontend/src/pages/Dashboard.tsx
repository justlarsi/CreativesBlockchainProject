import { AppLayout } from "@/components/AppLayout";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Shield, TrendingUp, AlertTriangle, DollarSign, BookOpen, Clock, ArrowRight, CheckCircle, Zap } from "lucide-react";

const revenueData = [
  { month: "Aug", revenue: 120 },
  { month: "Sep", revenue: 340 },
  { month: "Oct", revenue: 280 },
  { month: "Nov", revenue: 650 },
  { month: "Dec", revenue: 420 },
  { month: "Jan", revenue: 890 },
  { month: "Feb", revenue: 1240 },
];

const recentActivity = [
  { action: "Work registered", detail: "Abstract Series #14", time: "2m ago", icon: Shield, iconClass: "text-primary", bg: "bg-primary/10" },
  { action: "License sold", detail: "Nairobi Skyline — $45", time: "1h ago", icon: DollarSign, iconClass: "text-chart-3", bg: "bg-chart-3/10" },
  { action: "Infringement detected", detail: "Unauthorized use on Pinterest", time: "3h ago", icon: AlertTriangle, iconClass: "text-destructive", bg: "bg-destructive/10" },
  { action: "DMCA notice sent", detail: "Automated to Pinterest Inc.", time: "3h ago", icon: CheckCircle, iconClass: "text-primary", bg: "bg-primary/10" },
  { action: "Collaboration invite", detail: "Fatima Hassan — Beat collab", time: "Yesterday", icon: Zap, iconClass: "text-accent", bg: "bg-accent/10" },
];

const pendingActions = [
  { title: "Review infringement alert", desc: "Pinterest unauthorized use", urgency: "High", color: "text-destructive", link: "/infringement" },
  { title: "Sign collaboration agreement", desc: "Fatima Hassan — Beat Collab", urgency: "Medium", color: "text-chart-3", link: "/collaboration" },
  { title: "Renew 3 expiring licenses", desc: "Expires in 7 days", urgency: "Medium", color: "text-chart-3", link: "/marketplace" },
];

const stats = [
  { label: "Registered Works", value: "47", change: "+8 this month", icon: BookOpen, color: "text-primary" },
  { label: "Revenue Earned", value: "$1,240", change: "+39% vs last month", icon: DollarSign, color: "text-chart-3" },
  { label: "Active Licenses", value: "12", change: "3 new this week", icon: TrendingUp, color: "text-accent" },
  { label: "Infringement Cases", value: "3", change: "1 resolved", icon: AlertTriangle, color: "text-destructive" },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <AppLayout title="Dashboard" subtitle="Welcome back, Amara">
      <div className="space-y-5 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((stat, i) => (
            <div key={i} className="stat-card rounded-xl p-4 cursor-pointer" onClick={() => navigate(i === 0 ? "/works" : i === 1 ? "/marketplace" : i === 3 ? "/infringement" : "/works")}>
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-primary">{stat.change}</span>
              </div>
              <div className="font-display font-bold text-2xl text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Chart + Activity */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 stat-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display font-semibold text-sm">Licensing Revenue</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Last 7 months · USD</p>
              </div>
              <span className="text-xs badge-verified px-2 py-0.5 rounded-full">+39% ↑</span>
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
                <XAxis dataKey="month" tick={{ fill: "hsl(215, 16%, 50%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215, 16%, 50%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(222, 25%, 10%)", border: "1px solid hsl(222, 18%, 18%)", borderRadius: "8px", color: "hsl(210, 40%, 96%)", fontSize: 12 }}
                  formatter={(v) => [`$${v}`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(174, 84%, 48%)" fill="url(#revenueGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="stat-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-sm">Recent Activity</h3>
              <button className="text-xs text-primary hover:underline flex items-center gap-0.5">
                All <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </div>
            <div className="space-y-3">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`h-6 w-6 rounded-md ${item.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <item.icon className={`h-3 w-3 ${item.iconClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.action}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pending Actions */}
        <div className="stat-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm">Action Required</h3>
            <span className="text-xs badge-flagged px-2 py-0.5 rounded-full">3 pending</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {pendingActions.map((action, i) => (
              <div
                key={i}
                onClick={() => navigate(action.link)}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
              >
                <div>
                  <p className="text-xs font-medium text-foreground">{action.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                </div>
                <div className="flex items-center gap-1.5 ml-3">
                  <span className={`text-xs font-semibold ${action.color}`}>{action.urgency}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
