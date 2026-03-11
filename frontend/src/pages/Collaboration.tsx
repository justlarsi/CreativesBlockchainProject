import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { Plus, DollarSign, CheckCircle, ArrowRight, FileText, Percent, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const collaborations = [
  {
    id: "COL-001",
    title: "Afrobeats Compilation Vol. 4",
    type: "Music",
    status: "active",
    emoji: "🎵",
    members: [
      { name: "James Mwangi", avatar: "JM", role: "Producer", split: 40 },
      { name: "Fatima Hassan", avatar: "FH", role: "Vocalist", split: 35 },
      { name: "Amara Kamau", avatar: "AK", role: "Mixing Engineer", split: 25 },
    ],
    totalRevenue: 890,
  },
  {
    id: "COL-002",
    title: "Nairobi Illustrated Guide",
    type: "Illustration",
    status: "pending",
    emoji: "🎨",
    members: [
      { name: "Amara Kamau", avatar: "AK", role: "Lead Illustrator", split: 60 },
      { name: "Zara Njoroge", avatar: "ZN", role: "Photography", split: 40 },
    ],
    totalRevenue: 0,
  },
];

const splitColors = ["bg-primary", "bg-accent", "bg-chart-3", "bg-chart-4"];

export default function Collaboration() {
  const [newCollabOpen, setNewCollabOpen] = useState(false);
  const [collabForm, setCollabForm] = useState({ title: "", type: "Music", invite: "" });

  return (
    <AppLayout title="Collaboration" subtitle="Transparent multi-party revenue splits">
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">2 active collaborations</p>
          <button
            onClick={() => setNewCollabOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-teal"
          >
            <Plus className="h-3.5 w-3.5" />New Collaboration
          </button>
        </div>

        {/* Collaborations */}
        <div className="space-y-4">
          {collaborations.map((collab) => (
            <div key={collab.id} className="stat-card rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-xl">{collab.emoji}</div>
                  <div>
                    <h3 className="font-display font-semibold text-sm text-foreground">{collab.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{collab.type}</span>
                      <span className="text-xs font-mono text-muted-foreground">{collab.id}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${collab.status === "active" ? "badge-verified" : "badge-pending"}`}>
                        {collab.status === "active" ? "Active" : "Pending"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-xl text-foreground">${collab.totalRevenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>

              {/* Split bar */}
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-2">Revenue Split</p>
                <div className="h-2 rounded-full overflow-hidden flex mb-3">
                  {collab.members.map((m, i) => (
                    <div key={i} className={`${splitColors[i]} h-full`} style={{ width: `${m.split}%` }} />
                  ))}
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  {collab.members.map((member, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                      <div className="h-6 w-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-primary">{member.avatar}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Percent className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-xs font-bold text-foreground">{member.split}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Smart contract note */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15 mb-3">
                <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">Revenue splits are automatic and tamper-proof on Polygon blockchain</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.info("Earnings breakdown coming soon")}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-xs rounded-md hover:text-foreground transition-all"
                >
                  <DollarSign className="h-3 w-3" />Earnings
                </button>
                <button
                  onClick={() => toast.info("Smart contract viewer coming soon")}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-xs rounded-md hover:text-foreground transition-all"
                >
                  <FileText className="h-3 w-3" />Contract
                </button>
                <button
                  onClick={() => toast.info("Collaboration management coming soon")}
                  className="flex items-center gap-1 text-xs text-primary ml-auto hover:underline"
                >
                  Manage <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* New CTA */}
        <div className="stat-card rounded-xl p-4 flex items-center gap-4">
          <div className="flex -space-x-2">
            {["AM", "BN", "CK"].map((a, i) => (
              <div key={i} className="h-8 w-8 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                <span className="text-xs font-bold text-muted-foreground">{a}</span>
              </div>
            ))}
            <div className="h-8 w-8 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center">
              <Plus className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-foreground">Start a New Collaboration</p>
            <p className="text-xs text-muted-foreground">Invite collaborators, define splits, and deploy a smart contract instantly.</p>
          </div>
          <button
            onClick={() => setNewCollabOpen(true)}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-teal shrink-0"
          >
            Get Started
          </button>
        </div>
      </div>

      {/* New Collaboration Dialog */}
      <Dialog open={newCollabOpen} onOpenChange={setNewCollabOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-base">New Collaboration</DialogTitle>
            <DialogDescription className="text-xs">Create a collaboration with automatic revenue splits via smart contract.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Project Title</label>
              <input
                value={collabForm.title}
                onChange={(e) => setCollabForm({ ...collabForm, title: e.target.value })}
                placeholder="e.g. Afrobeats Compilation Vol. 5"
                className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
              <select
                value={collabForm.type}
                onChange={(e) => setCollabForm({ ...collabForm, type: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
              >
                {["Music", "Illustration", "Photography", "Writing", "Video", "3D Art"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Invite Collaborator</label>
              <div className="flex gap-2">
                <input
                  value={collabForm.invite}
                  onChange={(e) => setCollabForm({ ...collabForm, invite: e.target.value })}
                  placeholder="Email or wallet address"
                  className="flex-1 px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground transition-all"
                />
                <button
                  onClick={() => {
                    if (collabForm.invite) {
                      toast.success(`Invitation sent to ${collabForm.invite}`);
                      setCollabForm({ ...collabForm, invite: "" });
                    }
                  }}
                  className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
              <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">Revenue splits will be configured after collaborators accept</p>
            </div>
            <button
              onClick={() => {
                if (collabForm.title) {
                  toast.success("Collaboration created! Invitations sent.");
                  setNewCollabOpen(false);
                  setCollabForm({ title: "", type: "Music", invite: "" });
                }
              }}
              disabled={!collabForm.title}
              className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create Collaboration
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
