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
  /** Optional room photo URLs shown in a click-to-enlarge gallery. */
  photos?: string[];
  /** Optional in-room amenities listed for guests. */
  amenities?: string[];
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
  hotel: { id: string; name: string; location: string; summary: string; highlights: string[]; amenityGroups?: { title: string; items: string[] }[] };
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
    amenityGroups: [{"title": "Popular", "items": ["Free Internet", "Airport transfer", "Parking", "Swimming pool", "Fitness centre"]}, {"title": "General", "items": ["ATM", "Air conditioning", "Currency exchange", "Elevator/lift", "Express check-in/check-out", "Garden", "Gift shop", "Heating", "Newspapers", "Private check-in/check-out", "Reception desk", "Shopping on site", "Smoke-free property", "Smoking allowed (designated areas)", "Television in lobby", "Terrace", "Ticket assistance"]}, {"title": "Rooms", "items": ["Cable TV", "Hairdryer", "Laptop safe", "Minibar", "Non-smoking rooms", "Room service", "Shower", "Shower/bathtub", "Smoke detector", "TV", "Toiletries", "VIP room amenities"]}, {"title": "Accessibility", "items": ["Accessibility features", "Wheelchair accessible"]}, {"title": "Services", "items": ["Concierge services", "Dry-cleaning (charged separately)", "Ironing (charged separately)", "Laundry (charged separately)", "Luggage storage", "Safe-deposit box", "Telephone", "Wake-up service"]}, {"title": "Meals", "items": ["Bar", "Breakfast", "Breakfast in the room", "Buffet breakfast", "Cafe", "Coffee/tea for guests", "Coffeemaker", "Diet menu (on request)", "Packed lunches", "Restaurant", "Restaurant (buffet style)", "Snack bar"]}, {"title": "Internet & transfers", "items": ["Free Wi-Fi", "Transfer from/to the airport", "Car rental (charged separately)", "Shuttle (charged separately)"]}, {"title": "Languages spoken", "items": ["English", "Spanish", "Multi-language staff"]}, {"title": "Recreation & tours", "items": ["Tour assistance", "Billiards", "Picnic area", "Ping-pong", "Sun deck"]}, {"title": "Parking", "items": ["Garage", "Parking"]}, {"title": "Pool & beach", "items": ["Next to the beach", "Private beach", "Public beach", "Beach facilities", "Beach/pool towels", "Outdoor pool", "Indoor pool", "Pool facilities", "Spa tub"]}, {"title": "Business", "items": ["Business center", "Conference hall", "Event facilities", "Fax and copy machine"]}, {"title": "Sports", "items": ["Fitness facilities", "Gym", "Darts", "Diving", "Golf course (within 3 km)", "Table tennis", "Tennis court", "Yoga"]}, {"title": "Beauty & wellness", "items": ["Spa (charged separately)", "Massage (charged separately)", "Beauty services (charged separately)", "Sauna", "Steam room", "First aid kit"]}, {"title": "Pets", "items": ["Pets not allowed"]}, {"title": "Health & safety", "items": ["Extra decontamination measures", "Personal protection equipment for guests and staff", "Temperature control for guests and staff"]}],
  },
  dates: [
    { id: "2027-02-18", label: "February 18–21, 2027", checkIn: "2027-02-18", checkOut: "2027-02-21", nights: 3 },
    { id: "2027-03-18", label: "March 18–21, 2027", checkIn: "2027-03-18", checkOut: "2027-03-21", nights: 3 },
  ],
  rooms: [
    {
      id: "luxury-double-junior-oceanfront",
      name: "Luxury Double Junior Suite Oceanfront",
      details: "765 sq ft · Ocean view balcony · In-room jetted tub · All-inclusive",
      sizeSqFt: 765,
      minGuests: 1,
      maxGuests: 2,
      pricesByDate: { "2027-02-18": 2886, "2027-03-18": 2605 },
      pricingNote: "Rates shown are for 3 nights, plus taxes and a resort fee of about MXN 497 paid at the hotel. Final shared-room pricing confirmed by your advisor.",
      photos: [
        "/__l5e/assets-v1/2558cb02-6ba3-4dba-b0e8-ecf1a5aaa19c/zilara-luxury-double-198.png",
        "/__l5e/assets-v1/e7823174-80b6-4b66-8a60-0b83bcc6a85f/zilara-luxury-double-199.png",
        "/__l5e/assets-v1/4e0bb9f0-43fa-493a-b26d-7a81108282c3/zilara-luxury-double-200.png",
        "/__l5e/assets-v1/36fe4d64-5a29-4464-b232-9141a39e6a19/zilara-luxury-double-201.png",
      ],
      amenities: [
        "Private bathroom", "Safe", "Coffee", "Air conditioning", "TV",
        "Towels", "Toiletries", "Hairdryer", "Fridge", "Mirror", "Telephone",
      ],
    },
    {
      id: "double-oceanfront-suite",
      name: "Double Oceanfront Suite",
      details: "657 sq ft · Oceanfront · Two beds · All-inclusive",
      sizeSqFt: 657,
      minGuests: 1,
      maxGuests: 4,
      pricesByDate: { "2027-02-18": 3246, "2027-03-18": 2942 },
      pricingNote: "Rates shown are for 3 nights, plus taxes and a resort fee of about MXN 497 paid at the hotel. Final shared-room pricing confirmed by your advisor.",
      photos: [
        "/__l5e/assets-v1/65caa990-6d32-412d-bcd5-35f80a5887f0/zilara-luxury-double-202.png",
        "/__l5e/assets-v1/2852b3ef-1e2e-4f1c-acab-47d6da6952ea/zilara-luxury-double-203.png",
      ],
      amenities: [
        "Private bathroom", "Safe", "Coffee", "Air conditioning", "TV",
        "Toiletries", "Hairdryer", "Fridge", "Workspace",
      ],
    },
    {
      id: "presidential-suite",
      name: "Presidential Suite",
      details: "1,335 sq ft · Oceanfront · Upgraded suite for the bride",
      sizeSqFt: 1335,
      minGuests: 1,
      maxGuests: 2,
      reservedFor: "Bride's upgraded suite",
      pricesByDate: { "2027-02-18": 5466, "2027-03-18": 5410 },
      pricingNote: "Rates shown are for 3 nights, plus taxes and a resort fee of about MXN 497 paid at the hotel. Final shared-room pricing confirmed by your advisor.",
      photos: [
        "/__l5e/assets-v1/fc51928d-6957-48f3-ac65-2807e951a1c0/zilara-presidential-suite-1.png",
        "/__l5e/assets-v1/e376f6b6-1c44-49cc-9c69-856f43f953c8/zilara-presidential-suite-2.png",
        "/__l5e/assets-v1/3afa83f2-2852-4e6b-8688-5270c2e06d8c/zilara-presidential-suite-3.png",
        "/__l5e/assets-v1/f9a0f725-15ce-4271-b199-e0198f84debe/zilara-presidential-suite-4.png",
        "/__l5e/assets-v1/338cd91c-854d-4608-a515-45df641bf1af/zilara-presidential-suite-5.png",
      ],
      amenities: [
        "Private bathroom", "Safe", "Coffee", "Air conditioning", "Suitable for guests with allergies",
        "TV", "Bottled water", "Towels", "Toiletries", "Pillow menu", "Microwave",
        "Ironing facilities", "Hairdryer", "Fridge", "Wardrobe", "Mirror", "Kettle or coffee maker",
        "Telephone", "Blackout blinds", "Fan", "Desk", "Dining area", "Workspace",
      ],
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
