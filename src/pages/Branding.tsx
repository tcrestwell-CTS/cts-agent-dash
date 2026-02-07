import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Palette, FileText, Eye, Upload, Send, Image } from "lucide-react";

const Branding = () => {
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            Email & Branding
          </h1>
          <p className="text-muted-foreground mt-1">
            Customize your communications and brand identity
          </p>
        </div>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="templates" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="h-4 w-4" />
            Brand Settings
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Template List */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Welcome Email</CardTitle>
                  <CardDescription>New client onboarding</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <Button size="sm" className="flex-1 gap-1">
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Booking Confirmation</CardTitle>
                  <CardDescription>Sent after booking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <Button size="sm" className="flex-1 gap-1">
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Travel Itinerary</CardTitle>
                  <CardDescription>Trip details & schedule</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <Button size="sm" className="flex-1 gap-1">
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quote Proposal</CardTitle>
                  <CardDescription>Price estimates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <Button size="sm" className="flex-1 gap-1">
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Email Editor Preview */}
            <div className="lg:col-span-2 bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-card-foreground">
                    Email Preview
                  </h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Send className="h-4 w-4" />
                      Send Test
                    </Button>
                    <Button size="sm">Save Changes</Button>
                  </div>
                </div>
              </div>
              <div className="p-8">
                <div className="max-w-lg mx-auto bg-background rounded-lg border border-border p-8">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-4">
                      <span className="text-xl font-semibold text-foreground">
                        Crestwell Travel Services
                      </span>
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">
                    Welcome Aboard! 🌍
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    Dear [Client Name],
                  </p>
                  <p className="text-muted-foreground mb-4">
                    Thank you for choosing Crestwell Travel Services for your upcoming
                    adventure. We're thrilled to help you create unforgettable
                    travel memories.
                  </p>
                  <p className="text-muted-foreground mb-6">
                    Your dedicated travel consultant is ready to craft the
                    perfect itinerary for you.
                  </p>
                  <Button className="w-full">View Your Dashboard</Button>
                  <p className="text-sm text-muted-foreground mt-6 text-center">
                    Questions? Reply to this email or call us at (555) 123-4567
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Brand Identity</CardTitle>
                <CardDescription>
                  Customize your agency's visual identity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Agency Logo</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Image className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="text-sm">
                        <span className="text-primary font-medium cursor-pointer">
                          Upload logo
                        </span>{" "}
                        <span className="text-muted-foreground">
                          or drag and drop
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG or SVG up to 2MB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agency-name">Agency Name</Label>
                  <Input id="agency-name" defaultValue="Crestwell Travel Services" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    defaultValue="Your Journey, Our Passion"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-primary" />
                      <Input defaultValue="#0D7377" className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-accent" />
                      <Input defaultValue="#E8763A" className="flex-1" />
                    </div>
                  </div>
                </div>

                <Button className="w-full">Save Brand Settings</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>
                  Details shown in client communications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue="hello@tern.travel"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" defaultValue="+1 (555) 123-4567" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Business Address</Label>
                  <Textarea
                    id="address"
                    defaultValue="123 Travel Way, Suite 100&#10;New York, NY 10001"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" defaultValue="https://tern.travel" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input id="instagram" defaultValue="@tern.travel" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook</Label>
                    <Input id="facebook" defaultValue="terntravel" />
                  </div>
                </div>

                <Button className="w-full">Update Contact Info</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-card-foreground mb-1">
                    Terms & Conditions
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Booking policies and terms
                  </p>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <Upload className="h-4 w-4" />
                    Upload New
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-accent" />
                  </div>
                  <h3 className="font-semibold text-card-foreground mb-1">
                    Travel Insurance Info
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Insurance options & details
                  </p>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <Upload className="h-4 w-4" />
                    Upload New
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-xl bg-success/10 flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-success" />
                  </div>
                  <h3 className="font-semibold text-card-foreground mb-1">
                    Client Questionnaire
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Travel preference form
                  </p>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <Upload className="h-4 w-4" />
                    Upload New
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Branding;
