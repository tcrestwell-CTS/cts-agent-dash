import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Edit2,
  Mail,
  Phone,
  MapPin,
  Cake,
  Heart,
  Plane,
  Ship,
  Building,
  Shield,
  Utensils,
  Star,
  Tag,
  FileText,
  Copy,
  Trash2,
} from "lucide-react";
import { useClient, useDeleteClient } from "@/hooks/useClients";
import { EditClientDialog } from "@/components/crm/EditClientDialog";
import { useState } from "react";
import { format, differenceInYears } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ClientDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading, error } = useClient(clientId!);
  const deleteClient = useDeleteClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return format(new Date(date), "MMMM d, yyyy");
  };

  const formatBirthdayWithAge = (birthday: string | null) => {
    if (!birthday) return null;
    const date = new Date(birthday);
    const age = differenceInYears(new Date(), date);
    return `${format(date, "MMMM d, yyyy")} (${age} years old)`;
  };

  const getPreferenceLabel = (value: string | null) => {
    if (!value || value === "no_preference") return "None";
    return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
  };

  const handleDelete = async () => {
    if (!client) return;
    await deleteClient.mutateAsync(client.id);
    navigate("/crm");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !client) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive font-medium">Client not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/crm")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const fullName = client.title
    ? `${client.title} ${client.first_name || ""} ${client.last_name || ""}`.trim()
    : client.name;

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const hasAddress =
    client.address_line_1 ||
    client.address_city ||
    client.address_state ||
    client.address_zip_code ||
    client.address_country;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/crm")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-semibold text-primary">{initials}</span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-foreground tracking-tight">
                {fullName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className={
                    client.status === "active"
                      ? "bg-success/10 text-success"
                      : client.status === "lead"
                      ? "bg-accent/10 text-accent"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {client.status}
                </Badge>
                {client.tags && (
                  <span className="text-sm text-muted-foreground">{client.tags}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Client</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {fullName}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => setEditDialogOpen(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Client
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow
              label="Legal Name"
              value={`${client.first_name || ""} ${client.last_name || ""}`.trim() || client.name}
            />
            {client.preferred_first_name && (
              <InfoRow label="Goes By" value={client.preferred_first_name} />
            )}
            <InfoRow
              label="Birthday"
              value={formatBirthdayWithAge(client.birthday)}
              icon={<Cake className="h-4 w-4 text-muted-foreground" />}
            />
            <InfoRow
              label="Anniversary"
              value={formatDate(client.anniversary)}
              icon={<Heart className="h-4 w-4 text-muted-foreground" />}
            />
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.email && (
              <ContactRow
                label="Primary Email"
                value={client.email}
                icon={<Mail className="h-4 w-4 text-muted-foreground" />}
                onCopy={() => copyToClipboard(client.email!, "Email")}
              />
            )}
            {client.secondary_email && (
              <ContactRow
                label="Secondary Email"
                value={client.secondary_email}
                icon={<Mail className="h-4 w-4 text-muted-foreground" />}
                onCopy={() => copyToClipboard(client.secondary_email!, "Email")}
              />
            )}
            {client.phone && (
              <ContactRow
                label="Primary Phone"
                value={client.phone}
                icon={<Phone className="h-4 w-4 text-muted-foreground" />}
                onCopy={() => copyToClipboard(client.phone!, "Phone")}
              />
            )}
            {client.secondary_phone && (
              <ContactRow
                label="Secondary Phone"
                value={client.secondary_phone}
                icon={<Phone className="h-4 w-4 text-muted-foreground" />}
                onCopy={() => copyToClipboard(client.secondary_phone!, "Phone")}
              />
            )}
            {!client.email && !client.phone && (
              <p className="text-muted-foreground text-sm italic">No contact info added</p>
            )}
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasAddress ? (
              <div className="text-sm space-y-1">
                {client.address_line_1 && <p>{client.address_line_1}</p>}
                {client.address_line_2 && <p>{client.address_line_2}</p>}
                <p>
                  {[client.address_city, client.address_state, client.address_zip_code]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {client.address_country && <p>{client.address_country}</p>}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">No address added</p>
            )}
          </CardContent>
        </Card>

        {/* Secure Travel IDs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Secure Travel IDs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="Redress Number" value={client.redress_number} />
            <InfoRow label="Known Traveler Number" value={client.known_traveler_number} />
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">Passport(s)</p>
              {client.passport_info ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {client.passport_info}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">None added</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Star className="h-4 w-4" />
              Interests & Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Activities & Interests</p>
              <p className="text-sm text-muted-foreground">
                {client.activities_interests || "None at the moment."}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-1 flex items-center gap-2">
                <Utensils className="h-4 w-4" />
                Food, Drink & Allergies
              </p>
              <p className="text-sm text-muted-foreground">
                {client.food_drink_allergies || "None at the moment."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Travel Preferences */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Travel Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Plane className="h-4 w-4" />
                Flight Preferences
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Seating:</span>{" "}
                  {getPreferenceLabel(client.flight_seating_preference)}
                </div>
                <div>
                  <span className="text-muted-foreground">Bulkhead:</span>{" "}
                  {getPreferenceLabel(client.flight_bulkhead_preference)}
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Building className="h-4 w-4" />
                Lodging Preferences
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Floor:</span>{" "}
                  {getPreferenceLabel(client.lodging_floor_preference)}
                </div>
                <div>
                  <span className="text-muted-foreground">Elevator:</span>{" "}
                  {getPreferenceLabel(client.lodging_elevator_preference)}
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Ship className="h-4 w-4" />
                Cruise Preferences
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Cabin Floor:</span>{" "}
                  {getPreferenceLabel(client.cruise_cabin_floor_preference)}
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span>{" "}
                  {getPreferenceLabel(client.cruise_cabin_location_preference)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loyalty Programs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Loyalty Programs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {client.loyalty_programs ? (
              <p className="text-sm whitespace-pre-wrap">{client.loyalty_programs}</p>
            ) : (
              <p className="text-muted-foreground text-sm italic">No loyalty programs added</p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {client.notes ? (
              <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
            ) : (
              <p className="text-muted-foreground text-sm italic">No notes added</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <EditClientDialog
        client={client}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </DashboardLayout>
  );
};

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || "Unknown"}</p>
      </div>
    </div>
  );
}

function ContactRow({
  label,
  value,
  icon,
  onCopy,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium">{value}</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default ClientDetail;
