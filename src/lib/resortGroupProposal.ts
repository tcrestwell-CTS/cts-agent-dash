export interface ResortRoomOption {
  id: string;
  name: string;
  details: string;
  sizeSqFt?: number;
  maxGuests: number;
  minGuests: number;
  reservedFor?: string;
  /** Known 3-night price for a single guest, by date option id. Missing = advisor to confirm. */
  pricesByDate: Record<string, number | undefined>;
  pricingNote: string;
}

export interface ResortDateOption {
  id: string;
  label: string;
  checkIn: string;
  checkOut: string;
  nights: number;
}

export interface ResortGroupProposalConfig {
  proposal_type: "resort_group_v1";
  version: string;
  title: string;
  kicker: string;
  intro: string;
  hotel: { id: string; name: string; location: string; summary: string; highlights: string[] };
  dates: ResortDateOption[];
  rooms: ResortRoomOption[];
}

export const RESORT_PROPOSAL_TYPE = "resort_group_v1";

export const WAMSLEY_PROPOSAL_CONFIG: ResortGroupProposalConfig = {
  proposal_type: "resort_group_v1",
  version: "wamsley-bridal-2027-v1",
  title: "Wamsley Bridal Party",
  kicker: "Hyatt Zilara Cancun · Adults-only all-inclusive",
  intro: "Pick your dates, choose your room, tell us who is sharing it, and let us know if you'd like help with flights. Your Crestwell advisor confirms everything before anything is booked or charged.",
  hotel: {
    id: "hyatt-zilara-cancun",
    name: "Hyatt Zilara Cancun",
    location: "Hotel Zone, Cancun, Mexico",
    summary: "An adults-only, all-inclusive oceanfront resort in Cancun's Hotel Zone — upscale pool and beach days with the whole group.",
    highlights: ["Adults-only", "All-inclusive", "Oceanfront suites", "Free cancellation before Feb 4 on the rates we found (confirm per booking)"],
  },
  dates: [
    { id: "2027-02-18", label: "February 18–21, 2027", checkIn: "2027-02-18", checkOut: "2027-02-21", nights: 3 },
    { id: "2027-03-18", label: "March 18–21, 2027", checkIn: "2027-03-18", checkOut: "2027-03-21", nights: 3 },
  ],
  rooms: [
    {
      id: "luxury-double-junior-oceanfront",
      name: "Luxury Double Junior Suite Oceanfront",
      details: "657 sq ft · Ocean view balcony · In-room jetted tub · All-inclusive",
      sizeSqFt: 657,
      minGuests: 1,
      maxGuests: 2,
      pricesByDate: { "2027-02-18": 2366 },
      pricingNote: "February rate shown is for 3 nights, 1 guest, plus taxes. Shared-room and March pricing confirmed by your advisor.",
    },
    {
      id: "double-oceanfront-suite",
      name: "Double Oceanfront Suite",
      details: "Oceanfront suite · Two beds · All-inclusive",
      minGuests: 1,
      maxGuests: 4,
      pricesByDate: {},
      pricingNote: "Pricing confirmed by your advisor.",
    },
    {
      id: "presidential-suite",
      name: "Presidential Suite",
      details: "1,335 sq ft · Oceanfront · Upgraded suite for the bride",
      sizeSqFt: 1335,
      minGuests: 1,
      maxGuests: 2,
      reservedFor: "Bride's upgraded suite",
      pricesByDate: { "2027-02-18": 4482 },
      pricingNote: "February rate shown is for 3 nights, 1 guest, plus taxes. Shared-room and March pricing confirmed by your advisor.",
    },
  ],
};

export const FLIGHT_CHOICES = [
  ["need_flights", "Yes — please quote flights for me"],
  ["own_flights", "No — I'll book my own flights"],
  ["undecided", "Not sure yet"],
] as const;

export const CABIN_CLASSES = [
  ["economy", "Economy"],
  ["premium_economy", "Premium economy"],
  ["business", "Business / First"],
] as const;
