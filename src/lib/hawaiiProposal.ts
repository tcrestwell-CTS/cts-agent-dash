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
  version: "hawaii-2027-v1",
  cruiseNights: 7,
  freeAtSeaStandardPerPersonPerDay: 28.5,
  freeAtSeaPlusPerPersonPerDay: 49.99,
  sailings: [
    {
      id: "2027-03-20",
      label: "March 20–27, 2027",
      shortLabel: "March 20",
      startDate: "2027-03-20",
      endDate: "2027-03-27",
      hotelCheckIn: "2027-03-18",
      hotelCheckOut: "2027-03-20",
      nights: 7,
      cabins: [
        { id: "inside", name: "Inside Stateroom", primary: true, perPerson: 1886, cabinTotal: 3772, serviceChargePerPersonPerDay: 20 },
        { id: "oceanview", name: "Oceanview Stateroom", primary: true, perPerson: 2170, cabinTotal: 4340, serviceChargePerPersonPerDay: 20 },
        { id: "balcony", name: "Balcony Stateroom", primary: true, perPerson: 3043, cabinTotal: 6086, serviceChargePerPersonPerDay: 20 },
        { id: "club-balcony", name: "Club Balcony Suite", perPerson: 5200, cabinTotal: 10400, serviceChargePerPersonPerDay: 25 },
        { id: "suite", name: "Suite", perPerson: 5494, cabinTotal: 10988, serviceChargePerPersonPerDay: 30 },
      ],
    },
    {
      id: "2027-03-27",
      label: "March 27–April 3, 2027",
      shortLabel: "March 27",
      startDate: "2027-03-27",
      endDate: "2027-04-03",
      hotelCheckIn: "2027-03-25",
      hotelCheckOut: "2027-03-27",
      nights: 7,
      cabins: [
        { id: "inside", name: "Inside Stateroom", primary: true, perPerson: 1939, cabinTotal: 3878, serviceChargePerPersonPerDay: 20 },
        { id: "oceanview", name: "Oceanview Stateroom", primary: true, perPerson: 2202, cabinTotal: 4404, serviceChargePerPersonPerDay: 20 },
        { id: "balcony", name: "Balcony Stateroom", primary: true, perPerson: 3043, cabinTotal: 6086, serviceChargePerPersonPerDay: 20 },
        { id: "club-balcony", name: "Club Balcony Suite", perPerson: 5052, cabinTotal: 10104, serviceChargePerPersonPerDay: 25 },
        { id: "suite", name: "Suite", perPerson: 5200, cabinTotal: 10400, serviceChargePerPersonPerDay: 30 },
      ],
    },
  ],
  hotels: [
    {
      id: "hilton-hawaiian-village",
      name: "Hilton Hawaiian Village Waikiki Beach Resort",
      summary: "A full-service Waikiki beachfront resort.",
      rooms: [
        { id: "king-deluxe-ocean", name: "1 King Deluxe Ocean View", nightlyRate: 296, nights: 2, knownPayAtProperty: 106.16, estimatedTaxes: 87.85, taxesFeesLabel: "Occupancy tax included: $87.85", cancellationLabel: "Free cancellation before March 17, 2027", paymentLabel: "[PREPAID / FLEXIBLE / PAY AT PROPERTY – CONFIRM]" },
        { id: "lanai-ocean-accessible", name: "Lanai Ocean View – Mobility Accessible", nightlyRate: 222.47, nights: 2, knownPayAtProperty: 106.16, prepaidTotal: 510.98, includedTaxes: 66.04, postCheckoutRefund: 91.98, refundLabel: "Commission 18%", taxesFeesLabel: "Occupancy tax included: $66.04", cancellationLabel: "Free cancellation before March 17, 2027", paymentLabel: "Payment total: $510.98 USD" },
        { id: "two-queens-ocean", name: "2 Queen Beds – Ocean View", nightlyRate: 296, nights: 2, knownPayAtProperty: 106.16, estimatedTaxes: 87.85, taxesFeesLabel: "Occupancy tax included: $87.85", cancellationLabel: "Free cancellation before March 17, 2027", paymentLabel: "[PREPAID / FLEXIBLE / PAY AT PROPERTY – CONFIRM]" },
      ],
    },
    {
      id: "outrigger-waikiki-paradise",
      name: "OUTRIGGER Waikiki Paradise Hotel",
      summary: "A modern Waikiki stay with room-only pricing and free Wi-Fi.",
      rooms: [
        { id: "standard-queen", name: "Standard Double Room — 1 Queen Bed", details: "237 sq. ft. · Non-smoking · Room only · Free Wi-Fi", nightlyRate: 220, nights: 2, knownPayAtProperty: 48, estimatedTaxes: 65.31, taxesFeesLabel: "Occupancy tax included: $65.31", cancellationLabel: "Free cancellation before March 17, 2027", paymentLabel: "Additional amount shown payable at property: $48" },
      ],
    },
    {
      id: "ramada-plaza-waikiki",
      name: "Ramada Plaza by Wyndham Waikiki",
      summary: "Straightforward Waikiki accommodations with three room choices.",
      rooms: [
        { id: "standard-king", name: "Standard Room — 1 King Bed", nightlyRate: 198, nights: 2, knownPayAtProperty: 0, estimatedTaxes: 58.78, taxesFeesLabel: "Occupancy tax included: $58.78", cancellationLabel: "Free cancellation before March 17, 2027", paymentLabel: "[CONFIRM]" },
        { id: "balcony-king", name: "Balcony Room — 1 King Bed", nightlyRate: 227, nights: 2, knownPayAtProperty: 0, estimatedTaxes: 67.38, taxesFeesLabel: "Occupancy tax included: $67.38", cancellationLabel: "Free cancellation before March 17, 2027", paymentLabel: "[CONFIRM]" },
        { id: "balcony-city-double", name: "Balcony + City View Room — 2 Double Beds", nightlyRate: 238, nights: 2, knownPayAtProperty: 0, estimatedTaxes: 70.65, taxesFeesLabel: "Occupancy tax included: $70.65", cancellationLabel: "Free cancellation before March 17, 2027", paymentLabel: "[CONFIRM]" },
      ],
    },
  ],
  groupBenefits: ["[CONFIRM WITH NCL GROUP DEPARTMENT]"],
};

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);