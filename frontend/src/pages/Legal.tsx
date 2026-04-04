import { AppLayout } from "@/components/AppLayout";
import { useEffect, useMemo, useState } from "react";
import { FileText, Send, Download, AlertTriangle, Shield, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { downloadLegalDocument, generateLegalDocument, listLegalDocuments, type LegalDocument } from "@/api/legal";
import { listWorks, type WorkRecord } from "@/api/works";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const templates = [
  {
    id: "dmca",
    title: "DMCA Takedown Notice",
    desc: "Standard DMCA notice for US-based platforms",
    icon: Send,
    fields: ["platform", "url", "work"],
  },
  {
    id: "cd",
    title: "Cease & Desist Letter",
    desc: "Formal C&D for unauthorized commercial use",
    icon: AlertTriangle,
    fields: ["recipient", "work", "details"],
  },
  {
    id: "cert",
    title: "Copyright Certificate",
    desc: "Blockchain-verified proof of ownership",
    icon: Shield,
    fields: ["work"],
  },
];

export default function Legal() {
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState<number | null>(null);

  const availableWorks = useMemo(
    () => works.filter((work) => work.status === "REGISTERED" || work.status === "IPFS_PINNING_COMPLETE"),
    [works],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const [docs, worksList] = await Promise.all([listLegalDocuments(), listWorks()]);
        if (!isMounted) {
          return;
        }
        setDocuments(docs);
        setWorks(worksList);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load legal workspace.";
        toast.error(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDownload = async (documentId: number, documentLabel: string) => {
    setIsDownloading(documentId);
    try {
      const blob = await downloadLegalDocument(documentId);
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${documentLabel}-${documentId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to download document.";
      toast.error(message);
    } finally {
      setIsDownloading(null);
    }
  };

  const handleGenerate = async (templateId: string) => {
    const workId = Number(formData.work_id || formData.work);
    if (!workId) {
      toast.error("Select a work before generating a legal document.");
      return;
    }

    const documentType = templateId === "dmca" ? "dmca" : "cease_and_desist";

    try {
      const created = await generateLegalDocument({
        document_type: documentType,
        work_id: workId,
      });
      setDocuments((prev) => [created, ...prev]);
      toast.success(documentType === "dmca" ? "DMCA notice generated." : "Cease & Desist letter generated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate legal document.";
      toast.error(message);
      return;
    }

    setOpenDialog(null);
    setFormData({});
  };

  const getDocumentLabel = (doc: LegalDocument): string =>
    doc.document_type === "dmca" ? "DMCA Notice" : "Cease & Desist";

  return (
    <AppLayout title="Legal Tools" subtitle="Automated IP protection documents">
      <div className="space-y-5 animate-fade-in">
        {/* Templates */}
        <div className="grid sm:grid-cols-3 gap-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenDialog(t.id)}
              className="stat-card rounded-xl p-5 text-left group cursor-pointer"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                <t.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-sm text-foreground mb-1">{t.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
              <div className="flex items-center gap-1 mt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Generate <ArrowRight className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>

        {/* History */}
        <div className="stat-card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-semibold text-sm">Document History</h3>
            <span className="text-xs text-muted-foreground">{documents.length} documents</span>
          </div>
          {isLoading ? (
            <div className="px-5 py-8 text-center text-xs text-muted-foreground">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-muted-foreground">No documents generated yet. Create one above!</div>
          ) : (
            <div className="divide-y divide-border/40">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{getDocumentLabel(doc)} - {doc.work_title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="capitalize">{doc.document_type}</span>
                        <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs badge-verified px-2 py-0.5 rounded-full">Generated</span>
                    <button
                      onClick={() => {
                        void handleDownload(doc.id, getDocumentLabel(doc));
                      }}
                      disabled={isDownloading === doc.id}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DMCA Dialog */}
        <Dialog open={openDialog === "dmca"} onOpenChange={() => setOpenDialog(null)}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-base">Generate DMCA Notice</DialogTitle>
              <DialogDescription className="text-xs">Fill in the details to auto-generate a legal DMCA takedown notice.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {[
                { key: "platform", label: "Platform", placeholder: "e.g. Pinterest, Instagram" },
                { key: "url", label: "Infringing URL", placeholder: "https://..." },
                { key: "work_id", label: "Your Work ID", placeholder: "Enter registered work ID" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                  <input
                    value={formData[f.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground transition-all"
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  void handleGenerate("dmca");
                }}
                className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all mt-2"
              >
                Generate & Send
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* C&D Dialog */}
        <Dialog open={openDialog === "cd"} onOpenChange={() => setOpenDialog(null)}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-base">Cease & Desist Letter</DialogTitle>
              <DialogDescription className="text-xs">Generate a formal C&D letter for unauthorized commercial use.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {[
                { key: "recipient", label: "Recipient", placeholder: "Company or individual name" },
                { key: "work_id", label: "Your Work ID", placeholder: "Enter registered work ID" },
                { key: "details", label: "Infringement Details", placeholder: "Describe the unauthorized use" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                  {f.key === "details" ? (
                    <textarea
                      value={formData[f.key] || ""}
                      onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      rows={3}
                      className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground transition-all resize-none"
                    />
                  ) : (
                    <input
                      value={formData[f.key] || ""}
                      onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground transition-all"
                    />
                  )}
                </div>
              ))}
              <button
                onClick={() => {
                  void handleGenerate("cd");
                }}
                className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all mt-2"
              >
                Generate Letter
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Certificate Dialog */}
        <Dialog open={openDialog === "cert"} onOpenChange={() => setOpenDialog(null)}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-base">Copyright Certificate</DialogTitle>
              <DialogDescription className="text-xs">Generate a blockchain-verified proof of ownership certificate.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Work</label>
                <select
                  value={formData.work || ""}
                  onChange={(e) => setFormData({ ...formData, work: e.target.value, work_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
                >
                  <option value="">Choose a registered work</option>
                  {availableWorks.map((work) => (
                    <option key={work.id} value={String(work.id)}>
                      {work.title} (#{work.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-foreground">Blockchain Verified</span>
                </div>
                <p className="text-xs text-muted-foreground">Certificate includes Polygon transaction hash, timestamp, and cryptographic fingerprint.</p>
              </div>
              <button
                onClick={() => {
                  toast.info("Use Document Templates above to generate DMCA or Cease & Desist documents.");
                  setOpenDialog(null);
                }}
                className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all mt-2 flex items-center justify-center gap-2"
              >
                <Download className="h-3.5 w-3.5" />
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
