import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildXmlRequest, parseAdvisory, readTag, type XmlNode } from "../_shared/msc-xml.ts";

/**
 * MSC Cruises API 3.0 proxy (Phase 2).
 *
 * Stateless POX over HTTPS: no mTLS, no session, no SOAP. Auth is three
 * headers on every request. Routing is by URL path.
 */

const MSC_USER_ID = Deno.env.get("MSC_USER_ID") ?? "";
const MSC_AGENCY_ID = Deno.env.get("MSC_AGENCY_ID") ?? "";
const MSC_PASSWORD = Deno.env.get("MSC_PASSWORD") ?? "";
const MSC_ENV = (Deno.env.get("MSC_ENV") ?? "test").toLowerCase();
const MSC_BASE_URL_OVERRIDE = Deno.env.get("MSC_BASE_URL") ?? "";

/** Test base is documented; production base must come from MSC. */
const TEST_BASE = "https://layer7test.msccruises.com/test";

function baseUrl(): string {
  if (MSC_BASE_URL_OVERRIDE) return MSC_BASE_URL_OVERRIDE.replace(/\/+$/, "");
  if (MSC_ENV === "production") {
    throw new Error(
      "MSC production base URL is not configured. Set the MSC_BASE_URL secret to the production gateway URL supplied by MSC.",
    );
  }
  return TEST_BASE;
}

/** Confirmed endpoint paths. Paths marked null are still pending from MSC. */
const OPERATIONS: Record<string, { path: string | null; root: string }> = {
  originAirports: { path: "/mscbee/services/air/originairports", root: "DtsOriginAirportsListRequest" },
  searchCruises: { path: "/mscbee/services/shoprequest/searchcruisesV1/", root: "DtsSearchCruisesV1" },
  shopRequest: { path: "/mscbee/services/shoprequest/shoprequestV1/", root: "DtsShopRequestMessageV1" },
  book: { path: "/mscbee/services/booking/bookRequestV1/", root: "DtsBookRequestMessageV1" },
  retrieveBooking: { path: "/mscbee/services/cruiseBooking/getBookings/", root: "DtsRetrieveBookingRequestMessage" },
  // Paths not captured in the documentation pack — awaiting MSC.
  discountPaxType: { path: null, root: "DtsDiscountPaxType" },
  priceToBook: { path: null, root: "DtsPriceToBookRequestMessageV1" },
  cabinAvailability: { path: null, root: "DtsCruiseCabinAvailabilityRequest" },
  cabinLock: { path: null, root: "DtsCruiseCabinLockRequestMessage" },
  cabinUpsell: { path: null, root: "DtsCabinUpsellRequestMessage" },
  confirmBooking: { path: null, root: "DtsConfirmBooking" },
  applyPayment: { path: null, root: "DtsApplyPaymentRequest" },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/** Flat, abbreviated field names — DtsSearchCruisesV1 only. */
function searchCruisesBody(p: Record<string, any>): XmlNode {
  return {
    LanguageCd: p.languageCode ?? "ENG",
    OfficeCd: p.officeCode ?? "USA",
    MktCd: p.marketCode ?? "USA",
    CurrcyCd: p.currencyCode ?? "USD",
    AgentId: p.agentId ?? Deno.env.get("MSC_AGENT_ID") ?? "",
    NoofAdults: p.adults ?? 2,
    NoofChildren: p.children ?? 0,
    CruiseID: p.cruiseId,
    // Always send the reduced-payload filters: MSC added them to cut response
    // size and error rates.
    PriceTypes: p.priceTypes?.length ? { PriceType: p.priceTypes } : undefined,
    PriceCodes: p.priceCodes?.length ? { PriceCode: p.priceCodes } : undefined,
    Categories: p.categories?.length ? { Category: p.categories } : undefined,
    BookingChannel: "XML",
    BudgetRange: p.budgetRange ?? "0-5000000",
    Flight: p.flight ?? "N",
    Sort: p.sort ?? "C",
  };
}

/** Long field names nested in BookingContext — every other message. */
function bookingContext(p: Record<string, any>): XmlNode {
  return {
    AgencyID: p.agencyId ?? MSC_AGENCY_ID,
    AgentID: p.agentId ?? Deno.env.get("MSC_AGENT_ID") ?? "",
    OfficeCode: p.officeCode ?? "USA",
    MarketCode: p.marketCode ?? "USA",
    BookingCurrencyCode: p.currencyCode ?? "USD",
    LanguageCode: p.languageCode ?? "ENG",
    BookingChannel: "XML",
  };
}

function buildBody(operation: string, p: Record<string, any>): XmlNode {
  switch (operation) {
    case "searchCruises":
      return searchCruisesBody(p);
    case "originAirports":
      return { ...bookingContext(p), CruiseID: p.cruiseId };
    case "retrieveBooking":
      return { BookingContext: bookingContext(p), BookingNo: p.bookingNo };
    case "discountPaxType":
      return { BookingContext: bookingContext(p), CruiseID: p.cruiseId };
    case "book":
      // xs:sequence — order is enforced by the schema.
      return {
        Itinerary: p.itinerary,
        BookingAction: p.bookingAction ?? { BookOrQuote: p.bookOrQuote ?? "Q" },
        BookingContext: bookingContext(p),
        BookingAddress: p.bookingAddress,
        SpecialNeedCodeList: p.specialNeedCodeList,
        ParticipantList: p.participantList,
        ComponentsToBook: p.componentsToBook,
      };
    default:
      return { BookingContext: bookingContext(p), ...(p.body ?? {}) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    if (!MSC_USER_ID || !MSC_AGENCY_ID || !MSC_PASSWORD) {
      return json(
        {
          error: "MSC credentials are not configured",
          missing: [
            !MSC_USER_ID && "MSC_USER_ID",
            !MSC_AGENCY_ID && "MSC_AGENCY_ID",
            !MSC_PASSWORD && "MSC_PASSWORD",
          ].filter(Boolean),
        },
        503,
      );
    }

    const payload = await req.json().catch(() => ({}));
    const operation = String(payload?.operation ?? "");
    const spec = OPERATIONS[operation];
    if (!spec) {
      return json({ error: `Unknown operation: ${operation}`, supported: Object.keys(OPERATIONS) }, 400);
    }
    if (!spec.path) {
      return json({ error: `Endpoint path for ${operation} has not been supplied by MSC yet` }, 501);
    }

    const xml = buildXmlRequest(spec.root, buildBody(operation, payload?.params ?? {}));
    const url = `${baseUrl()}${spec.path}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        UserId: MSC_USER_ID,
        AgencyId: MSC_AGENCY_ID,
        Password: MSC_PASSWORD,
        "Content-Type": "application/xml",
        Accept: "application/xml",
      },
      body: xml,
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("MSC transport error", operation, res.status);
      return json({ error: "MSC gateway error", status: res.status, operation }, 502);
    }

    // HTTP 200 is not success — AdvisoryInfo decides.
    const advisory = parseAdvisory(text);
    if (advisory.failed) {
      return json({ error: "MSC returned a failure", operation, advisory: advisory.messages }, 422);
    }

    return json({
      operation,
      advisory: advisory.messages,
      bookingNo: readTag(text, "BookingNo"),
      xml: text,
    });
  } catch (e) {
    console.error("msc-cruise error", e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});