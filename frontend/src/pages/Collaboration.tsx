import { AppLayout } from "@/components/AppLayout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, DollarSign, CheckCircle, ArrowRight, FileText, Percent, UserPlus, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { approveCollaboration, acceptCollaborationRequest, rejectCollaborationRequest, listCollaborationRequests, listCollaborations, getCollaborationEarnings, getCollaborationContract, type CollaborationRecord, type CollaborationRequestRecord } from "@/api/collaboration";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const splitColors = ["bg-primary", "bg-accent", "bg-chart-3", "bg-chart-4"];


function initials(value: string): string {
  const parts = value.split(" ").filter(Boolean);
  return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
}

function mapCollaborationForCard(collaboration: CollaborationRecord) {
  const isActive =
    collaboration.status === "APPROVED" ||
    collaboration.status === "REGISTERED" ||
    collaboration.status === "BLOCKCHAIN_REGISTRATION_PENDING";

  return {
    id: collaboration.id,
    title: `Work #${collaboration.work_id}`,
    type: "Collaboration",
    status: isActive ? "active" : "pending",
    emoji: "🤝",
    members: collaboration.members.map((member) => ({
      id: member.id,
      name: member.username,
      avatar: initials(member.username),
      role: member.approval_status === "APPROVED" ? "Approved" : "Pending approval",
      split: member.split_bps / 100,
      approval_status: member.approval_status,
    })),
    totalRevenue: 0,
    approvals: `${collaboration.approvals_received}/${collaboration.approvals_required}`,
    canApprove: collaboration.status === "PENDING_APPROVAL",
  };
}

export default function Collaboration() {
  const accessToken = localStorage.getItem("access_token") || localStorage.getItem("access");
  const isAuthenticated = Boolean(accessToken);
  const [newCollabOpen, setNewCollabOpen] = useState(false);
  const [collabForm, setCollabForm] = useState({ title: "", type: "Music", invite: "" });
  const [collaborations, setCollaborations] = useState<CollaborationRecord[]>([]);
  const [requests, setRequests] = useState<CollaborationRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [selectedCollabId, setSelectedCollabId] = useState<number | null>(null);
  const [earningsData, setEarningsData] = useState<any>(null);
  const [contractData, setContractData] = useState<any>(null);
  const [showEarnings, setShowEarnings] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(false);
  const [isLoadingContract, setIsLoadingContract] = useState(false);

  const loadCollaborations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [records, incomingRequests] = await Promise.all([
        listCollaborations(accessToken || undefined),
        isAuthenticated ? listCollaborationRequests(accessToken || undefined) : Promise.resolve([]),
      ]);
      setCollaborations(records);
      setRequests(incomingRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collaborations.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  const handleShowEarnings = async (collabId: number) => {
    setSelectedCollabId(collabId);
    setIsLoadingEarnings(true);
    try {
      const data = await getCollaborationEarnings(collabId);
      setEarningsData(data);
      setShowEarnings(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load earnings data");
    } finally {
      setIsLoadingEarnings(false);
    }
  };

  const handleShowContract = async (collabId: number) => {
    setSelectedCollabId(collabId);
    setIsLoadingContract(true);
    try {
      const data = await getCollaborationContract(collabId);
      setContractData(data);
      setShowContract(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load contract data");
    } finally {
      setIsLoadingContract(false);
    }
  }

  useEffect(() => {
    void loadCollaborations();
  }, [loadCollaborations]);

  const cards = useMemo(() => collaborations.map(mapCollaborationForCard), [collaborations]);

  async function handleApprove(collaborationId: number): Promise<void> {
    if (!accessToken) {
      toast.error("Sign in to approve collaborations.");
      return;
    }

    setApprovingId(collaborationId);
    try {
      await approveCollaboration(accessToken, collaborationId);
      toast.success("Collaboration approval submitted.");
      await loadCollaborations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve collaboration.";
      toast.error(message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleAcceptRequest(requestId: number): Promise<void> {
    if (!accessToken) {
      toast.error("Sign in to accept collaboration requests.");
      return;
    }

    setApprovingId(requestId);
    try {
      await acceptCollaborationRequest(accessToken, requestId);
      toast.success("Collaboration request accepted.");
      await loadCollaborations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept collaboration request.");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRejectRequest(requestId: number): Promise<void> {
    if (!accessToken) {
      toast.error("Sign in to reject collaboration requests.");
      return;
    }

    setApprovingId(requestId);
    try {
      await rejectCollaborationRequest(accessToken, requestId);
      toast.success("Collaboration request rejected.");
      await loadCollaborations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject collaboration request.");
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <AppLayout title="Collaboration" subtitle="Transparent multi-party revenue splits">
      <div className="space-y-5 animate-fade-in">
        {!isAuthenticated && (
          <div className="stat-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Sign in to view and manage collaborations.</p>
          </div>
        )}

        {isAuthenticated && requests.length > 0 && (
          <div className="stat-card rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm text-foreground">Incoming Collaboration Requests</h3>
              <span className="text-xs text-muted-foreground">{requests.length} request{requests.length === 1 ? "" : "s"}</span>
            </div>
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="rounded-lg border border-border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{request.work_title}</p>
                    <p className="text-xs text-muted-foreground">From {request.requester_username} · Split {request.proposed_split_bps / 100}%</p>
                    {request.message && <p className="text-xs text-muted-foreground mt-1">{request.message}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleAcceptRequest(request.id)}
                      disabled={approvingId === request.id}
                      className="px-3 py-1.5 rounded-md text-xs bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      {approvingId === request.id ? "Accepting..." : "Accept"}
                    </button>
                    <button
                      onClick={() => void handleRejectRequest(request.id)}
                      disabled={approvingId === request.id}
                      className="px-3 py-1.5 rounded-md text-xs bg-muted text-muted-foreground disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{cards.length} collaborations</p>
          <button
            onClick={() => setNewCollabOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-teal"
          >
            <Plus className="h-3.5 w-3.5" />New Collaboration
          </button>
        </div>

        {/* Collaborations */}
        <div className="space-y-4">
          {isLoading && <div className="stat-card rounded-xl p-5 text-xs text-muted-foreground">Loading collaborations...</div>}
          {!isLoading && error && <div className="stat-card rounded-xl p-5 text-xs text-destructive">{error}</div>}
          {!isLoading && !error && cards.length === 0 && (
            <div className="stat-card rounded-xl p-5 text-xs text-muted-foreground">No collaborations yet.</div>
          )}

          {!isLoading && !error && cards.map((collab) => (
            <div key={collab.id} className="stat-card rounded-xl p-5" data-testid="collaboration-row">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-xl">{collab.emoji}</div>
                  <div>
                    <h3 className="font-display font-semibold text-sm text-foreground">{collab.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{collab.type}</span>
                      <span className="text-xs font-mono text-muted-foreground">COL-{String(collab.id).padStart(3, "0")}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${collab.status === "active" ? "badge-verified" : "badge-pending"}`}>
                        {collab.status === "active" ? "Active" : "Pending"}
                      </span>
                      <span className="text-xs text-muted-foreground">Approvals {collab.approvals}</span>
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
                    <div key={m.id} className={`${splitColors[i % splitColors.length]} h-full`} style={{ width: `${m.split}%` }} />
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
                  onClick={() => handleShowEarnings(collab.id)}
                  disabled={isLoadingEarnings}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-xs rounded-md hover:text-foreground transition-all disabled:opacity-50"
                >
                  {isLoadingEarnings ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <DollarSign className="h-3 w-3" />
                  )}
                  Earnings
                </button>
                <button
                  onClick={() => handleShowContract(collab.id)}
                  disabled={isLoadingContract}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-xs rounded-md hover:text-foreground transition-all disabled:opacity-50"
                >
                  {isLoadingContract ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  Contract
                </button>
                {collab.canApprove ? (
                  <button
                    onClick={() => {
                      void handleApprove(collab.id);
                    }}
                    disabled={approvingId === collab.id}
                    className="flex items-center gap-1 text-xs text-primary ml-auto hover:underline disabled:opacity-50"
                    data-testid="approve-collaboration"
                  >
                    {approvingId === collab.id ? "Approving..." : "Approve"} <ArrowRight className="h-3 w-3" />
                  </button>
                ) : (
                  <button
                    onClick={() => toast.info("Collaboration management coming soon")}
                    className="flex items-center gap-1 text-xs text-primary ml-auto hover:underline"
                  >
                    Manage <ArrowRight className="h-3 w-3" />
                  </button>
                )}
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

      {/* Earnings Breakdown Dialog */}
      <Dialog open={showEarnings} onOpenChange={setShowEarnings}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Earnings Breakdown</DialogTitle>
            <DialogDescription className="text-xs">Revenue distribution across members</DialogDescription>
          </DialogHeader>
          {earningsData && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
                <p className="text-2xl font-bold text-primary">{earningsData.total_earned.toFixed(2)} {earningsData.currency}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Member Shares</p>
                <div className="space-y-2">
                  {earningsData.members.map((member: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-xs font-medium text-foreground">{member.username}</p>
                        <p className="text-xs text-muted-foreground">{member.share_percentage}%</p>
                      </div>
                      <p className="text-xs font-semibold text-primary">{member.amount.toFixed(2)} {earningsData.currency}</p>
                    </div>
                  ))}
                </div>
              </div>
              {earningsData.last_distribution && (
                <p className="text-xs text-muted-foreground">Last distribution: {new Date(earningsData.last_distribution).toLocaleDateString()}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Smart Contract Details Dialog */}
      <Dialog open={showContract} onOpenChange={setShowContract}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Smart Contract Details</DialogTitle>
            <DialogDescription className="text-xs">View on-chain contract information</DialogDescription>
          </DialogHeader>
          {contractData && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Contract Address</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-foreground font-mono truncate">{contractData.address}</p>
                  <a
                    href={`https://amoy.polygonscan.com/address/${contractData.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 text-primary" />
                  </a>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Transaction Hash</p>
                <p className="text-xs text-foreground font-mono truncate">{contractData.tx_hash}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Block Number</p>
                <p className="text-xs text-foreground">{contractData.block_number}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Members</p>
                <div className="space-y-2">
                  {contractData.members.map((member: any, i: number) => (
                    <div key={i} className="p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-foreground">{member.username}</p>
                        <p className="text-xs text-primary font-semibold">{member.split_percentage}%</p>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">{member.wallet_address}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
