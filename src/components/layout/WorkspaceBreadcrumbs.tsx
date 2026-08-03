import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Check, ChevronDown, Compass, Map, Pencil } from "lucide-react";

export type WorkspaceSection = "itinerary" | "details" | "bookings";

const SECTIONS: { value: WorkspaceSection; label: string; icon: typeof Map; hint: string }[] = [
  { value: "details", label: "Trip details", icon: Map, hint: "Client, dates, status" },
  { value: "itinerary", label: "Itinerary", icon: Compass, hint: "Day-by-day content" },
  { value: "bookings", label: "Bookings", icon: Building2, hint: "Suppliers & payments" },
];

interface WorkspaceBreadcrumbsProps {
  /** Trip name — omit on the Trip Builder index page. */
  tripName?: string;
  tripId?: string;
  /** Current section within the trip workspace. */
  section?: WorkspaceSection;
  onSectionChange?: (section: WorkspaceSection) => void;
}

export const WorkspaceBreadcrumbs = ({
  tripName,
  tripId,
  section,
  onSectionChange,
}: WorkspaceBreadcrumbsProps) => {
  const current = SECTIONS.find((s) => s.value === section);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Breadcrumb>
        <BreadcrumbList className="text-[13px]">
          <BreadcrumbItem>
            {tripName ? (
              <BreadcrumbLink asChild>
                <Link to="/trip-builder" className="flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Trip Builder
                </Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage className="flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Trip Builder
              </BreadcrumbPage>
            )}
          </BreadcrumbItem>

          {tripName && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {section && section !== "details" && tripId ? (
                  <BreadcrumbLink asChild>
                    <Link to={`/trips/${tripId}`} className="max-w-[220px] truncate">
                      {tripName}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="max-w-[220px] truncate">{tripName}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </>
          )}

          {tripName && current && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="flex items-center gap-1.5">
                  <current.icon className="h-3.5 w-3.5" />
                  {current.label}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {tripName && current && onSectionChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[12px] text-muted-foreground"
              aria-label="Switch workspace context"
            >
              Switch view
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[240px]">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Context
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SECTIONS.map((s) => (
              <DropdownMenuItem
                key={s.value}
                onSelect={() => onSectionChange(s.value)}
                className="gap-2"
              >
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">
                  <span className="block text-[13px]">{s.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{s.hint}</span>
                </span>
                {s.value === section && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
