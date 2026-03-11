import { useState } from "react";
import { Upload, Hash, Shield, CheckCircle, ArrowRight, ArrowLeft, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
}

const steps = ["Upload", "Details", "Fingerprint", "Confirm"];

export function RegisterWorkDialog({ open, onOpenChange }: RegisterWorkDialogProps) {
  const [step, setStep] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "Illustration",
    description: "",
    tags: "",
    license: "Personal",
    fileName: "",
  });

  const reset = () => {
    setStep(0);
    setProcessing(false);
    setFormData({ title: "", type: "Illustration", description: "", tags: "", license: "Personal", fileName: "" });
  };

  const handleFileSelect = () => {
    setFormData({ ...formData, fileName: "artwork_final.png" });
    toast.success("File selected");
  };

  const handleFingerprint = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setStep(3);
    }, 2000);
  };

  const handleSubmit = () => {
    toast.success("Work registered on Polygon blockchain!", { duration: 4000 });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-base">Register New Work</DialogTitle>
          <DialogDescription className="text-xs">Step {step + 1} of 4 — {steps[step]}</DialogDescription>
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
              onClick={handleFileSelect}
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
                  <span className="text-xs text-muted-foreground/60">PNG, JPG, MP3, MP4, PDF — Max 100MB</span>
                </>
              )}
            </button>
            <button
              onClick={() => formData.fileName && setStep(1)}
              disabled={!formData.fileName}
              className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="space-y-3">
            {[
              { key: "title", label: "Title", placeholder: "My Creative Work" },
              { key: "description", label: "Description", placeholder: "Brief description of your work" },
              { key: "tags", label: "Tags", placeholder: "art, digital, abstract (comma separated)" },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input
                  value={formData[f.key as keyof typeof formData]}
                  onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground transition-all"
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
                >
                  {["Illustration", "Photography", "Music", "Writing", "3D Art", "Video"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Default License</label>
                <select
                  value={formData.license}
                  onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
                >
                  {["Personal", "Commercial", "Extended"].map((l) => (
                    <option key={l}>{l}</option>
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

        {/* Step 2: Fingerprint */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-3 mb-3">
                <Hash className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground">AI Fingerprint Generation</p>
                  <p className="text-xs text-muted-foreground">Perceptual hash + cryptographic signature</p>
                </div>
              </div>
              {processing ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">Generating cryptographic fingerprint...</p>
                  <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>This process will:</p>
                  <ul className="space-y-1 ml-4">
                    <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-primary shrink-0" />Generate perceptual hash</li>
                    <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-primary shrink-0" />Create SHA-256 signature</li>
                    <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-primary shrink-0" />Timestamp on Polygon</li>
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setStep(1)} disabled={processing} className="flex-1 py-2 bg-muted text-muted-foreground text-xs font-medium rounded-lg hover:text-foreground transition-all flex items-center justify-center gap-1 disabled:opacity-40">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                onClick={handleFingerprint}
                disabled={processing}
                className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing...</> : <>Generate <Shield className="h-3.5 w-3.5" /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold text-foreground">Ready to Register</p>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span className="text-foreground font-medium">{formData.title}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="text-foreground">{formData.type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">License</span><span className="text-foreground">{formData.license}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="text-foreground font-mono">{formData.fileName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Hash</span><span className="text-foreground font-mono">0x4f3a...8b2c</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Network</span><span className="text-foreground">Polygon (MATIC)</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gas Fee</span><span className="text-primary font-medium">~$0.02</span></div>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <Shield className="h-3.5 w-3.5" />
              Register on Blockchain
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
