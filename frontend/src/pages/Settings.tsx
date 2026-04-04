import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/context/AuthContext";
import { User, Wallet, Bell, Shield, Globe, Copy, CheckCircle, ExternalLink, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { shortenAddress } from "@/blockchain/wallet";
import { updateProfile, changePassword } from "@/api/auth";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
];

export default function Settings() {
  const { user, isAuthenticated, token } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    bio: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [notifications, setNotifications] = useState({
    infringement: true,
    licensing: true,
    collaboration: true,
    marketing: false,
    weekly: true,
  });
  const { wallets, isConnected, isCorrectChain, error: walletError } = useWallet();

  // Load user data on mount
  useEffect(() => {
    if (user) {
      setProfile({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        bio: user.bio || "",
      });
    }
  }, [user]);

  const primaryWallet = wallets.find((item) => item.is_primary);

  const getInitials = (firstName: string, lastName: string) => {
    const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
    return initials || (user?.username?.slice(0, 2).toUpperCase() || "U");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleSaveProfile = async () => {
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile(
        {
          first_name: profile.first_name,
          last_name: profile.last_name,
          bio: profile.bio,
        },
        token,
      );
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    if (!passwordData.current_password || !passwordData.new_password) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(
        {
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
        },
        token,
      );
      toast.success("Password changed successfully");
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
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
                  <span className="text-lg font-bold text-primary">{getInitials(profile.first_name, profile.last_name)}</span>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm text-foreground">{`${profile.first_name} ${profile.last_name}`.trim() || "User"}</h3>
                  <p className="text-xs text-muted-foreground">
                    {isAuthenticated ? `Member since ${user?.date_joined ? new Date(user.date_joined).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : ""}` : "Not authenticated"}
                  </p>
                  <button className="text-xs text-primary mt-1 hover:underline">Change avatar</button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name</label>
                    <input
                      value={profile.first_name}
                      onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name</label>
                    <input
                      value={profile.last_name}
                      onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                  <input
                    value={profile.email}
                    disabled
                    className="w-full px-3 py-2 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
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
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : "Save Changes"}
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
                    {pm.active && <span className="text-xs badge-verified px-2 py-0.5 rounded-full">Active</span>}
                  </div>
                ))}
              </div>
              <button
                onClick={() => toast.info("Payment method setup coming in the next release")}
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
              <h3 className="font-display font-semibold text-sm mb-4">Change Password</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                      className="w-full px-3 py-2 pr-10 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
                      placeholder="Enter your current password"
                    />
                    <button
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.current ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">New Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      className="w-full px-3 py-2 pr-10 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
                      placeholder="Enter new password (min 8 characters)"
                    />
                    <button
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.new ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      className="w-full px-3 py-2 pr-10 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground transition-all"
                      placeholder="Confirm new password"
                    />
                    <button
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.confirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={handleChangePassword}
                disabled={isChangingPassword}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChangingPassword ? "Updating..." : "Change Password"}
              </button>
            </div>

            <div className="stat-card rounded-xl p-5">
              <h3 className="font-display font-semibold text-sm mb-4">Account Security</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs font-medium text-foreground">Two-Factor Authentication</p>
                    <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <button
                    onClick={() => toast.info("2FA setup coming in the next release")}
                    className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all"
                  >
                    Enable
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs font-medium text-foreground">Active Sessions</p>
                    <p className="text-xs text-muted-foreground">1 device currently signed in</p>
                  </div>
                  <button
                    onClick={() => toast.info("Session management coming in the next release")}
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
