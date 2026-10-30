export interface HawaiiCabinPrice {
  id: string;
  name: string;
  primary?: boolean;
  perPerson: number;
  cabinTotal: number;
  serviceChargePerPersonPerDay: number;
}

export interface HawaiiSailing {
  id: string;
  label: string;
  shortLabel: string;
  startDate: string;
  endDate: string;
  hotelCheckIn: string;
  hotelCheckOut: string;
  nights: number;
  cabins: HawaiiCabinPrice[];
}

export interface HawaiiHotelRoom {
  id: string;
  name: string;
  details?: string;
  nightlyRate: number;
  nights: number;
  knownPayAtProperty: number;
  prepaidTotal?: number;
  includedTaxes?: number;
  postCheckoutRefund?: number;
  refundLabel?: string;
  estimatedTaxes?: number;
  taxesFeesLabel: string;
  cancellationLabel: string;
  paymentLabel: string;
}

export interface HawaiiHotel {
  id: string;
  name: string;
  summary: string;
  rooms: HawaiiHotelRoom[];
}

export interface HawaiiProposalConfig {
  proposal_type: "hawaii_2027";
  version: string;
  cruiseNights: number;
  freeAtSeaStandardPerPersonPerDay: number;
  freeAtSeaPlusPerPersonPerDay: number;
  sailings: HawaiiSailing[];
  hotels: HawaiiHotel[];
  groupBenefits: string[];
}

export const HAWAII_PROPOSAL_CONFIG: HawaiiProposalConfig = {
  proposal_type: "hawaii_2027",
  version: "hawaii-2027-nov20-v2",
  cruiseNights: 7,
  freeAtSeaStandardPerPersonPerDay: 28.5,
  freeAtSeaPlusPerPersonPerDay: 49.99,
  sailings: [
    {
      id: "2027-11-20",
      label: "November 20–27, 2027",
      shortLabel: "November 20",
      startDate: "2027-11-20",
      endDate: "2027-11-27",
      hotelCheckIn: "2027-11-18",
      hotelCheckOut: "2027-11-20",
      nights: 7,
      cabins: [
        { id: "inside", name: "Inside Stateroom", primary: true, perPerson: 1899, cabinTotal: 3798, serviceChargePerPersonPerDay: 20 },
        { id: "oceanview", name: "Oceanview Stateroom", primary: true, perPerson: 2141, cabinTotal: 4282, serviceChargePerPersonPerDay: 20 },
        { id: "balcony", name: "Balcony Stateroom", primary: true, perPerson: 3025, cabinTotal: 6050, serviceChargePerPersonPerDay: 20 },
        { id: "club-balcony", name: "Club Balcony Suite", perPerson: 4897, cabinTotal: 9794, serviceChargePerPersonPerDay: 25 },
        { id: "suite", name: "Suite", perPerson: 5423, cabinTotal: 10846, serviceChargePerPersonPerDay: 30 },
      ],
    },
  ],
  hotels: [
    {
      id: "hilton-hawaiian-village",
      name: "Hilton Hawaiian Village Waikiki Beach Resort",
      summary: "A full-service Waikiki beachfront resort.",
      rooms: [
        { id: "king-deluxe-ocean", name: "1 King Deluxe Ocean View", nightlyRate: 296, nights: 2, knownPayAtProperty: 106.16, estimatedTaxes: 87.85, taxesFeesLabel: "Occupancy tax included: $87.85", cancellationLabel: "November cancellation terms require confirmation", paymentLabel: "Payment total: $679.85 USD" },
        { id: "lanai-ocean-accessible", name: "Lanai Ocean View – Mobility Accessible", nightlyRate: 222.47, nights: 2, knownPayAtProperty: 106.16, prepaidTotal: 510.98, includedTaxes: 66.04, taxesFeesLabel: "Occupancy tax included: $66.04", cancellationLabel: "November cancellation terms require confirmation", paymentLabel: "Payment total: $510.98 USD" },
        { id: "two-queens-ocean", name: "2 Queen Beds – Ocean View", nightlyRate: 296, nights: 2, knownPayAtProperty: 106.16, estimatedTaxes: 87.85, taxesFeesLabel: "Occupancy tax included: $87.85", cancellationLabel: "November cancellation terms require confirmation", paymentLabel: "Payment total: $679.85 USD" },
      ],
    },
    {
      id: "outrigger-waikiki-paradise",
      name: "OUTRIGGER Waikiki Paradise Hotel",
      summary: "A modern Waikiki stay with room-only pricing and free Wi-Fi.",
      rooms: [
        { id: "standard-queen", name: "Standard Double Room — 1 Queen Bed", details: "237 sq. ft. · Non-smoking · Room only · Free Wi-Fi", nightlyRate: 220, nights: 2, knownPayAtProperty: 48, estimatedTaxes: 65.31, taxesFeesLabel: "Occupancy tax included: $65.31", cancellationLabel: "November cancellation terms require confirmation", paymentLabel: "Payment total: $505.31 USD" },
        { id: "queen-waikiki-view", name: "Room — 1 Queen Bed (Waikiki View)", details: "Queen size bed · Non-smoking · Breakfast included", nightlyRate: 362.5, nights: 2, knownPayAtProperty: 95, prepaidTotal: 725, estimatedTaxes: 93.7, taxesFeesLabel: "Occupancy tax included: $93.70", cancellationLabel: "November cancellation terms require confirmation", paymentLabel: "Payment total: $725 USD" },
        { id: "one-bedroom-king-suite-partial-ocean", name: "One Bedroom King Suite with Partial Ocean View", details: "1 Bedroom Suite · Partial Ocean View · 1 King Bed · Non-smoking · Room only", nightlyRate: 483, nights: 2, knownPayAtProperty: 95, prepaidTotal: 966, estimatedTaxes: 124.83, taxesFeesLabel: "Occupancy tax included: $124.83", cancellationLabel: "November cancellation terms require confirmation", paymentLabel: "Payment total: $966 USD" },
      ],
    },
    {
      id: "ramada-plaza-waikiki",
      name: "Ramada Plaza by Wyndham Waikiki",
      summary: "Straightforward Waikiki accommodations with three room choices.",
      rooms: [
        { id: "standard-king", name: "Standard Room — 1 King Bed", nightlyRate: 198, nights: 2, knownPayAtProperty: 0, estimatedTaxes: 58.78, taxesFeesLabel: "Occupancy tax included: $58.78", cancellationLabel: "November cancellation terms require confirmation", paymentLabel: "Payment total: $454.78 USD" },
        { id: "balcony-king", name: "Balcony Room — 1 King Bed", nightlyRate: 227, nights: 2, knownPayAtProperty: 0, estimatedTaxes: 67.38, taxesFeesLabel: "Occupancy tax included: $67.38", cancellationLabel: "November cancellation terms require confirmation", paymentLabel: "Payment total: $521.38 USD" },
        { id: "balcony-city-double", name: "Balcony + City View Room — 2 Double Beds", nightlyRate: 238, nights: 2, knownPayAtProperty: 0, estimatedTaxes: 70.65, taxesFeesLabel: "Occupancy tax included: $70.65", cancellationLabel: "November cancellation terms require confirmation", paymentLabel: "Payment total: $546.65 USD" },
      ],
    },
  ],
  groupBenefits: [],
};

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);