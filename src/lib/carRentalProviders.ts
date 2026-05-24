export type CarRentalProvider = {
  key: string;
  name: string;
  /** Tailwind utility classes for the badge */
  classes: string;
};

export const CAR_RENTAL_PROVIDERS: CarRentalProvider[] = [
  { key: "hertz",      name: "Hertz",      classes: "bg-yellow-400 text-black border-yellow-500" },
  { key: "avis",       name: "Avis",       classes: "bg-red-600 text-white border-red-700" },
  { key: "enterprise", name: "Enterprise", classes: "bg-green-700 text-white border-green-800" },
  { key: "budget",     name: "Budget",     classes: "bg-blue-600 text-white border-blue-700" },
  { key: "national",   name: "National",   classes: "bg-emerald-600 text-white border-emerald-700" },
  { key: "alamo",      name: "Alamo",      classes: "bg-yellow-500 text-black border-yellow-600" },
  { key: "sixt",       name: "Sixt",       classes: "bg-orange-500 text-black border-orange-600" },
  { key: "dollar",     name: "Dollar",     classes: "bg-orange-600 text-white border-orange-700" },
  { key: "thrifty",    name: "Thrifty",    classes: "bg-sky-600 text-white border-sky-700" },
  { key: "fox",        name: "Fox",        classes: "bg-amber-500 text-white border-amber-600" },
  { key: "europcar",   name: "Europcar",   classes: "bg-lime-600 text-white border-lime-700" },
  { key: "other",      name: "Other",      classes: "bg-muted text-foreground border-border" },
];

export function getProviderMeta(value?: string | null): CarRentalProvider {
  const v = (value || "").toLowerCase().trim();
  return (
    CAR_RENTAL_PROVIDERS.find((p) => p.key === v) ||
    CAR_RENTAL_PROVIDERS.find((p) => p.name.toLowerCase() === v) ||
    { key: v || "other", name: value || "Other", classes: "bg-muted text-foreground border-border" }
  );
}

export const CAR_RENTAL_STATUSES = ["new", "pending", "confirmed", "cancelled", "completed"] as const;
export type CarRentalStatus = (typeof CAR_RENTAL_STATUSES)[number];

export function getStatusBadgeClasses(status?: string | null): string {
  switch ((status || "new").toLowerCase()) {
    case "new":       return "bg-muted text-foreground border-border";
    case "pending":   return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-100";
    case "confirmed": return "bg-green-100 text-green-900 border-green-300 dark:bg-green-900/40 dark:text-green-100";
    case "cancelled": return "bg-red-100 text-red-900 border-red-300 dark:bg-red-900/40 dark:text-red-100";
    case "completed": return "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/40 dark:text-blue-100";
    default:          return "bg-muted text-foreground border-border";
  }
}

export function getStatusLabel(status?: string | null): string {
  const s = (status || "new").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}