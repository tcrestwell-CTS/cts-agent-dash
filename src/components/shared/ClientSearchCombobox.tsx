import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, X, UserCheck } from "lucide-react";
import { useClients, type Client } from "@/hooks/useClients";
import { cn } from "@/lib/utils";

export interface SelectedClient {
  id: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  birthday?: string | null;
  known_traveler_number?: string | null;
  passport_info?: string | null;
}

interface ClientSearchComboboxProps {
  value: SelectedClient | null;
  onSelect: (client: SelectedClient) => void;
  onClear: () => void;
  onCreateNew?: (query: string) => void;
  placeholder?: string;
  excludeClientIds?: string[];
  label?: string;
  description?: string;
}

export function ClientSearchCombobox({
  value,
  onSelect,
  onClear,
  onCreateNew,
  placeholder = "Search existing contacts by name or email…",
  excludeClientIds = [],
  label = "Link to existing contact",
  description = "Search your CRM to avoid duplicates. Selecting a contact will auto-fill the details below.",
}: ClientSearchComboboxProps) {
  const { data: clients = [], isLoading } = useClients();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const exclude = new Set(excludeClientIds);
    return clients
      .filter((c) => !exclude.has(c.id))
      .filter((c) => {
        const blob = `${c.first_name || ""} ${c.last_name || ""} ${c.name} ${c.email || ""} ${c.phone || ""}`.toLowerCase();
        return blob.includes(q);
      })
      .slice(0, 8);
  }, [clients, query, excludeClientIds]);

  if (value) {
    return (
      <div className="space-y-1.5">
        {label && <label className="text-sm font-medium">{label}</label>}
        <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
          <UserCheck className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{value.name}</p>
              <Badge variant="secondary" className="text-[10px]">Linked</Badge>
            </div>
            {value.email && (
              <p className="text-xs text-muted-foreground truncate">{value.email}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onClear}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Unlink
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Identity fields are managed on the contact record. Trip-specific fields below remain editable.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9"
        />
        {open && query.trim().length >= 1 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
            ) : matches.length === 0 ? (
              <div className="p-2">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No matching contacts
                </div>
                {onCreateNew && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={() => {
                      onCreateNew(query.trim());
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Create new contact "{query.trim()}"
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-1">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelect({
                        id: c.id,
                        name: c.name,
                        first_name: c.first_name,
                        last_name: c.last_name,
                        email: c.email,
                        phone: c.phone,
                        birthday: c.birthday,
                        known_traveler_number: c.known_traveler_number,
                        passport_info: c.passport_info,
                      });
                      setQuery("");
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center gap-2",
                    )}
                  >
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-primary">
                        {(c.first_name?.[0] || c.name[0] || "?").toUpperCase()}
                        {(c.last_name?.[0] || c.name.split(" ")[1]?.[0] || "").toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {(c.email || c.phone) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {c.email || c.phone}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
                {onCreateNew && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateNew(query.trim());
                      setQuery("");
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 border-t hover:bg-muted/60 flex items-center gap-2 text-xs text-primary"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Create new contact "{query.trim()}"
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}