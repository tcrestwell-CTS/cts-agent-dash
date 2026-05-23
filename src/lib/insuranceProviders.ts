// Insurance provider catalog for Crestwell Travel Services
// Four preferred providers with quote URL builders and recommended use cases

export interface InsuranceProvider {
  id: string;
  name: string;
  shortName: string;
  logo: string;           // emoji fallback until real logos are added
  brandColor: string;
  website: string;
  quoteUrlBuilder: (trip: InsuranceTripContext) => string;
  recommendedFor: string[];
  strengths: string[];
  plans: InsuranceProviderPlan[];
}

export interface InsuranceTripContext {
  destination:     string;
  departDate:      string;    // YYYY-MM-DD
  returnDate:      string;    // YYYY-MM-DD
  tripCost:        number;    // total trip cost in USD
  travelerCount:   number;
  travelerAges?:   number[];  // for providers that need age-based pricing
  primaryState?:   string;    // resident state for compliance
  primaryDOB?:     string;    // YYYY-MM-DD — for age-based quotes
}

export interface InsuranceProviderPlan {
  id: string;
  name: string;
  description: string;
  typicalCoverageRange: string;
  includesCancel: boolean;
  includesMedical: boolean;
  includesEvac: boolean;
  includesDelay: boolean;
  bestFor: string;
}

// ── Build quote URLs pre-filled with trip data ─────────────────────────────
// Each provider has a different URL structure and parameter format

function chubbQuoteUrl(trip: InsuranceTripContext): string {
  const base = "https://agent.chubbtravelinsurance.com/main";
  // Chubb uses a quote form — deep link to it with UTM tracking
  const params = new URLSearchParams({
    utm_source:  "crestwell",
    utm_medium:  "agent",
    utm_campaign: "travel_insurance",
  });
  return `${base}?${params}`;
}

function worldtripsQuoteUrl(trip: InsuranceTripContext): string {
  const base = "https://pas.worldtrips.com/dashboard/policies";
  const params = new URLSearchParams({
    departureDate: trip.departDate,
    returnDate:    trip.returnDate,
    destination:   trip.destination,
    tripCost:      String(Math.round(trip.tripCost)),
    travelers:     String(trip.travelerCount),
    ...(trip.primaryState ? { state: trip.primaryState } : {}),
  });
  return `${base}?${params}`;
}

function allianzQuoteUrl(trip: InsuranceTripContext): string {
  const base = "https://www.allianztravelinsurance.com/travel/insurance/quote.htm";
  const params = new URLSearchParams({
    departureDate:        trip.departDate,
    returnDate:           trip.returnDate,
    destinationCountry:   trip.destination,
    initialDepositDate:   trip.departDate,
    tripCost:             String(Math.round(trip.tripCost)),
    numTravelers:         String(trip.travelerCount),
    ...(trip.primaryDOB ? { primaryBirthDate: trip.primaryDOB } : {}),
    ...(trip.primaryState ? { residenceState: trip.primaryState } : {}),
  });
  return `${base}?${params}`;
}

function fayeQuoteUrl(trip: InsuranceTripContext): string {
  const base = "https://advisors.withfaye.com/dashboard";
  const params = new URLSearchParams({
    departure_date: trip.departDate,
    return_date:    trip.returnDate,
    destination:    trip.destination,
    trip_cost:      String(Math.round(trip.tripCost)),
    travelers:      String(trip.travelerCount),
    utm_source:     "crestwell",
    utm_medium:     "agent_portal",
  });
  return `${base}?${params}`;
}

// ── Provider catalog ───────────────────────────────────────────────────────
export const INSURANCE_PROVIDERS: InsuranceProvider[] = [
  {
    id:           "chubb",
    name:         "Chubb Travel Protection",
    shortName:    "Chubb",
    logo:         "🛡️",
    brandColor:   "#c8102e",
    website:      "https://www.chubb.com/us-en/individuals-families/products/travel-insurance.html",
    quoteUrlBuilder: chubbQuoteUrl,
    recommendedFor: ["luxury travel", "high-value trips", "cruise", "international"],
    strengths: [
      "Best-in-class coverage limits",
      "Strong medical evacuation ($1M+)",
      "Cancel for any reason add-on available",
      "Excellent claims support",
    ],
    plans: [
      {
        id: "chubb-classic",
        name: "Classic",
        description: "Comprehensive coverage for most trips",
        typicalCoverageRange: "Up to trip cost",
        includesCancel: true, includesMedical: true,
        includesEvac: true, includesDelay: true,
        bestFor: "Standard international travel",
      },
      {
        id: "chubb-deluxe",
        name: "Deluxe",
        description: "Enhanced limits and CFAR option",
        typicalCoverageRange: "Up to trip cost + enhancements",
        includesCancel: true, includesMedical: true,
        includesEvac: true, includesDelay: true,
        bestFor: "Luxury and high-value trips",
      },
    ],
  },
  {
    id:           "worldtrips",
    name:         "WorldTrips",
    shortName:    "WorldTrips",
    logo:         "🌍",
    brandColor:   "#0057a8",
    website:      "https://www.worldtrips.com",
    quoteUrlBuilder: worldtripsQuoteUrl,
    recommendedFor: ["international travel", "medical coverage", "expats", "adventure travel"],
    strengths: [
      "Competitive medical coverage ($250K+)",
      "Strong international medical network",
      "Good for adventure activities",
      "Affordable premiums",
    ],
    plans: [
      {
        id: "worldtrips-atlas",
        name: "Atlas Travel",
        description: "International travel medical insurance",
        typicalCoverageRange: "$50K–$2M medical",
        includesCancel: false, includesMedical: true,
        includesEvac: true, includesDelay: false,
        bestFor: "International medical coverage",
      },
      {
        id: "worldtrips-select",
        name: "Atlas Premium",
        description: "Full trip protection with high medical limits",
        typicalCoverageRange: "Trip cost + $2M medical",
        includesCancel: true, includesMedical: true,
        includesEvac: true, includesDelay: true,
        bestFor: "Comprehensive international coverage",
      },
    ],
  },
  {
    id:           "allianz",
    name:         "Allianz Travel Insurance",
    shortName:    "Allianz",
    logo:         "⚡",
    brandColor:   "#003781",
    website:      "https://www.allianztravelinsurance.com",
    quoteUrlBuilder: allianzQuoteUrl,
    recommendedFor: ["families", "domestic travel", "frequent travelers", "annual plans"],
    strengths: [
      "Annual/multi-trip plans available",
      "Strong trip cancellation coverage",
      "24/7 assistance hotline",
      "Annual plans great for frequent travelers",
    ],
    plans: [
      {
        id: "allianz-onetrip-basic",
        name: "OneTrip Basic",
        description: "Essential trip protection",
        typicalCoverageRange: "Up to trip cost",
        includesCancel: true, includesMedical: true,
        includesEvac: false, includesDelay: true,
        bestFor: "Budget-conscious travelers",
      },
      {
        id: "allianz-onetrip-prime",
        name: "OneTrip Prime",
        description: "Popular mid-tier plan",
        typicalCoverageRange: "Up to trip cost + medical",
        includesCancel: true, includesMedical: true,
        includesEvac: true, includesDelay: true,
        bestFor: "Most travelers — best value",
      },
      {
        id: "allianz-annual",
        name: "AllTrips Executive",
        description: "Annual plan for frequent travelers",
        typicalCoverageRange: "Up to $10K per trip",
        includesCancel: true, includesMedical: true,
        includesEvac: true, includesDelay: true,
        bestFor: "Agents and frequent travelers (4+ trips/year)",
      },
    ],
  },
  {
    id:           "faye",
    name:         "Faye Travel Insurance",
    shortName:    "Faye",
    logo:         "✈️",
    brandColor:   "#6366f1",
    website:      "https://www.fayetravel.com",
    quoteUrlBuilder: fayeQuoteUrl,
    recommendedFor: ["modern travelers", "app-based claims", "millennials", "quick claims"],
    strengths: [
      "App-based claims (instant reimbursement)",
      "Clean modern UX",
      "Real-time trip monitoring",
      "Fastest claims processing in the industry",
    ],
    plans: [
      {
        id: "faye-standard",
        name: "Standard",
        description: "Modern travel protection with app-based claims",
        typicalCoverageRange: "Up to trip cost",
        includesCancel: true, includesMedical: true,
        includesEvac: true, includesDelay: true,
        bestFor: "Tech-savvy travelers who want fast claims",
      },
    ],
  },
];

// ── Recommendation engine ──────────────────────────────────────────────────
// Returns providers sorted by relevance for a given trip type

export function getRecommendedProviders(
  tripType: string,
  tripCost: number,
  isInternational: boolean,
): InsuranceProvider[] {
  const lower = (tripType || "").toLowerCase();

  return [...INSURANCE_PROVIDERS].sort((a, b) => {
    const scoreA = getProviderScore(a, lower, tripCost, isInternational);
    const scoreB = getProviderScore(b, lower, tripCost, isInternational);
    return scoreB - scoreA;
  });
}

function getProviderScore(
  p: InsuranceProvider,
  tripType: string,
  tripCost: number,
  isInternational: boolean,
): number {
  let score = 0;
  if (p.recommendedFor.some(r => tripType.includes(r) || r.includes(tripType))) score += 3;
  if (isInternational && ["chubb", "worldtrips", "allianz"].includes(p.id)) score += 2;
  if (tripCost > 10000 && p.id === "chubb") score += 2;
  if (tripCost < 3000 && p.id === "faye") score += 1;
  if (tripType.includes("cruise") && ["chubb", "allianz"].includes(p.id)) score += 2;
  if (tripType.includes("family") && p.id === "allianz") score += 2;
  return score;
}
