export interface AffirmPortalClient {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line_1?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip_code?: string | null;
  address_country?: string | null;
}

type AffirmCheckoutResult =
  | { ok: true; checkoutData: Record<string, unknown> }
  | { ok: false; error: string };

const US_STATE_CODES: Record<string, string> = {
  ALABAMA: "AL",
  ALASKA: "AK",
  ARIZONA: "AZ",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  COLORADO: "CO",
  CONNECTICUT: "CT",
  DELAWARE: "DE",
  FLORIDA: "FL",
  GEORGIA: "GA",
  HAWAII: "HI",
  IDAHO: "ID",
  ILLINOIS: "IL",
  INDIANA: "IN",
  IOWA: "IA",
  KANSAS: "KS",
  KENTUCKY: "KY",
  LOUISIANA: "LA",
  MAINE: "ME",
  MARYLAND: "MD",
  MASSACHUSETTS: "MA",
  MICHIGAN: "MI",
  MINNESOTA: "MN",
  MISSISSIPPI: "MS",
  MISSOURI: "MO",
  MONTANA: "MT",
  NEBRASKA: "NE",
  NEVADA: "NV",
  "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM",
  "NEW YORK": "NY",
  "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND",
  OHIO: "OH",
  OKLAHOMA: "OK",
  OREGON: "OR",
  PENNSYLVANIA: "PA",
  "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN",
  TEXAS: "TX",
  UTAH: "UT",
  VERMONT: "VT",
  VIRGINIA: "VA",
  WASHINGTON: "WA",
  "WEST VIRGINIA": "WV",
  WISCONSIN: "WI",
  WYOMING: "WY",
  "DISTRICT OF COLUMBIA": "DC",
};

function parseName(client?: AffirmPortalClient | null) {
  const firstName = client?.first_name?.trim();
  const lastName = client?.last_name?.trim();

  if (firstName) {
    return {
      first: firstName,
      last: lastName || "",
    };
  }

  const parts = (client?.name?.trim() || "Client").split(/\s+/).filter(Boolean);

  return {
    first: parts[0] || "Client",
    last: parts.slice(1).join(" ") || "",
  };
}

function normalizePhone(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  if (digits.length === 10) {
    return digits;
  }

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return null;
}

function normalizeZipCode(zipCode?: string | null) {
  const digits = (zipCode || "").replace(/\D/g, "");

  if (digits.length >= 5) {
    return digits.slice(0, 5);
  }

  return null;
}

function normalizeState(state?: string | null) {
  const trimmed = state?.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }

  return US_STATE_CODES[trimmed.replace(/\./g, "").toUpperCase()] || null;
}

function normalizeCountry(country?: string | null) {
  const trimmed = country?.trim();

  if (!trimmed) {
    return "USA";
  }

  const upper = trimmed.toUpperCase();

  if (["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(upper)) {
    return "USA";
  }

  return null;
}

export function buildAffirmVcnCheckoutData({
  amount,
  orderId,
  tripName,
  client,
  itemUrl,
}: {
  amount: number;
  orderId: string;
  tripName?: string | null;
  client?: AffirmPortalClient | null;
  itemUrl?: string;
}): AffirmCheckoutResult {
  const email = client?.email?.trim() || null;
  const phone = normalizePhone(client?.phone);
  const addressLine1 = client?.address_line_1?.trim() || null;
  const city = client?.address_city?.trim() || null;
  const state = normalizeState(client?.address_state);
  const zipcode = normalizeZipCode(client?.address_zip_code);
  const country = normalizeCountry(client?.address_country);

  if (!country) {
    return {
      ok: false,
      error: "Affirm is only available for U.S. billing addresses right now.",
    };
  }

  const missingFields: string[] = [];

  if (!email) missingFields.push("email");
  if (!phone) missingFields.push("phone number");
  if (!addressLine1 || !city || !state || !zipcode) missingFields.push("billing address");

  if (missingFields.length > 0) {
    return {
      ok: false,
      error: `Affirm needs your ${missingFields.join(" and ")} before checkout can start.`,
    };
  }

  const name = parseName(client);
  const total = Math.round(Number(amount || 0) * 100);

  return {
    ok: true,
    checkoutData: {
      merchant: {
        user_confirmation_url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/affirm-webhook`,
        user_confirmation_url_action: "POST",
        user_cancel_url: window.location.href,
        public_api_key: "ZCK1H9U6Z640FK0R",
        name: "Crestwell Travel Services",
        use_vcn: true,
      },
      shipping: {
        name: { first: name.first, last: name.last },
        address: {
          line1: addressLine1,
          city,
          state,
          zipcode,
          country,
        },
        phone_number: phone,
        email,
      },
      billing: {
        name: { first: name.first, last: name.last },
        address: {
          line1: addressLine1,
          city,
          state,
          zipcode,
          country,
        },
        phone_number: phone,
        email,
      },
      items: [
        {
          display_name: `Trip Payment – ${tripName || "Travel"}`,
          sku: orderId,
          unit_price: total,
          qty: 1,
          item_url: itemUrl || window.location.href,
        },
      ],
      order_id: orderId,
      metadata: {
        mode: "modal",
        shipping_type: "travel_service",
        booking_ref: orderId,
        itinerary: [{
          type: "cruise",
          sku: orderId,
          display_name: tripName || "Cruise Vacation",
        }],
      },
      total,
      shipping_amount: 0,
      tax_amount: 0,
    },
  };
}