import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useBusinessContacts, BusinessContact } from "@/hooks/useBusinessContacts";
import { AddBusinessContactDialog } from "@/components/business-contacts/AddBusinessContactDialog";
import { ImportBusinessContactsDialog } from "@/components/business-contacts/ImportBusinessContactsDialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Search, Trash2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600",
  contacted: "bg-yellow-500/10 text-yellow-600",
  qualified: "bg-emerald-500/10 text-emerald-600",
  proposal: "bg-purple-500/10 text-purple-600",
  negotiation: "bg-orange-500/10 text-orange-600",
  won: "bg-green-500/10 text-green-700",
  lost: "bg-red-500/10 text-red-600",
};

export default function BusinessContacts() {
  const { data: contacts = [], isLoading, addContact, deleteContact, bulkImport } = useBusinessContacts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = contacts.filter((c) => {
    const matchesSearch = !search || [c.company_name, c.contact_name, c.email, c.industry]
      .filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.lead_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-card-foreground flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" /> Business Contacts
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {contacts.length} total contacts
            </p>
          </div>
          <div className="flex gap-2">
            <ImportBusinessContactsDialog onImport={(c) => bulkImport.mutate(c)} isPending={bulkImport.isPending} />
            <AddBusinessContactDialog onAdd={(c) => addContact.mutate(c)} isPending={addContact.isPending} />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search company, contact, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.keys(STATUS_COLORS).map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Industry</TableHead>
                <TableHead className="hidden lg:table-cell">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden xl:table-cell">Source</TableHead>
                <TableHead className="hidden xl:table-cell">Added</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No business contacts found</TableCell></TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-card-foreground">{c.company_name}</div>
                    </TableCell>
                    <TableCell>{c.contact_name || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{c.email || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{c.phone || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{c.industry || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{c.job_title || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[c.lead_status] || ""}>{c.lead_status}</Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">{c.lead_source || "—"}</TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                      {format(new Date(c.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.website && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteContact.mutate(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
