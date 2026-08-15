/**
 * Central registry of feature keys used for per-user permission gating.
 * Each key maps to one (or more) sidebar items and routes.
 *
 * The default allow-list for plain agents (when no override row exists)
 * lives in the SQL function `public.has_feature_permission`. Keep these
 * two in sync.
 */
export type FeatureKey =
  | "dashboard"
  | "leads"
  | "trips"
  | "quotes"
  | "clients"
  | "business_contacts"
  | "suppliers"
  | "commissions"
  | "email_branding"
  | "publish_manager"
  | "featured_trips"
  | "flight_search"
  | "flight_monitoring"
  | "hotel_search"
  | "cruise_search"
  | "excursions"
  | "loan_applications"
  | "payment_reminders"
  | "training"
  | "training_library"
  | "training_badges"
  | "analytics"
  | "campaigns"
  | "notifications"
  | "settings";

export interface FeatureMeta {
  key: FeatureKey;
  label: string;
  group: "Sales" | "Bookings" | "Marketing" | "Tools" | "Training" | "Reports" | "Other";
  /** Whether plain agents get this by default when no override row exists. Mirror of SQL default. */
  defaultAllowed: boolean;
}

export const FEATURE_REGISTRY: FeatureMeta[] = [
  { key: "dashboard",          label: "Dashboard",           group: "Other",      defaultAllowed: true  },
  { key: "leads",              label: "Leads",               group: "Sales",      defaultAllowed: true  },
  { key: "trips",              label: "Trips",               group: "Sales",      defaultAllowed: true  },
  { key: "quotes",             label: "Quotes",              group: "Sales",      defaultAllowed: true  },
  { key: "clients",            label: "Clients",             group: "Sales",      defaultAllowed: true  },
  { key: "business_contacts",  label: "Business Contacts",   group: "Sales",      defaultAllowed: true  },
  { key: "suppliers",          label: "Suppliers",           group: "Bookings",   defaultAllowed: true  },
  { key: "commissions",        label: "Commissions",         group: "Bookings",   defaultAllowed: true  },
  { key: "email_branding",     label: "Email & Branding",    group: "Marketing",  defaultAllowed: true  },
  { key: "publish_manager",    label: "Publish Manager",     group: "Marketing",  defaultAllowed: false },
  { key: "featured_trips",     label: "Featured Trips",      group: "Marketing",  defaultAllowed: false },
  { key: "flight_search",      label: "Flight Search",       group: "Tools",      defaultAllowed: true  },
  { key: "flight_monitoring",  label: "Flight Monitor",      group: "Tools",      defaultAllowed: false },
  { key: "hotel_search",       label: "Hotel Search",        group: "Tools",      defaultAllowed: true  },
  { key: "cruise_search",      label: "Cruise Search",       group: "Tools",      defaultAllowed: true  },
  { key: "excursions",         label: "Excursions",          group: "Tools",      defaultAllowed: true  },
  { key: "loan_applications",  label: "Loan Applications",   group: "Tools",      defaultAllowed: false },
  { key: "campaigns",          label: "Campaigns",           group: "Marketing",  defaultAllowed: false },
  { key: "payment_reminders",  label: "Payment Reminders",   group: "Bookings",   defaultAllowed: true  },
  { key: "training",           label: "Training Dashboard",  group: "Training",   defaultAllowed: true  },
  { key: "training_library",   label: "Training Library",    group: "Training",   defaultAllowed: true  },
  { key: "training_badges",    label: "My Badges",           group: "Training",   defaultAllowed: true  },
  { key: "analytics",          label: "Analytics",           group: "Reports",    defaultAllowed: false },
  { key: "notifications",      label: "Notifications",       group: "Other",      defaultAllowed: true  },
  { key: "settings",           label: "Settings",            group: "Other",      defaultAllowed: true  },
];

/** Map a route path to a feature key (used by the route guard). */
export const ROUTE_FEATURE_MAP: Record<string, FeatureKey> = {
  "/leads":              "leads",
  "/trips":              "trips",
  "/commission-report":  "quotes",
  "/contacts":           "clients",
  "/business-contacts":  "business_contacts",
  "/suppliers":          "suppliers",
  "/commissions":        "commissions",
  "/branding":           "email_branding",
  "/publish-manager":    "publish_manager",
  "/featured-trips":     "featured_trips",
  "/flights":            "flight_search",
  "/flight-monitoring":  "flight_monitoring",
  "/hotels":             "hotel_search",
  "/cruises":            "cruise_search",
  "/excursions":         "excursions",
  "/loan-applications":  "loan_applications",
  "/payment-reminders":  "payment_reminders",
  "/analytics":          "analytics",
};