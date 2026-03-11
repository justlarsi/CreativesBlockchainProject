import { useState } from "react";
import { Shield, CheckCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface LicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  work?: { title: string; creator: string; price: number; license: string };
}

export function LicenseDialog({ open, onOpenChange, work }: LicenseDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState("mpesa");
  const [agreed, setAgreed] = useState(false);

  if (!work) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-base">License Purchase</DialogTitle>
          <DialogDescription className="text-xs">You're licensing "{work.title}" by {work.creator}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Summary */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Work</span><span className="text-foreground font-medium">{work.title}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Creator</span><span className="text-foreground">{work.creator}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">License Type</span><span className="text-foreground">{work.license}</span></div>
            <div className="flex justify-between border-t border-border pt-2 mt-2"><span className="text-muted-foreground font-medium">Total</span><span className="text-foreground font-display font-bold text-base">${work.price}</span></div>
          </div>

          {/* Payment */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "mpesa", label: "M-Pesa" },
                { id: "crypto", label: "MATIC (Polygon)" },
              ].map((pm) => (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`p-3 rounded-lg text-xs font-medium transition-all border ${
                    paymentMethod === pm.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Terms */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 rounded border-border"
            />
            <span className="text-xs text-muted-foreground">I agree to the <span className="text-primary">license terms</span> and understand this is a blockchain transaction</span>
          </label>

          {/* Smart contract note */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
            <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">Payment goes directly to the creator via smart contract — 0% platform fee</p>
          </div>

          <button
            onClick={() => {
              toast.success("License purchased! Smart contract executed on Polygon.", { duration: 4000 });
              onOpenChange(false);
            }}
            disabled={!agreed}
            className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Complete Purchase — ${work.price}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
