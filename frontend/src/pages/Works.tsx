import { AppLayout } from "@/components/AppLayout";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Grid, List, Shield, Eye, MoreHorizontal, Hash, Clock, Loader2 } from "lucide-react";
import { RegisterWorkDialog } from "@/components/RegisterWorkDialog";
import { toast } from "sonner";
import { WorkRecord, listWorks } from "@/api/works";
import { useRegisterWorkOnChain } from "@/hooks/useRegisterWorkOnChain";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusConfig = {
  verified: { label: "Verified", class: "badge-verified" },
  pending: { label: "Pending", class: "badge-pending" },
  queued: { label: "On-chain Pending", class: "badge-pending" },
  flagged: { label: "Infringement", class: "badge-flagged" },
};

const filters = ["all", "illustration", "photography", "music", "writing", "verified", "pending", "flagged"];

function getAccessToken(): string {
  return localStorage.getItem("access") || localStorage.getItem("access_token") || "";
}

function mapWorkToCard(work: WorkRecord) {
  const status =
    work.status === "REGISTERED"
      ? "verified"
      : work.status === "BLOCKCHAIN_REGISTRATION_PENDING"
      ? "queued"
      : work.status === "VALIDATION_FAILED" ||
        work.status === "UPLOAD_FAILED" ||
        work.status === "PROCESSING_FAILED" ||
        work.status === "IPFS_PINNING_FAILED" ||
        work.status === "BLOCKCHAIN_REGISTRATION_FAILED"
      ? "flagged"
      : "pending";
  const categoryLabel =
    work.category === "image"
      ? "Illustration"
      : work.category === "audio"
      ? "Music"
      : work.category === "video"
      ? "Video"
      : work.category === "text"
      ? "Writing"
      : "Document";

  return {
    workId: work.id,
    id: `CW-${work.id}`,
    title: work.title,
    type: categoryLabel,
    status,
    registered: new Date(work.created_at).toLocaleDateString(),
    hash: work.mime_type || "Pending upload",
    licenses: 0,
    views: 0,
    canRegisterOnChain: work.status === "IPFS_PINNING_COMPLETE" || work.status === "BLOCKCHAIN_REGISTRATION_FAILED",
    isRegisteredOnChain: work.status === "REGISTERED",
    txHash: work.blockchain_tx_hash,
    blockNumber: work.blockchain_block_number,
    chainError: work.blockchain_error_message,
    color: "bg-primary/10",
    emoji: work.category === "audio" ? "🎵" : work.category === "video" ? "🎬" : work.category === "text" ? "✍️" : work.category === "document" ? "📄" : "🎨",
  };
}

export default function Works() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [registeringWorkId, setRegisteringWorkId] = useState<number | null>(null);
  const { registerWorkOnChain } = useRegisterWorkOnChain();

  const refreshWorks = async () => {
    const token = getAccessToken();
    if (!token) {
      setWorks([]);
      return;
    }
    try {
      const response = await listWorks(token);
      setWorks(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load works.");
    }
  };

  useEffect(() => {
    void refreshWorks();
  }, []);

  const cards = useMemo(() => works.map(mapWorkToCard), [works]);

  const handleRegisterOnChain = async (workId: number) => {
    setRegisteringWorkId(workId);
    try {
      const result = await registerWorkOnChain(workId);
      toast.success("Transaction submitted. Receipt verification is running asynchronously.", {
        description: result.explorer_url,
      });
      await refreshWorks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Blockchain registration failed.");
    } finally {
      setRegisteringWorkId(null);
    }
  };

  const filtered = cards.filter((w) => {
    const matchesFilter = filter === "all" || w.type.toLowerCase() === filter || w.status === filter;
    const matchesSearch = w.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <AppLayout title="My Works" subtitle={`${works.length} registered creative works`}>
      <div className="space-y-5 animate-fade-in">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-3 py-1.5 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground w-36 transition-all"
              />
            </div>
            <button
              onClick={() => setView(view === "grid" ? "list" : "grid")}
              className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {view === "grid" ? <List className="h-3.5 w-3.5" /> : <Grid className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setRegisterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-teal"
            >
              <Plus className="h-3.5 w-3.5" />
              Register
            </button>
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="stat-card rounded-xl p-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No works found</p>
            <p className="text-xs text-muted-foreground mb-4">Try adjusting your filters or search query</p>
            <button onClick={() => { setFilter("all"); setSearch(""); }} className="text-xs text-primary hover:underline">Clear filters</button>
          </div>
        ) : view === "grid" ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((work) => {
              const status = statusConfig[work.status as keyof typeof statusConfig];
              return (
                <div key={work.id} className="stat-card rounded-xl overflow-hidden group cursor-pointer">
                  <div className={`h-32 ${work.color} flex items-center justify-center`}>
                    <span className="text-4xl">{work.emoji}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="font-semibold text-xs text-foreground truncate">{work.title}</h3>
                        <p className="text-xs text-muted-foreground">{work.type}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border text-xs">
                          <DropdownMenuItem onClick={() => toast.info("Work details view coming soon")} className="text-xs">View Details</DropdownMenuItem>
                          {work.canRegisterOnChain && (
                            <DropdownMenuItem
                              onClick={() => void handleRegisterOnChain(work.workId)}
                              disabled={registeringWorkId === work.workId}
                              className="text-xs"
                            >
                              {registeringWorkId === work.workId ? "Submitting on-chain..." : "Register on Blockchain"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => toast.info("Edit metadata coming soon")} className="text-xs">Edit Metadata</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success("Link copied to clipboard")} className="text-xs">Share Link</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info("Certificate download coming soon")} className="text-xs">Download Certificate</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${status.class}`}>{status.label}</span>
                      <span className="text-xs text-muted-foreground font-mono">{work.id}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-3 px-2 py-1.5 rounded-md bg-muted/50">
                      <Hash className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground truncate">
                        {work.txHash ? `${work.txHash.slice(0, 10)}...` : work.hash}
                      </span>
                    </div>
                    {work.chainError && (
                      <p className="text-xs text-red-400 mb-2 truncate" title={work.chainError}>
                        {work.chainError}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Shield className="h-2.5 w-2.5 text-primary" />{work.blockNumber || work.licenses}</span>
                        <span className="flex items-center gap-1"><Eye className="h-2.5 w-2.5" />{work.views}</span>
                      </div>
                      {registeringWorkId === work.workId && <Loader2 className="h-3 w-3 animate-spin" />}
                      <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{work.registered}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="stat-card rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Work</span><span>Type</span><span>Status</span><span>Licenses</span><span>Registered</span>
            </div>
            {filtered.map((work) => {
              const status = statusConfig[work.status as keyof typeof statusConfig];
              return (
                <div key={work.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 items-center border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg ${work.color} flex items-center justify-center shrink-0 text-base`}>{work.emoji}</div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{work.title}</p>
                      <p className="text-xs font-mono text-muted-foreground">{work.hash}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{work.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${status.class}`}>{status.label}</span>
                  <span className="text-xs text-foreground">{work.blockNumber || work.licenses}</span>
                  <span className="text-xs text-muted-foreground">{work.registered}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RegisterWorkDialog open={registerOpen} onOpenChange={setRegisterOpen} onRegistered={refreshWorks} />
    </AppLayout>
  );
}
