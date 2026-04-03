import { AppLayout } from "@/components/AppLayout";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Grid, List, Shield, Eye, MoreHorizontal, Hash, Clock, Loader2, Edit, Download } from "lucide-react";
import { RegisterWorkDialog } from "@/components/RegisterWorkDialog";
import { toast } from "sonner";
import { WorkRecord, listWorks, downloadWorkCertificate, updateWorkMetadata } from "@/api/works";
import { useRegisterWorkOnChain } from "@/hooks/useRegisterWorkOnChain";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";


const backendStatusConfig: Record<string, { label: string; class: string }> = {
  PENDING_UPLOAD: { label: "Pending Upload", class: "badge-pending" },
  UPLOADED: { label: "Uploaded", class: "badge-pending" },
  VALIDATION_FAILED: { label: "Validation Failed", class: "badge-flagged" },
  UPLOAD_FAILED: { label: "Upload Failed", class: "badge-flagged" },
  PROCESSING: { label: "Processing", class: "badge-pending" },
  PROCESSING_COMPLETE: { label: "Processing Complete", class: "badge-pending" },
  PROCESSING_FAILED: { label: "Processing Failed", class: "badge-flagged" },
  IPFS_PINNING_COMPLETE: { label: "IPFS Pinning Complete", class: "badge-pending" },
  IPFS_PINNING_FAILED: { label: "IPFS Pinning Failed", class: "badge-flagged" },
  BLOCKCHAIN_REGISTRATION_PENDING: { label: "Blockchain Pending", class: "badge-pending" },
  REGISTERED: { label: "Registered on Blockchain", class: "badge-verified" },
  BLOCKCHAIN_REGISTRATION_FAILED: { label: "Blockchain Registration Failed", class: "badge-flagged" },
};
const filters = ["all", "illustration", "photography", "music", "writing", "verified", "pending", "flagged"];

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function resolveMediaUrl(fileUrl?: string | null): string | null {
  if (!fileUrl) {
    return null;
  }

  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }

  if (!apiBase) {
    return fileUrl;
  }

  return `${apiBase}${fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`}`;
}

function mediaKindFromWork(work: WorkRecord): "image" | "video" | "audio" | "none" {
  if (work.category === "image") return "image";
  if (work.category === "video") return "video";
  if (work.category === "audio") return "audio";
  return "none";
}


function mapWorkToCard(work: WorkRecord) {
  const statusConfig = backendStatusConfig[work.status] || { label: work.status, class: "badge-pending" };
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
    status: work.status,
    statusConfig,
    registered: new Date(work.created_at).toLocaleDateString(),
    hash: work.blockchain_tx_hash || work.ipfs_metadata_cid || "Processing",
    licenses: 0,
    views: 0,
    canRegisterOnChain: work.status === "IPFS_PINNING_COMPLETE" || work.status === "BLOCKCHAIN_REGISTRATION_FAILED",
    isRegisteredOnChain: work.status === "REGISTERED",
    txHash: work.blockchain_tx_hash,
    blockNumber: work.blockchain_block_number,
    chainError: work.blockchain_error_message,
    color: "bg-primary/10",
    emoji: work.category === "audio" ? "🎵" : work.category === "video" ? "🎬" : work.category === "text" ? "✍️" : work.category === "document" ? "📄" : "🎨",
    mediaUrl: resolveMediaUrl(work.file),
    mediaKind: mediaKindFromWork(work),
  };
}

export default function Works() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [selectedWork, setSelectedWork] = useState<WorkRecord | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({ title: "", description: "", category: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { registeringWorkId, handleRegisterOnChain } = useRegisterWorkOnChain();

  const refreshWorks = async () => {
    try {
      const response = await listWorks();
      setWorks(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load works.");
    }
  };

  const handleViewDetails = (work: WorkRecord) => {
    setSelectedWork(work);
    setShowDetailsDialog(true);
  };

  const handleEditMetadata = (work: WorkRecord) => {
    setSelectedWork(work);
    setEditFormData({
      title: work.title,
      description: work.description,
      category: work.category,
    });
    setShowEditDialog(true);
  };

  const handleSaveMetadata = async () => {
    if (!selectedWork) return;

    setIsSavingEdit(true);
    try {
      const updatedWork = await updateWorkMetadata(selectedWork.id, {
        title: editFormData.title,
        description: editFormData.description,
        category: editFormData.category,
      });

      setWorks(works.map((w) => (w.id === selectedWork.id ? updatedWork : w)));
      toast.success("Metadata updated successfully");
      setShowEditDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save metadata");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDownloadCertificate = async (workId: number) => {
    setIsDownloading(true);
    try {
      const blob = await downloadWorkCertificate(workId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${workId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Certificate downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download certificate");
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    void refreshWorks();
  }, []);

  const cards = useMemo(() => works.map(mapWorkToCard), [works]);

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
            {filtered.map((work) => (
                <div key={work.id} className="stat-card rounded-xl overflow-hidden group cursor-pointer">
                  <div className={`h-32 ${work.color} flex items-center justify-center overflow-hidden`}>
                    {work.mediaKind === "image" && work.mediaUrl ? (
                      <img src={work.mediaUrl} alt={work.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : work.mediaKind === "video" && work.mediaUrl ? (
                      <video src={work.mediaUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    ) : work.mediaKind === "audio" ? (
                      <span className="text-4xl">🎵</span>
                    ) : (
                      <span className="text-4xl">{work.emoji}</span>
                    )}
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
                          <DropdownMenuItem onClick={() => handleViewDetails(work)} className="text-xs flex items-center gap-2">
                            <Eye className="h-3 w-3" />
                            View Details
                          </DropdownMenuItem>
                          {work.status === "IPFS_PINNING_COMPLETE" || work.status === "BLOCKCHAIN_REGISTRATION_FAILED" && (
                            <DropdownMenuItem
                              onClick={() => void handleRegisterOnChain(work.id)}
                              disabled={registeringWorkId === work.id}
                              className="text-xs"
                            >
                              {registeringWorkId === work.id ? "Submitting on-chain..." : "Register on Blockchain"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleEditMetadata(work)} className="text-xs flex items-center gap-2">
                            <Edit className="h-3 w-3" />
                            Edit Metadata
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success("Link copied to clipboard")} className="text-xs">Share Link</DropdownMenuItem>
                          {work.status === "REGISTERED" && (
                            <DropdownMenuItem 
                              onClick={() => handleDownloadCertificate(work.id)}
                              disabled={isDownloading}
                              className="text-xs flex items-center gap-2"
                            >
                              <Download className="h-3 w-3" />
                              {isDownloading ? "Downloading..." : "Download Certificate"}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${work.statusConfig.class} cursor-help`} title={work.status}>
                        {work.statusConfig.label}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">#{work.workId}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-3 px-2 py-1.5 rounded-md bg-muted/50">
                      <Hash className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground truncate">
                        {work.txHash ? `${work.txHash.slice(0, 10)}...` : work.hash}
                      </span>
                    </div>
                    {work.mediaKind === "audio" && work.mediaUrl && (
                      <audio controls preload="metadata" className="w-full h-8 mb-3">
                        <source src={work.mediaUrl} />
                        Your browser does not support audio playback.
                      </audio>
                    )}
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
            ))}
          </div>
        ) : (
          <div className="stat-card rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Work</span><span>Type</span><span>Status</span><span>Licenses</span><span>Registered</span>
            </div>
            {filtered.map((work) => (
                <div key={work.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 items-center border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg ${work.color} flex items-center justify-center shrink-0 text-base`}>{work.emoji}</div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{work.title}</p>
                      <p className="text-xs font-mono text-muted-foreground">{work.hash}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{work.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${work.statusConfig.class} cursor-help`} title={work.status}>{work.statusConfig.label}</span>
                  <span className="text-xs text-foreground">{work.blockNumber || work.licenses}</span>
                  <span className="text-xs text-muted-foreground">{work.registered}</span>
                </div>
            ))}
          </div>
        )}
      </div>

      <RegisterWorkDialog open={registerOpen} onOpenChange={setRegisterOpen} onRegistered={refreshWorks} />

      {/* Work Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Work Details</DialogTitle>
            <DialogDescription className="text-xs">View complete information about your work</DialogDescription>
          </DialogHeader>
          {selectedWork && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Title</p>
                <p className="text-sm text-foreground">{selectedWork.title}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Description</p>
                <p className="text-sm text-foreground">{selectedWork.description || "No description"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Category</p>
                  <p className="text-sm text-foreground capitalize">{selectedWork.category}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Status</p>
                  <p className="text-sm text-foreground capitalize">{selectedWork.status}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">File Size</p>
                <p className="text-sm text-foreground">{selectedWork.file_size ? `${(selectedWork.file_size / 1024 / 1024).toFixed(2)} MB` : "N/A"}</p>
              </div>
              {selectedWork.file && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Media Preview</p>
                  {selectedWork.category === "image" ? (
                    <img
                      src={resolveMediaUrl(selectedWork.file) || ""}
                      alt={selectedWork.title}
                      className="w-full max-h-52 rounded-md object-contain bg-muted"
                      loading="lazy"
                    />
                  ) : selectedWork.category === "video" ? (
                    <video controls preload="metadata" className="w-full max-h-52 rounded-md bg-muted">
                      <source src={resolveMediaUrl(selectedWork.file) || ""} type={selectedWork.mime_type || undefined} />
                      Your browser does not support video playback.
                    </video>
                  ) : selectedWork.category === "audio" ? (
                    <audio controls preload="metadata" className="w-full">
                      <source src={resolveMediaUrl(selectedWork.file) || ""} type={selectedWork.mime_type || undefined} />
                      Your browser does not support audio playback.
                    </audio>
                  ) : (
                    <a
                      href={resolveMediaUrl(selectedWork.file) || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Open uploaded file
                    </a>
                  )}
                </div>
              )}
              {selectedWork.blockchain_tx_hash && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Blockchain TX Hash</p>
                  <p className="text-xs text-foreground font-mono truncate">{selectedWork.blockchain_tx_hash}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Metadata Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Edit Work Metadata</DialogTitle>
            <DialogDescription className="text-xs">Update your work's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
              <input
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <select
                value={editFormData.category}
                onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
              >
                <option value="image">Image</option>
                <option value="audio">Audio</option>
                <option value="video">Video</option>
                <option value="text">Text</option>
                <option value="document">Document</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleSaveMetadata}
            disabled={isSavingEdit}
            className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {isSavingEdit ? "Saving..." : "Save Changes"}
          </button>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
