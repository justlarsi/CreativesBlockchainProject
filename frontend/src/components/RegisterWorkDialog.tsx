import { useRef, useState } from "react";
import { Upload, CheckCircle, ArrowRight, ArrowLeft, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createWorkMetadata, uploadWorkBinary } from "@/api/works";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface RegisterWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered?: () => Promise<void> | void;
}

const steps = ["Upload", "Details", "Confirm"];
type WorkCategory = "image" | "audio" | "video" | "text" | "document";
const detailFields: Array<{ key: "title" | "description"; label: string; placeholder: string }> = [
  { key: "title", label: "Title", placeholder: "My Creative Work" },
  { key: "description", label: "Description", placeholder: "Brief description of your work" },
];

function getAccessToken(): string {
  return localStorage.getItem("access") || localStorage.getItem("access_token") || "";
}

export function RegisterWorkDialog({ open, onOpenChange, onRegistered }: RegisterWorkDialogProps) {
  const [step, setStep] = useState(0);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "image" as WorkCategory,
    description: "",
    fileName: "",
    file: null as File | null,
  });

  const reset = () => {
    setStep(0);
    setProcessing(false);
    setFormData({ title: "", category: "image", description: "", fileName: "", file: null });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      return;
    }
    setFormData({ ...formData, fileName: selected.name, file: selected });
    toast.success("File selected");
  };

  const handleSubmit = async () => {
    if (!formData.file) {
      toast.error("Choose a file first.");
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      toast.error("Sign in first to register your work.");
      return;
    }

    setProcessing(true);
    try {
      const created = await createWorkMetadata(accessToken, {
        title: formData.title,
        description: formData.description,
        category: formData.category,
      });
      await uploadWorkBinary(accessToken, created.id, formData.file);
      toast.success("Work uploaded successfully.", { duration: 4000 });
      await onRegistered?.();
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-base">Register New Work</DialogTitle>
          <DialogDescription className="text-xs">Step {step + 1} of 3 - {steps[step]}</DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-4">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex items-center gap-1">
              <div className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
            </div>
          ))}
        </div>

        {/* Step 0: Upload */}
        {step === 0 && (
          <div className="space-y-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
            >
              {formData.fileName ? (
                <>
                  <FileText className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium text-foreground">{formData.fileName}</span>
                  <span className="text-xs text-muted-foreground">Click to change</span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to upload your creative work</span>
                  <span className="text-xs text-muted-foreground/60">Max 500MB</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,audio/*,video/*,text/plain,text/markdown,text/csv,.pdf,.doc,.docx"
            />
            <button
              onClick={() => formData.file && setStep(1)}
              disabled={!formData.file}
              className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="space-y-3">
            {detailFields.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input
                  value={formData[f.key]}
                  onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground transition-all"
                />
              </div>
            ))}
            <div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as WorkCategory })}
                  className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
                >
                  {[
                    ["image", "Image"],
                    ["audio", "Audio"],
                    ["video", "Video"],
                    ["text", "Text"],
                    ["document", "Document"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => setStep(0)} className="flex-1 py-2 bg-muted text-muted-foreground text-xs font-medium rounded-lg hover:text-foreground transition-all flex items-center justify-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                onClick={() => formData.title && setStep(2)}
                disabled={!formData.title}
                className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold text-foreground">Confirm Upload</p>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span className="text-foreground font-medium">{formData.title}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="text-foreground">{formData.category}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="text-foreground font-mono">{formData.fileName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Max Size</span><span className="text-foreground">500MB</span></div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setStep(1)} disabled={processing} className="flex-1 py-2 bg-muted text-muted-foreground text-xs font-medium rounded-lg hover:text-foreground transition-all flex items-center justify-center gap-1 disabled:opacity-40">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={processing}
                className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</> : <>Upload <Upload className="h-3.5 w-3.5" /></>}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
