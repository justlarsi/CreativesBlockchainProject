import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChainGateProps {
  onSwitch: () => Promise<void>;
  isSwitching: boolean;
}

export function ChainGate({ onSwitch, isSwitching }: ChainGateProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="text-amber-200">Wrong network. Switch to Polygon Amoy to continue.</span>
      <Button size="sm" variant="secondary" className="ml-auto h-7 text-xs" onClick={() => void onSwitch()} disabled={isSwitching}>
        {isSwitching ? "Switching..." : "Switch Network"}
      </Button>
    </div>
  );
}

