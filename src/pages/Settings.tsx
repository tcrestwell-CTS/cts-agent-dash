import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield, CreditCard, Link2, Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { Skeleton } from "@/components/ui/skeleton";

const Settings = () => {
  const { profile, loading, saving, saveProfile, uploadAvatar, userEmail } = useProfile();
  const { preferences, loading: notifLoading, updatePreference } = useNotificationPreferences();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    job_title: "",
    agency_name: "",
    commission_rate: 10,
  });

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name,
        phone: profile.phone,
        job_title: profile.job_title,
        agency_name: profile.agency_name,
        commission_rate: profile.commission_rate,
      });
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string | number) => {
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
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
          <TabsTrigger value="integrations" className="gap-2">
            <Link2 className="h-4 w-4" />
            Integrations
          </TabsTrigger>
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

                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title</Label>
                    <Input
                      id="title"
                      value={formData.job_title}
                      onChange={(e) => handleInputChange("job_title", e.target.value)}
                      placeholder="Travel Agent"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commissionRate">Default Commission Rate (%)</Label>
                    <Input
                      id="commissionRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formData.commission_rate}
                      onChange={(e) => handleInputChange("commission_rate", parseFloat(e.target.value) || 0)}
                    />
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
                        Commission Updates
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Notifications about commission payments
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input id="currentPassword" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input id="confirmPassword" type="password" />
                </div>
                <Button>Update Password</Button>
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
                Manage your subscription and payment methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-card-foreground">
                      Professional Plan
                    </p>
                    <p className="text-sm text-muted-foreground">
                      $49/month • Billed monthly
                    </p>
                  </div>
                  <Button variant="outline">Change Plan</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-card-foreground">
                  Payment Method
                </h4>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-14 rounded bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-center text-white text-xs font-bold">
                      VISA
                    </div>
                    <div>
                      <p className="font-medium text-card-foreground">
                        •••• •••• •••• 4242
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Expires 12/2027
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Update
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-bold">S</span>
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
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 font-bold">A</span>
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

              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <span className="text-purple-600 font-bold">Q</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">
                      QuickBooks
                    </p>
                    <p className="text-sm text-muted-foreground">Connected</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Disconnect
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Settings;
