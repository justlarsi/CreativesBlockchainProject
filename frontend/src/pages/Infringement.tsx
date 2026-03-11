import { AppLayout } from "@/components/AppLayout";
import { AlertTriangle, Eye, FileText, CheckCircle, Clock, Globe, Shield, Zap, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const cases = [
  { id: "INF-0047", work: "Nairobi Skyline Collection", platform: "Pinterest", url: "pinterest.com/pin/83921...", detected: "Feb 18 · 09:14 AM", similarity: 98, status: "action_required", dmcaSent: false, emoji: "📷" },
  { id: "INF-0046", work: "Abstract Series #14", platform: "Instagram", url: "instagram.com/p/Cxz84...", detected: "Feb 15 · 02:31 PM", similarity: 94, status: "dmca_sent", dmcaSent: true, emoji: "🎨" },
  { id: "INF-0045", work: "Botanical Illustrations Pack", platform: "Shutterstock", url: "shutterstock.com/image/421...", detected: "Feb 12 · 11:20 AM", similarity: 87, status: "resolved", dmcaSent: true, emoji: "🌿" },
];

const statusConfig = {
  action_required: { label: "Action Required", class: "badge-flagged", icon: AlertTriangle },
  dmca_sent: { label: "DMCA Sent", class: "badge-pending", icon: Clock },
  resolved: { label: "Resolved", class: "badge-verified", icon: CheckCircle },
};

const scanStats = [
  { label: "Platforms Scanned", value: "2,847", icon: Globe, color: "text-primary" },
  { label: "Works Monitored", value: "47", icon: Eye, color: "text-accent" },
  { label: "Cases This Month", value: "3", icon: AlertTriangle, color: "text-destructive" },
  { label: "Cases Resolved", value: "28", icon: Shield, color: "text-chart-3" },
];

export default function Infringement() {
  const navigate = useNavigate();

  return (
    <AppLayout title="Infringement Detection" subtitle="AI-powered 24/7 monitoring">
      <div className="space-y-5 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {scanStats.map((s, i) => (
            <div key={i} className="stat-card rounded-xl p-4 flex items-center gap-3">
              <s.icon className={`h-4 w-4 ${s.color} shrink-0`} />
              <div>
                <div className="font-display font-bold text-lg text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Scanner status */}
        <div className="stat-card rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center h-8 w-8">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">AI Scanner Active</p>
              <p className="text-xs text-muted-foreground">Pinterest · Instagram · TikTok · Shutterstock</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Last scan</p>
            <p className="text-xs font-semibold text-primary">2 minutes ago</p>
          </div>
        </div>

        {/* Cases */}
        <div>
          <h3 className="font-display font-semibold text-sm mb-3">Active Cases</h3>
          <div className="space-y-3">
            {cases.map((c) => {
              const st = statusConfig[c.status as keyof typeof statusConfig];
              return (
                <div key={c.id} className="stat-card rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">{c.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <h4 className="font-semibold text-xs text-foreground">{c.work}</h4>
                          <p className="text-xs text-muted-foreground">Found on <span className="text-foreground">{c.platform}</span></p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${st.class}`}>
                          <st.icon className="h-2.5 w-2.5" />{st.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                        <span className="flex items-center gap-1"><ExternalLink className="h-2.5 w-2.5" />{c.url}</span>
                        <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{c.detected}</span>
                        <span className="font-mono">{c.id}</span>
                      </div>

                      {/* Similarity bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Similarity</span>
                          <span className="font-bold text-destructive">{c.similarity}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-destructive transition-all" style={{ width: `${c.similarity}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!c.dmcaSent && (
                          <button
                            onClick={() => {
                              toast.success("DMCA notice generated — redirecting to Legal Tools");
                              navigate("/legal");
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-all"
                          >
                            <Zap className="h-3 w-3" />Send DMCA
                          </button>
                        )}
                        <button
                          onClick={() => navigate("/legal")}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-xs rounded-md hover:text-foreground transition-all"
                        >
                          <FileText className="h-3 w-3" />C&D Letter
                        </button>
                        <button
                          onClick={() => toast.info("Evidence viewer coming soon — will show side-by-side comparison")}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-xs rounded-md hover:text-foreground transition-all"
                        >
                          <Eye className="h-3 w-3" />Evidence
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
