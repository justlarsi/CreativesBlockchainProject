import { AppLayout } from "@/components/AppLayout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, FileText, CheckCircle, Clock, Globe, Shield, Zap, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  listInfringementAlerts,
  triggerInfringementScan,
  type InfringementAlertRecord,
  type InfringementStatus,
  updateInfringementAlertStatus,
} from "@/api/infringement";

const statusConfig = {
  pending: { label: "Pending", class: "badge-flagged", icon: AlertTriangle },
  confirmed: { label: "Confirmed", class: "badge-pending", icon: Clock },
  false_positive: { label: "False Positive", class: "badge-pending", icon: Shield },
  resolved: { label: "Resolved", class: "badge-verified", icon: CheckCircle },
};

export default function Infringement() {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("access") || localStorage.getItem("access_token") || "";

  const [alerts, setAlerts] = useState<InfringementAlertRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanWorkId, setScanWorkId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [updatingAlertId, setUpdatingAlertId] = useState<number | null>(null);

  const loadAlerts = useCallback(async () => {
    if (!accessToken) {
      setAlerts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const records = await listInfringementAlerts(accessToken);
      setAlerts(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load infringement alerts.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const scanStats = useMemo(
    () => [
      { label: "Platforms Scanned", value: String(new Set(alerts.map((item) => item.source_platform)).size), icon: Globe, color: "text-primary" },
      { label: "Works Monitored", value: String(new Set(alerts.map((item) => item.work_id)).size), icon: Eye, color: "text-accent" },
      { label: "Open Cases", value: String(alerts.filter((item) => item.status === "pending" || item.status === "confirmed").length), icon: AlertTriangle, color: "text-destructive" },
      { label: "Cases Resolved", value: String(alerts.filter((item) => item.status === "resolved").length), icon: Shield, color: "text-chart-3" },
    ],
    [alerts],
  );

  const updateStatus = async (alertId: number, status: InfringementStatus) => {
    if (!accessToken) {
      return;
    }
    setUpdatingAlertId(alertId);
    try {
      const updated = await updateInfringementAlertStatus(accessToken, alertId, { status });
      setAlerts((prev) => prev.map((item) => (item.id === alertId ? updated : item)));
      toast.success(`Alert marked as ${status.replace(/_/g, " ")}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update alert status.";
      toast.error(message);
    } finally {
      setUpdatingAlertId(null);
    }
  };

  const runSimulatedScan = async () => {
    if (!accessToken) {
      toast.error("Sign in first to run a scan.");
      return;
    }
    const workId = Number(scanWorkId);
    if (!workId) {
      toast.error("Enter a valid work ID to run a simulated scan.");
      return;
    }

    setIsScanning(true);
    try {
      await triggerInfringementScan(accessToken, {
        work_id: workId,
        candidates: [
          {
            source_url: `https://mock-platform.example/scan/${Date.now()}`,
            source_platform: "mock-platform.example",
            title: "Simulated possible match",
            description: "Generated from dashboard trigger",
          },
        ],
      });
      toast.success("Simulated scan queued.");
      await loadAlerts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to trigger simulated scan.";
      toast.error(message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <AppLayout title="Infringement Detection" subtitle="AI-powered 24/7 monitoring">
      <div className="space-y-5 animate-fade-in">
        {!accessToken && (
          <div className="stat-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Sign in to view and manage your infringement alerts.</p>
          </div>
        )}

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
        <div className="stat-card rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
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
            <p className="text-xs font-semibold text-primary">On demand + daily schedule</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={scanWorkId}
              onChange={(event) => setScanWorkId(event.target.value)}
              placeholder="Work ID"
              className="px-2.5 py-1.5 text-xs bg-muted rounded-lg border border-border w-24"
            />
            <button
              onClick={() => {
                void runSimulatedScan();
              }}
              disabled={isScanning || !accessToken}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              <Zap className="h-3 w-3" />
              {isScanning ? "Queueing..." : "Run Simulated Scan"}
            </button>
          </div>
        </div>

        {/* Cases */}
        <div>
          <h3 className="font-display font-semibold text-sm mb-3">Active Cases</h3>
          {isLoading && (
            <div className="stat-card rounded-xl p-4 text-xs text-muted-foreground">Loading alerts...</div>
          )}
          {error && !isLoading && (
            <div className="stat-card rounded-xl p-4 text-xs text-destructive">{error}</div>
          )}
          {!isLoading && !error && alerts.length === 0 && (
            <div className="stat-card rounded-xl p-4 text-xs text-muted-foreground">No alerts yet.</div>
          )}
          <div className="space-y-3">
            {alerts.map((c) => {
              const st = statusConfig[c.status as keyof typeof statusConfig];
              const similarityPct = Math.round(c.similarity_score * 100);
              return (
                <div key={c.id} className="stat-card rounded-xl p-4" data-testid="infringement-alert-row">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">⚠️</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <h4 className="font-semibold text-xs text-foreground">{c.work_title}</h4>
                          <p className="text-xs text-muted-foreground">Found on <span className="text-foreground">{c.source_platform || "unknown"}</span></p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${st.class}`}>
                          <st.icon className="h-2.5 w-2.5" />{st.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                        <span className="flex items-center gap-1"><ExternalLink className="h-2.5 w-2.5" />{c.source_url}</span>
                        <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{new Date(c.last_detected_at).toLocaleString()}</span>
                        <span className="font-mono">INF-{String(c.id).padStart(4, "0")}</span>
                      </div>

                      {/* Similarity bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Similarity</span>
                          <span className="font-bold text-destructive">{similarityPct}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-destructive transition-all" style={{ width: `${similarityPct}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {c.status === "pending" && (
                          <button
                            onClick={() => {
                              void updateStatus(c.id, "confirmed");
                            }}
                            disabled={updatingAlertId === c.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-all disabled:opacity-50"
                          >
                            <Zap className="h-3 w-3" />Confirm
                          </button>
                        )}
                        {c.status === "pending" && (
                          <button
                            onClick={() => {
                              void updateStatus(c.id, "false_positive");
                            }}
                            disabled={updatingAlertId === c.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-xs rounded-md hover:text-foreground transition-all disabled:opacity-50"
                          >
                            <Shield className="h-3 w-3" />False Positive
                          </button>
                        )}
                        {c.status !== "resolved" && c.status !== "false_positive" && (
                          <button
                            onClick={() => {
                              void updateStatus(c.id, "resolved");
                            }}
                            disabled={updatingAlertId === c.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-xs rounded-md hover:text-foreground transition-all disabled:opacity-50"
                          >
                            <CheckCircle className="h-3 w-3" />Resolve
                          </button>
                        )}
                        <button
                          onClick={() => navigate("/legal")}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-xs rounded-md hover:text-foreground transition-all"
                        >
                          <FileText className="h-3 w-3" />C&D Letter
                        </button>
                        <button
                          onClick={() => toast.info(c.detection_reason || "Evidence details are available in the API payload.")}
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
