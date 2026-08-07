import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildXmlRequest, parseAdvisory, readTag, type XmlNode } from "../_shared/msc-xml.ts";
import { parseSearchCruisesResponse } from "../_shared/msc-search-parse.ts";
import { parseAgencyLoginResponse } from "../_shared/msc-agency-login.ts";

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
  agencyLogin: { path: "/mscbee/services/agency/agencylogin", root: "DtsAgencyLoginMessage" },
  originAirports: { path: "/mscbee/services/air/originairports", root: "DtsOriginAirportsListRequest" },
  searchCruises: { path: "/mscbee/services/shoprequest/searchcruisesV1/", root: "DtsSearchCruisesV1" },
  shopRequest: { path: "/mscbee/services/shoprequest/shoprequestV1/", root: "DtsShopRequestMessageV1" },
  book: { path: "/mscbee/services/booking/bookRequestV1/", root: "DtsBookRequestMessageV1" },
  // "One Step Booking": same endpoint/root as book, but assembled entirely
  // from cached fare data and forced into QUOTATION status.
  oneStepBooking: { path: "/mscbee/services/booking/bookRequestV1/", root: "DtsBookRequestMessageV1" },
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

/**
 * Flat, abbreviated field names — DtsSearchCruisesV1 only.
 * Key order follows the published xs:sequence exactly (the schema enforces it).
 */
function searchCruisesBody(p: Record<string, any>): XmlNode {
  return {
    AgentId: p.agentId ?? Deno.env.get("MSC_AGENT_ID") ?? "",
    ArrivalDate: p.arrivalDate,
    BudgetRange: p.budgetRange ?? "0-5000000",
    CabinType: p.cabinType,
    Canvas: p.canvas,
    BookingChannel: "XML",
    ChildInfo: p.childAges?.length ? { ChildAge: p.childAges } : undefined,
    CruiseID: p.cruiseId,
    CurrcyCd: p.currencyCode ?? "USD",
    DepStartDate: p.depStartDate,
    DepEndDate: p.depEndDate,
    Discounts: p.discountCode ? { DiscountCd: [p.discountCode] } : undefined,
    Flight: p.flight ?? "N",
    ItinEmbk: p.itinEmbarkPort,
    LanguageCd: p.languageCode ?? "ENG",
    MktCd: p.marketCode ?? "USA",
    MaxSailingDuration: p.maxNights,
    NoofAdults: p.adults ?? 2,
    NoofChildren: p.children ?? 0,
    OfficeCd: p.officeCode ?? "USA",
    PageNumber: p.pageNumber,
    PaxType: p.paxType,
    PhysicallyChallenged: p.physicallyChallenged ?? "No",
    PortCD: p.portCode,
    // MSC's prescribed approach: search is called with the CruiseID AND the
    // FARE-CD from the cache in PromotionCode. Omitting it makes the gateway
    // fan out across every promotion and is what gets calls throttled.
    PromotionCode: p.promotionCode ?? p.fareCode,
    RecordsPerPage: p.recordsPerPage,
    RegionCode: p.regionCode,
    SailingDuration: p.nights,
    ShipCd: p.shipCode,
    Sort: p.sort ?? "C",
    ThemeCd: p.themeCode,
    // Always send the reduced-payload filters: MSC added them to cut response
    // size and error rates.
    PriceTypes: p.priceTypes?.length ? { PriceType: p.priceTypes } : undefined,
    Categories: p.categories?.length ? { Category: p.categories } : undefined,
    PriceCodes: p.priceCodes?.length ? { PriceCode: p.priceCodes } : undefined,
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
  return dispatchBody(operation, p);
}

/**
 * "One Step Booking" — create a QUOTATION in a single call using only cached
 * fare/item data. MSC requires the chosen fare to be flagged CRUISE-ONLY and
 * NOW-AVL in the cache; the caller is expected to have filtered on those.
 * CabinNo G00000 asks MSC to auto-assign within the category.
 */
function oneStepBookingBody(p: Record<string, any>): XmlNode {
  const personNos = (p.participants ?? []).map((_: unknown, i: number) => i + 1).join(",");

  const packageItems = (p.packageItems ?? []).map((item: Record<string, any>) => ({
    ItemType: item.itemType,
    ItemCode: item.itemCode,
    CategoryCode: item.categoryCode ?? "",
    StartDate: item.startDate ?? p.sailDate,
    EndDate: item.endDate ?? p.sailDate,
    // APPLY-PAX '*' in the cache means "everyone".
    PersonNo: !item.paxApplicability || item.paxApplicability === "*" ? personNos : item.paxApplicability,
  }));

  return {
    Itinerary: p.itinerary,
    BookingAction: { BookOrQuote: "Q" },
    BookingContext: bookingContext(p),
    BookingAddress: {
      AddressLine1: p.address?.line1 ?? "",
      AddressLine2: p.address?.line2 ?? "",
      Email: p.address?.email ?? "",
    },
    SpecialNeedCodeList: { SpecialNeedCode: p.specialNeedCodes ?? ",,,,,,,,," },
    ParticipantList: {
      ParticipantData: (p.participants ?? []).map((pax: Record<string, any>, i: number) => ({
        PersonNo: i + 1,
        LastName: pax.lastName,
        FirstName: pax.firstName,
        PersonType: pax.personType ?? "A",
        PassportData: { PersonNo: i + 1 },
        ParticipantAddress: { PersonNo: i + 1 },
        CouponCode: pax.couponCode ?? "",
        ...(i === 0 ? { LeadPax: "Y" } : {}),
      })),
    },
    ComponentsToBook: {
      ComponentDetails: {
        ItemType: "CRU",
        ItemCode: p.cruiseId,
        CategoryCode: p.categoryCode,
        PromotionCode: p.fareCode,
        CabinNo: p.cabinNo ?? "G00000",
        PersonNo: personNos,
        ...(p.packageCode
          ? {
              PackageItemDefinition: {
                PackageCode: p.packageCode,
                PackageItemDetails: packageItems,
              },
            }
          : {}),
        Dining: { Room: p.dining?.room ?? "M", Seating: p.dining?.seating ?? "N" },
      },
    },
  };
}

function dispatchBody(operation: string, p: Record<string, any>): XmlNode {
  switch (operation) {
    case "agencyLogin":
      // xs:sequence — AgencyID, AgentID, Agentpasswd, AgentpasswdDTS,
      // AgentpasswdNew, then the optional BookingContext.
      return {
        AgencyID: p.agencyId ?? MSC_AGENCY_ID,
        AgentID: p.agentId ?? MSC_USER_ID,
        Agentpasswd: p.password ?? MSC_PASSWORD,
        AgentpasswdDTS: p.passwordDts ?? "",
        ...(p.newPassword ? { AgentpasswdNew: p.newPassword } : {}),
        BookingContext: { BookingChannel: "XML" },
      };
    case "searchCruises":
      return searchCruisesBody(p);
    case "oneStepBooking":
      return oneStepBookingBody(p);
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

    const params = payload?.params ?? {};
    const xml = buildXmlRequest(spec.root, buildBody(operation, params));
    const url = `${baseUrl()}${spec.path}`;

    // Agency Login is also how we validate a credential set, so it may be
    // called with explicit values instead of the stored secrets.
    const creds = operation === "agencyLogin"
      ? {
          userId: params.agentId ?? MSC_USER_ID,
          agencyId: params.agencyId ?? MSC_AGENCY_ID,
          password: params.password ?? MSC_PASSWORD,
        }
      : { userId: MSC_USER_ID, agencyId: MSC_AGENCY_ID, password: MSC_PASSWORD };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        UserId: creds.userId,
        AgencyId: creds.agencyId,
        Password: creds.password,
        "Content-Type": "application/xml",
        Accept: "application/xml",
      },
      body: xml,
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("MSC transport error", operation, res.status, url, text.slice(0, 1500));
      return json(
        { error: "MSC gateway error", status: res.status, operation, url, detail: text.slice(0, 1500) },
        502,
      );
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
      ...(operation === "searchCruises" ? { result: parseSearchCruisesResponse(text) } : {}),
      ...(operation === "agencyLogin" ? { result: parseAgencyLoginResponse(text) } : {}),
      xml: text,
    });
  } catch (e) {
    console.error("msc-cruise error", e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});