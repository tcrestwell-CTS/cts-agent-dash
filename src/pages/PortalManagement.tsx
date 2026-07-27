import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePortalManagement } from "@/hooks/usePortalManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Users, Shield, Eye, RotateCcw, Search, MonitorSmartphone } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  trips: "My Trips",
  payments: "Payments",
  messages: "Messages",
  invoices: "Invoices",
};

export default function PortalManagement() {
  const { portalUsers, isLoading, updateSettings, resetSession, ALL_SECTIONS } =
    usePortalManagement();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [visibilityClient, setVisibilityClient] = useState<any | null>(null);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  const filtered = portalUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: portalUsers.length,
    active: portalUsers.filter((u) => u.hasPortalAccess).length,
    enabled: portalUsers.filter((u) => u.portalEnabled).length,
  };

  const openVisibilityDialog = (client: any) => {
    setVisibilityClient(client);
    setSelectedSections([...client.visibleSections]);
  };

  const saveVisibility = () => {
    if (!visibilityClient) return;
    updateSettings.mutate({
      clientId: visibilityClient.id,
      portalEnabled: visibilityClient.portalEnabled,
      visibleSections: selectedSections,
    });
    setVisibilityClient(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
            Crestwell Travel Services
          </p>
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">
            Client Portal Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage portal users, access, and visibility settings
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Clients</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <Shield className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">
                  Portal Logins
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <Eye className="h-8 w-8 text-info" />
              <div>
                <p className="text-2xl font-bold">{stats.enabled}</p>
                <p className="text-xs text-muted-foreground">
                  Access Enabled
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-lg">Portal Users</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">
                Loading...
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Portal Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Sections</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        No clients found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          {client.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {client.email || "—"}
                        </TableCell>
                        <TableCell>
                          {client.hasPortalAccess ? (
                            <Badge
                              variant="default"
                              className="bg-success/10 text-success border-success/20"
                            >
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Never Logged In</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {client.lastLogin
                            ? formatDistanceToNow(new Date(client.lastLogin), {
                                addSuffix: true,
                              })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={client.portalEnabled}
                            onCheckedChange={(checked) =>
                              updateSettings.mutate({
                                clientId: client.id,
                                portalEnabled: checked,
                                visibleSections: client.visibleSections,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openVisibilityDialog(client)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            {client.visibleSections.length}/{ALL_SECTIONS.length}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/portal-preview/${client.id}`)}
                            >
                              <MonitorSmartphone className="h-3.5 w-3.5 mr-1" />
                              Preview
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resetSession.mutate(client.id)}
                              disabled={!client.hasPortalAccess}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Reset
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section Visibility Dialog */}
      <Dialog
        open={!!visibilityClient}
        onOpenChange={(open) => !open && setVisibilityClient(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Visible Sections — {visibilityClient?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {ALL_SECTIONS.map((section) => (
              <label
                key={section}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Checkbox
                  checked={selectedSections.includes(section)}
                  onCheckedChange={(checked) =>
                    setSelectedSections((prev) =>
                      checked
                        ? [...prev, section]
                        : prev.filter((s) => s !== section)
                    )
                  }
                />
                <span className="text-sm font-medium">
                  {SECTION_LABELS[section] || section}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVisibilityClient(null)}
            >
              Cancel
            </Button>
            <Button onClick={saveVisibility}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
