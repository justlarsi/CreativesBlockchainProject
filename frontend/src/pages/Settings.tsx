import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { useWallet } from "@/hooks/useWallet";
import { User, Wallet, Bell, Shield, Globe, Copy, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { shortenAddress } from "@/blockchain/wallet";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState({
    name: "Amara Kamau",
    email: "amara@creativechain.io",
    bio: "Digital artist & photographer based in Nairobi. Passionate about preserving African creative heritage through blockchain technology.",
    location: "Nairobi, Kenya",
    website: "https://amarakamau.art",
  });
  const [notifications, setNotifications] = useState({
    infringement: true,
    licensing: true,
    collaboration: true,
    marketing: false,
    weekly: true,
  });
  const { wallets, isConnected, isCorrectChain, error: walletError } = useWallet();

  const primaryWallet = wallets.find((item) => item.is_primary);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <AppLayout title="Settings" subtitle="Manage your account">
      <div className="max-w-3xl animate-fade-in">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-all -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="space-y-5">
            <div className="stat-card rounded-xl p-5">
              <div className="flex items-center gap-4 mb-5">
                <div className="h-16 w-16 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">AK</span>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm text-foreground">{profile.name}</h3>
                  <p className="text-xs text-muted-foreground">Creator Pro · Member since Jan 2025</p>
                  <button className="text-xs text-primary mt-1 hover:underline">Change avatar</button>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { label: "Full Name", key: "name" as const },
                  { label: "Email", key: "email" as const },
                  { label: "Location", key: "location" as const },
                  { label: "Website", key: "website" as const },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
                    <input
                      value={profile[field.key]}
                      onChange={(e) => setProfile({ ...profile, [field.key]: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Bio</label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all resize-none"
                  />
                </div>
              </div>

              <button
                onClick={() => toast.success("Profile updated successfully")}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Wallet Tab */}
        {activeTab === "wallet" && (
          <div className="space-y-4">
            <div className="stat-card rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-display font-semibold text-sm">Connected Wallet</h3>
                <WalletConnect />
              </div>

              {primaryWallet ? (
                <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Wallet className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">Primary Wallet</p>
                      <p className="text-xs font-mono text-muted-foreground">{shortenAddress(primaryWallet.address)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(primaryWallet.address)}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mb-4">No verified wallet linked yet.</p>
              )}

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
                <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {isConnected && isCorrectChain
                    ? "Connected on Polygon Amoy. Use Verify to securely link this wallet."
                    : "Connect wallet and switch to Polygon Amoy to continue."}
                </p>
              </div>
              {walletError && <p className="text-xs text-destructive mt-3">{walletError}</p>}
            </div>

            <div className="stat-card rounded-xl p-5">
              <h3 className="font-display font-semibold text-sm mb-3">Payment Methods</h3>
              <div className="space-y-2">
                {[
                  { method: "M-Pesa", detail: "+254 *** *** 890", active: true },
                  { method: "MATIC (Polygon)", detail: "Native token", active: true },
                ].map((pm, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-medium text-foreground">{pm.method}</p>
                        <p className="text-xs text-muted-foreground">{pm.detail}</p>
                      </div>
                    </div>
                    <span className="text-xs badge-verified px-2 py-0.5 rounded-full">Active</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => toast.info("Payment method setup coming soon")}
                className="mt-3 text-xs text-primary hover:underline"
              >
                + Add payment method
              </button>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <div className="stat-card rounded-xl p-5">
            <h3 className="font-display font-semibold text-sm mb-4">Notification Preferences</h3>
            <div className="space-y-3">
              {[
                { key: "infringement" as const, label: "Infringement Alerts", desc: "Get notified when unauthorized use is detected" },
                { key: "licensing" as const, label: "License Activity", desc: "New purchases, renewals, and expirations" },
                { key: "collaboration" as const, label: "Collaboration Updates", desc: "Invitations, revenue distributions, and contract changes" },
                { key: "marketing" as const, label: "Product Updates", desc: "Feature announcements and platform news" },
                { key: "weekly" as const, label: "Weekly Digest", desc: "Summary of your activity and earnings" },
              ].map((pref) => (
                <div key={pref.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs font-medium text-foreground">{pref.label}</p>
                    <p className="text-xs text-muted-foreground">{pref.desc}</p>
                  </div>
                  <button
                    onClick={() => {
                      setNotifications({ ...notifications, [pref.key]: !notifications[pref.key] });
                      toast.success(`${pref.label} ${notifications[pref.key] ? "disabled" : "enabled"}`);
                    }}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      notifications[pref.key] ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-transform ${
                        notifications[pref.key] ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="space-y-4">
            <div className="stat-card rounded-xl p-5">
              <h3 className="font-display font-semibold text-sm mb-4">Account Security</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs font-medium text-foreground">Two-Factor Authentication</p>
                    <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <button
                    onClick={() => toast.info("2FA setup coming soon")}
                    className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all"
                  >
                    Enable
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs font-medium text-foreground">Change Password</p>
                    <p className="text-xs text-muted-foreground">Last changed 30 days ago</p>
                  </div>
                  <button
                    onClick={() => toast.info("Password change coming soon")}
                    className="px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-md hover:text-foreground transition-all"
                  >
                    Update
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs font-medium text-foreground">Active Sessions</p>
                    <p className="text-xs text-muted-foreground">2 devices currently signed in</p>
                  </div>
                  <button
                    onClick={() => toast.info("Session management coming soon")}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="stat-card rounded-xl p-5 border-destructive/20">
              <h3 className="font-display font-semibold text-sm text-destructive mb-2">Danger Zone</h3>
              <p className="text-xs text-muted-foreground mb-3">Permanently delete your account and all associated data.</p>
              <button
                onClick={() => toast.error("Account deletion requires confirmation via email")}
                className="px-3 py-1.5 text-xs font-medium bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition-all"
              >
                Delete Account
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
