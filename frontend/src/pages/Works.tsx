import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { Plus, Search, Grid, List, Shield, Eye, MoreHorizontal, Hash, Clock } from "lucide-react";
import { RegisterWorkDialog } from "@/components/RegisterWorkDialog";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const works = [
  { id: "CC-0001", title: "Abstract Series #14", type: "Illustration", status: "verified", registered: "Feb 15, 2026", hash: "0x4f3a...8b2c", licenses: 3, views: 284, color: "bg-primary/10", emoji: "🎨" },
  { id: "CC-0002", title: "Nairobi Skyline Collection", type: "Photography", status: "verified", registered: "Feb 10, 2026", hash: "0x7c1d...5e90", licenses: 8, views: 1420, color: "bg-accent/10", emoji: "📷" },
  { id: "CC-0003", title: "Afrobeat Mix Vol. 3", type: "Music", status: "verified", registered: "Jan 28, 2026", hash: "0x9a2f...3d71", licenses: 1, views: 673, color: "bg-chart-3/10", emoji: "🎵" },
  { id: "CC-0004", title: "Maasai Heritage Portraits", type: "Photography", status: "pending", registered: "Feb 18, 2026", hash: "Processing...", licenses: 0, views: 12, color: "bg-chart-4/10", emoji: "📷" },
  { id: "CC-0005", title: "Urban Decay — Essay", type: "Writing", status: "verified", registered: "Jan 15, 2026", hash: "0x2b8e...7f44", licenses: 2, views: 390, color: "bg-chart-5/10", emoji: "✍️" },
  { id: "CC-0006", title: "Botanical Illustrations Pack", type: "Illustration", status: "flagged", registered: "Dec 20, 2025", hash: "0x5c9a...1d82", licenses: 5, views: 2110, color: "bg-destructive/10", emoji: "🌿" },
];

const statusConfig = {
  verified: { label: "Verified", class: "badge-verified" },
  pending: { label: "Pending", class: "badge-pending" },
  flagged: { label: "Infringement", class: "badge-flagged" },
};

const filters = ["all", "illustration", "photography", "music", "writing", "verified", "pending", "flagged"];

export default function Works() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);

  const filtered = works.filter((w) => {
    const matchesFilter = filter === "all" || w.type.toLowerCase() === filter || w.status === filter;
    const matchesSearch = w.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <AppLayout title="My Works" subtitle="47 registered creative works">
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
                      <span className="text-xs font-mono text-muted-foreground truncate">{work.hash}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Shield className="h-2.5 w-2.5 text-primary" />{work.licenses}</span>
                        <span className="flex items-center gap-1"><Eye className="h-2.5 w-2.5" />{work.views}</span>
                      </div>
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
                  <span className="text-xs text-foreground">{work.licenses}</span>
                  <span className="text-xs text-muted-foreground">{work.registered}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RegisterWorkDialog open={registerOpen} onOpenChange={setRegisterOpen} />
    </AppLayout>
  );
}
