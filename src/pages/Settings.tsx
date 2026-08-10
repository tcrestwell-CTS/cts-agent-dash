import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield, CreditCard, Link2, Loader2, TrendingUp, Percent, Building2, Settings2, Columns3, Banknote, AlertCircle, Store } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { Skeleton } from "@/components/ui/skeleton";
import { getTierConfig, getNextTier, COMMISSION_TIERS } from "@/lib/commissionTiers";
import { useAgentPayoutAccount } from "@/hooks/useAgentPayoutAccount";
import { Badge } from "@/components/ui/badge";
import { QBOIntegrationCard } from "@/components/settings/QBOIntegrationCard";
import { QBOAccountMappingCard } from "@/components/settings/QBOAccountMappingCard";
import { AgencySettingsTab } from "@/components/settings/AgencySettingsTab";
import { MarginEngineSettings } from "@/components/settings/MarginEngineSettings";
import { BackfillPlanningTripsCard } from "@/components/admin/BackfillPlanningTripsCard";
import { TripStatusesSettings } from "@/components/settings/TripStatusesSettings";
import { AgentPayoutSettings } from "@/components/settings/AgentPayoutSettings";
import { usePermissions } from "@/hooks/usePermissions";
import { useEarningsLabel } from "@/hooks/useEarningsLabel";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { StorefrontLogoUpload } from "@/components/storefront/StorefrontLogoUpload";
import { toast } from "sonner";

const Settings = () => {
  const { profile, loading, saving, saveProfile, uploadAvatar, userEmail } = useProfile();
  const { preferences, loading: notifLoading, updatePreference } = useNotificationPreferences();
  const { isAdmin } = usePermissions();
  const earnings = useEarningsLabel();
  const { data: payoutAccount } = useAgentPayoutAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    job_title: "",
    agency_name: "",
    commission_rate: 10,
    clia_number: "",
    ccra_number: "",
    asta_number: "",
    embarc_number: "",
    storefront_enabled: false,
    storefront_slug: "",
    storefront_headline: "Your Personal Cruise & Vacation Expert",
    storefront_logo_url: "",
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const isOAuthOnly = !user?.identities?.some((i) => i.provider === "email");

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name,
        phone: profile.phone,
        job_title: profile.job_title,
        agency_name: profile.agency_name,
        commission_rate: profile.commission_rate,
        clia_number: profile.clia_number,
        ccra_number: profile.ccra_number,
        asta_number: profile.asta_number,
        embarc_number: profile.embarc_number,
        storefront_enabled: profile.storefront_enabled,
        storefront_slug: profile.storefront_slug,
        storefront_headline: profile.storefront_headline,
        storefront_logo_url: profile.storefront_logo_url || "",
      });
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    await saveProfile(formData);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAvatar(file);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
          Crestwell Travel Services
        </p>
        <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Settings</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="payout" className="gap-2">
            <Banknote className="h-4 w-4" />
            Payout
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Link2 className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="statuses" className="gap-2">
            <Columns3 className="h-4 w-4" />
            Statuses
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="agency" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Agency
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="storefront" className="gap-2">
              <Store className="h-4 w-4" />
              Storefront
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-6">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarChange}
                      accept="image/*"
                      className="hidden"
                    />
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Avatar"
                        className="h-20 w-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-2xl font-semibold text-primary">
                          {getInitials(formData.full_name)}
                        </span>
                      </div>
                    )}
                    <Button variant="outline" onClick={handleAvatarClick}>
                      Change Photo
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={formData.full_name}
                      onChange={(e) => handleInputChange("full_name", e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={userEmail}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email is managed through your authentication provider
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agency">Agency Name</Label>
                    <Input
                      id="agency"
                      value={formData.agency_name}
                      onChange={(e) => handleInputChange("agency_name", e.target.value)}
                      placeholder="Your agency name"
                    />
                  </div>

                  {/* Certification Numbers */}
                  <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
                    <h3 className="font-medium text-card-foreground">Certification Numbers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="clia">CLIA #</Label>
                        <Input
                          id="clia"
                          value={formData.clia_number}
                          onChange={(e) => handleInputChange("clia_number", e.target.value)}
                          placeholder="e.g. 00048158"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ccra">CCRA #</Label>
                        <Input
                          id="ccra"
                          value={formData.ccra_number}
                          onChange={(e) => handleInputChange("ccra_number", e.target.value)}
                          placeholder="e.g. 99933757"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="asta">ASTA #</Label>
                        <Input
                          id="asta"
                          value={formData.asta_number}
                          onChange={(e) => handleInputChange("asta_number", e.target.value)}
                          placeholder="e.g. 900391006"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="embarc">Embarc ID</Label>
                        <Input
                          id="embarc"
                          value={formData.embarc_number}
                          onChange={(e) => handleInputChange("embarc_number", e.target.value)}
                          placeholder="e.g. EMB-12345"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These will be displayed on shared trip pages alongside your advisor card.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title</Label>
                    <Input
                      id="title"
                      value={formData.job_title}
                      onChange={(e) => handleInputChange("job_title", e.target.value)}
                      placeholder="Travel Agent"
                    />
                  </div>

                  {/* Commission Tier Info - Read Only */}
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <h3 className="font-medium text-card-foreground">Your {earnings.singular} Tier</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-background rounded-lg p-3 border">
                        <p className="text-xs text-muted-foreground mb-1">Tier Level</p>
                        <p className="text-lg font-semibold text-foreground">
                          {isAdmin ? "Owner / Company" : getTierConfig(profile.commission_tier).label}
                        </p>
                      </div>
                      <div className="bg-background rounded-lg p-3 border">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Percent className="h-3 w-3" />
                          Your {earnings.singular}
                        </div>
                        <p className="text-lg font-semibold text-success">
                          {isAdmin ? 0 : getTierConfig(profile.commission_tier).agentSplit}%
                        </p>
                      </div>
                      <div className="bg-background rounded-lg p-3 border">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Building2 className="h-3 w-3" />
                          Agency Split
                        </div>
                        <p className="text-lg font-semibold text-foreground">
                          {isAdmin ? 100 : getTierConfig(profile.commission_tier).agencySplit}%
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      {isAdmin
                        ? `As the agency owner, all booking ${earnings.pluralLower} are retained as company income (100% agency).`
                        : `Your ${earnings.singularLower} tier determines how booking ${earnings.pluralLower} are split between you and the agency. Contact an administrator if you believe your tier should be changed.`}
                    </p>
                  </div>

                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose what notifications you receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {notifLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-6 w-11 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-card-foreground">
                        New Booking Alerts
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Get notified when a new booking is made
                      </p>
                    </div>
                    <Switch 
                      checked={preferences.new_booking_alerts}
                      onCheckedChange={(checked) => updatePreference("new_booking_alerts", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-card-foreground">
                        {earnings.singular} Updates
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Notifications about {earnings.singularLower} payments
                      </p>
                    </div>
                    <Switch 
                      checked={preferences.commission_updates}
                      onCheckedChange={(checked) => updatePreference("commission_updates", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-card-foreground">
                        Client Messages
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Get notified about new client inquiries
                      </p>
                    </div>
                    <Switch 
                      checked={preferences.client_messages}
                      onCheckedChange={(checked) => updatePreference("client_messages", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-card-foreground">
                        Training Reminders
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Reminders about incomplete courses
                      </p>
                    </div>
                    <Switch 
                      checked={preferences.training_reminders}
                      onCheckedChange={(checked) => updatePreference("training_reminders", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-card-foreground">
                        Marketing Emails
                      </p>
                      <p className="text-sm text-muted-foreground">
                        News, tips, and promotional content
                      </p>
                    </div>
                    <Switch 
                      checked={preferences.marketing_emails}
                      onCheckedChange={(checked) => updatePreference("marketing_emails", checked)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your password and security options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isOAuthOnly && (
                <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/20 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-info mt-0.5 shrink-0" />
                  <p className="text-sm text-info">
                    You signed in with Google OAuth and don't have a password yet. Set one below so you can decrypt credit card info when needed.
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {!isOAuthOnly && (
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{isOAuthOnly ? "Set Password" : "New Password"}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={isOAuthOnly ? "Create a password" : "Enter new password"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>
                <Button onClick={handleUpdatePassword} disabled={updatingPassword || !newPassword || !confirmPassword}>
                  {updatingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isOAuthOnly ? "Set Password" : "Update Password"}
                </Button>
              </div>

              <div className="pt-6 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-card-foreground">
                      Two-Factor Authentication
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Button variant="outline">Enable 2FA</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Billing & Subscription</CardTitle>
              <CardDescription>
                Your current plan and how you get paid
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-card-foreground">
                            {isAdmin
                              ? "Owner / Agency Plan"
                              : `${getTierConfig(profile.commission_tier).label} Plan`}
                          </p>
                          <Badge variant="outline" className="text-xs">Active</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isAdmin
                            ? "No subscription fee • 100% agency margin"
                            : `No subscription fee • ${getTierConfig(profile.commission_tier).description}`}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        Plans are commission-based. Your split is set by an admin in Team
                        Management.
                      </p>
                    </div>
                  </div>

                  {!isAdmin && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="p-4 border border-border rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Your {earnings.singularLower} split
                        </p>
                        <p className="text-xl font-semibold text-card-foreground">
                          {getTierConfig(profile.commission_tier).agentSplit}%
                        </p>
                      </div>
                      <div className="p-4 border border-border rounded-lg">
                        <p className="text-sm text-muted-foreground">Agency share</p>
                        <p className="text-xl font-semibold text-card-foreground">
                          {getTierConfig(profile.commission_tier).agencySplit}%
                        </p>
                      </div>
                    </div>
                  )}

                  {!isAdmin && getNextTier(profile.commission_tier) && (
                    <p className="text-sm text-muted-foreground">
                      Next tier:{" "}
                      <span className="text-card-foreground font-medium">
                        {COMMISSION_TIERS[getNextTier(profile.commission_tier)!].label}
                      </span>{" "}
                      — {COMMISSION_TIERS[getNextTier(profile.commission_tier)!].description}
                    </p>
                  )}

                  <div className="space-y-3">
                    <h4 className="font-medium text-card-foreground">Payout Method</h4>
                    <div className="p-4 border border-border rounded-lg">
                      <p className="font-medium text-card-foreground capitalize">
                        {payoutAccount?.payout_method
                          ? payoutAccount.payout_method === "ach"
                            ? "ACH Direct Deposit"
                            : payoutAccount.payout_method
                          : "Not set up"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payoutAccount?.account_number_last4
                          ? `${payoutAccount.bank_name || "Bank account"} •••• ${payoutAccount.account_number_last4}`
                          : payoutAccount?.zelle_handle ||
                            payoutAccount?.paypal_email ||
                            payoutAccount?.venmo_handle ||
                            "Add your payout details in the Payout tab to receive payments"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payout">
          <AgentPayoutSettings />
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>Connected Integrations</CardTitle>
              <CardDescription>
                Manage your third-party connections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                    <span className="text-info font-bold">S</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">
                      Sabre GDS
                    </p>
                    <p className="text-sm text-muted-foreground">Connected</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Disconnect
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <span className="text-success font-bold">A</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">
                      Amadeus
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Not connected
                    </p>
                  </div>
                </div>
                <Button size="sm">Connect</Button>
              </div>

              <QBOIntegrationCard />
              <QBOAccountMappingCard />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statuses">
          <TripStatusesSettings />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="agency">
            <div className="space-y-8">
              <AgencySettingsTab />
              <MarginEngineSettings />
              <BackfillPlanningTripsCard />
            </div>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="storefront">
            <Card>
            <CardHeader>
              <CardTitle>Agent Storefront</CardTitle>
              <CardDescription>
                Enable a public landing page that clients can visit to learn more about you and start a trip request.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="space-y-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                    <div>
                      <p className="font-medium text-card-foreground">Enable Storefront</p>
                      <p className="text-sm text-muted-foreground">
                        When enabled, clients can view your public page and submit trip requests.
                      </p>
                    </div>
                    <Switch
                      checked={formData.storefront_enabled}
                      onCheckedChange={(checked) => handleInputChange("storefront_enabled", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Storefront Name</Label>
                    <Input value={formData.agency_name} disabled placeholder="Set your agency name in the Profile tab" />
                    <p className="text-xs text-muted-foreground">
                      Your agency name is used as your storefront name. Change it in the Profile tab.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storefrontSlug">Storefront Subdomain</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="storefrontSlug"
                        value={formData.storefront_slug}
                        onChange={(e) => handleInputChange("storefront_slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                        placeholder="agentcompany"
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">.crestwelltravels.com</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!formData.agency_name}
                      onClick={() =>
                        handleInputChange(
                          "storefront_slug",
                          formData.agency_name
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-+|-+$/g, ""),
                        )
                      }
                    >
                      Use agency name
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Use only lowercase letters, numbers, and hyphens. This becomes your public storefront subdomain.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storefrontHeadline">Headline</Label>
                    <Input
                      id="storefrontHeadline"
                      value={formData.storefront_headline}
                      onChange={(e) => handleInputChange("storefront_headline", e.target.value)}
                      placeholder="Your Personal Cruise & Vacation Expert"
                    />
                    <p className="text-xs text-muted-foreground">
                      Shown at the top of your storefront page.
                    </p>
                  </div>

                  <StorefrontLogoUpload
                    userId={user?.id}
                    value={formData.storefront_logo_url || null}
                    onChange={(url) => handleInputChange("storefront_logo_url", url ?? "")}
                  />

                  <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-2">
                    <p className="text-sm font-medium text-card-foreground">Live Storefront URL</p>
                    <p className="text-sm text-muted-foreground">
                      {formData.storefront_enabled && formData.storefront_slug
                        ? `https://${formData.storefront_slug}.crestwelltravels.com`
                        : "Enable your storefront and enter a subdomain to generate the public link."}
                    </p>
                  </div>

                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Storefront Settings
                  </Button>
                </>
              )}
            </CardContent>
            </Card>
          </TabsContent>
        )}

      </Tabs>
    </DashboardLayout>
  );
};

export default Settings;
