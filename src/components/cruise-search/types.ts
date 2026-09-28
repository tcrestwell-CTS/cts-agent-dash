export interface WidgetySailing {
  holiday_ref: string;
  name: string;
  operator_title: string;
  holiday: string;
  ship_title?: string;
  image_url?: string;
  date_from?: string;
  date_to?: string;
  nights?: number;
  starts_at?: { name?: string; country?: string };
  ends_at?: { name?: string; country?: string };
  description?: string;
}

export interface WidgetyCabinPrice {
  availability: string;
  double_price_pp: string;
  single_price_pp: string | null;
  triple_price_pp: string | null;
  quad_price_pp: string | null;
  grade_code: string;
  grade_name: string;
  room_type: string;
  non_comm_charges: string | null;
  onboard_credit: string | null;
  child_price: string | null;
}

export interface WidgetyPricingDeal {
  name: string;
  description: string | null;
  prices: WidgetyCabinPrice[];
}

export interface WidgetyDate {
  date_ref: string;
  date_from: string;
  date_to: string;
  ship_title: string;
  starts_at?: { name: string; country: string };
  ends_at?: { name: string; country: string };
  itinerary_code: string;
  availability_string?: string;
  headline_prices?: {
    cruise?: {
      double?: {
        from_inside?: string;
        from_outside?: string;
        from_balcony?: string;
        from_suite?: string;
      };
    };
  };
  pricing?: WidgetyPricingDeal[];
}

export interface WidgetyItineraryItem {
  day_number: number;
  title: string;
  description: string;
  category: string;
  location: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
}

export type SortOption = "recommended" | "price_asc" | "date_asc" | "duration_asc";

export interface CruiseFilterState {
  destinations: string[];
  ports: string[];
  cruiseLines: string[];
  ships: string[];
  months: string[];
  durationRange: [number, number];
  priceRange: [number, number];
  promotions: string[];
  cruiseType: "all" | "ocean" | "river";
  audience: ("family" | "luxury" | "adults")[];
}

export const DEFAULT_FILTERS: CruiseFilterState = {
  destinations: [],
  ports: [],
  cruiseLines: [],
  ships: [],
  months: [],
  durationRange: [1, 30],
  priceRange: [0, 20000],
  promotions: [],
  cruiseType: "all",
  audience: [],
};

// Cruise line universe — mirrors CTS_LINES in triton-cruise-search /
// cruisefeed-cruise (names match CruiseFeed's /v1/cruise-lines exactly).
export const AVAILABLE_OPERATORS = [
  { slug: "royal-caribbean", label: "Royal Caribbean" },
  { slug: "carnival-cruise-line", label: "Carnival Cruise Line" },
  { slug: "norwegian-cruise-line", label: "Norwegian Cruise Line" },
  { slug: "disney-cruise-line", label: "Disney Cruise Line" },
  { slug: "msc-cruises", label: "MSC Cruises" },
  { slug: "princess-cruises", label: "Princess Cruises" },
  { slug: "celebrity-cruises", label: "Celebrity Cruises" },
  { slug: "holland-america-line", label: "Holland America Line" },
  { slug: "virgin-voyages", label: "Virgin Voyages" },
  { slug: "explora-journeys", label: "Explora Journeys" },
];

export const AVAILABLE_DESTINATIONS = [
  { value: "caribbean", label: "Caribbean" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "alaska", label: "Alaska" },
  { value: "bahamas", label: "Bahamas" },
  { value: "bermuda", label: "Bermuda" },
  { value: "hawaii", label: "Hawaii" },
  { value: "europe", label: "Europe" },
  { value: "asia", label: "Asia" },
  { value: "africa", label: "Africa" },
  { value: "south-america", label: "South America" },
  { value: "central-america", label: "Central America" },
  { value: "pacific", label: "Pacific" },
  { value: "north-america", label: "North America" },
  { value: "middle-east", label: "Middle East" },
  { value: "scandinavia", label: "Scandinavia" },
  { value: "transatlantic", label: "Transatlantic" },
  { value: "indian-ocean", label: "Indian Ocean" },
];

// UI destination value -> CruiseFeed region filter value
// (mirrors REGION_MAP in triton-cruise-search).
export const REGION_BY_DESTINATION: Record<string, string> = {
  caribbean: "Caribbean",
  mediterranean: "Mediterranean",
  alaska: "Alaska",
  bahamas: "Bahamas",
  bermuda: "Bermuda",
  hawaii: "Hawaii",
  europe: "Europe",
  asia: "Asia",
  africa: "Africa",
  "south-america": "South America",
  "central-america": "Central America",
  pacific: "Pacific",
  "north-america": "North America",
  "middle-east": "Middle East",
  scandinavia: "Scandinavia",
  transatlantic: "Atlantic",
  "indian-ocean": "Indian Ocean",
};

export const DEPARTURE_PORTS = [
  { value: "USMIA", label: "Miami, FL" },
  { value: "USFLL", label: "Fort Lauderdale, FL" },
  { value: "USPCV", label: "Port Canaveral, FL" },
  { value: "USTPA", label: "Tampa, FL" },
  { value: "USJAX", label: "Jacksonville, FL" },
  { value: "USNYC", label: "New York, NY" },
  { value: "FRBAY", label: "Bayonne, NJ" },
  { value: "USBAL", label: "Baltimore, MD" },
  { value: "USBOS", label: "Boston, MA" },
  { value: "USCHS", label: "Charleston, SC" },
  { value: "USGLS", label: "Galveston, TX" },
  { value: "USHOU", label: "Houston, TX" },
  { value: "USMSY", label: "New Orleans, LA" },
  { value: "USLAX", label: "Los Angeles, CA" },
  { value: "USSFO", label: "San Francisco, CA" },
  { value: "USSAN", label: "San Diego, CA" },
  { value: "USSEA", label: "Seattle, WA" },
  { value: "USHNL", label: "Honolulu, HI" },
  { value: "PRSJU", label: "San Juan, PR" },
  { value: "ESBCN", label: "Barcelona, Spain" },
  { value: "ITROM", label: "Rome (Civitavecchia), Italy" },
  { value: "ITVCE", label: "Venice, Italy" },
  { value: "GRPIR", label: "Athens (Piraeus), Greece" },
  { value: "GBSOU", label: "Southampton, UK" },
  { value: "NLAMS", label: "Amsterdam, Netherlands" },
  { value: "DKCPH", label: "Copenhagen, Denmark" },
  { value: "SGSIN", label: "Singapore" },
  { value: "AUSYD", label: "Sydney, Australia" },
];

export const RIVER_OPERATORS = new Set<string>([]);

export const FAMILY_OPERATORS = new Set([
  "disney-cruise-line",
  "carnival-cruise-line",
  "royal-caribbean",
  "norwegian-cruise-line",
  "msc-cruises",
]);

export const LUXURY_OPERATORS = new Set([
  "explora-journeys",
  "seabourn-cruise-line",
  "silversea-cruises",
  "ritz-carlton-yacht-collection",
  "cunard-line",
]);

export const ADULTS_OPERATORS = new Set(["virgin-voyages"]);

export const PROMOTION_KEYWORDS: Record<string, string[]> = {
  obc: ["onboard credit", "obc", "shipboard credit"],
  reduced_deposit: ["reduced deposit", "low deposit"],
  free_drinks: ["beverage", "drinks", "all-inclusive"],
  free_wifi: ["wifi", "wi-fi", "internet"],
  kids_sail_free: ["kids sail free", "3rd & 4th", "third and fourth"],
};