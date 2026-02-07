import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Mail, Phone, MapPin } from "lucide-react";

const contacts = [
  {
    id: 1,
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    phone: "+1 (555) 123-4567",
    location: "New York, NY",
    status: "active",
    totalBookings: 8,
    totalSpent: "$45,200",
  },
  {
    id: 2,
    name: "Michael Chen",
    email: "m.chen@email.com",
    phone: "+1 (555) 234-5678",
    location: "San Francisco, CA",
    status: "lead",
    totalBookings: 0,
    totalSpent: "$0",
  },
  {
    id: 3,
    name: "Emma Williams",
    email: "emma.w@email.com",
    phone: "+1 (555) 345-6789",
    location: "Chicago, IL",
    status: "active",
    totalBookings: 12,
    totalSpent: "$78,400",
  },
  {
    id: 4,
    name: "David Brown",
    email: "david.b@email.com",
    phone: "+1 (555) 456-7890",
    location: "Miami, FL",
    status: "inactive",
    totalBookings: 3,
    totalSpent: "$12,600",
  },
  {
    id: 5,
    name: "Lisa Anderson",
    email: "lisa.a@email.com",
    phone: "+1 (555) 567-8901",
    location: "Seattle, WA",
    status: "active",
    totalBookings: 5,
    totalSpent: "$28,900",
  },
];

const CRM = () => {
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            Client Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your clients and track their journey
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              All
            </Button>
            <Button variant="ghost" size="sm">
              Active
            </Button>
            <Button variant="ghost" size="sm">
              Leads
            </Button>
            <Button variant="ghost" size="sm">
              Inactive
            </Button>
          </div>
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="bg-card rounded-xl p-5 shadow-card border border-border/50 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-semibold text-primary">
                    {contact.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-card-foreground">
                    {contact.name}
                  </p>
                  <Badge
                    variant="secondary"
                    className={
                      contact.status === "active"
                        ? "bg-success/10 text-success"
                        : contact.status === "lead"
                        ? "bg-accent/10 text-accent"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {contact.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{contact.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{contact.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{contact.location}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Bookings</p>
                <p className="font-semibold text-card-foreground">
                  {contact.totalBookings}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="font-semibold text-card-foreground">
                  {contact.totalSpent}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default CRM;
