export interface GuideItem {
  title: string;
  body: string;
  isNew?: boolean;
  path?: string;
}

export interface GuideSection {
  id: string;
  title: string;
  summary: string;
  items: GuideItem[];
}

export const USER_GUIDE_VERSION = "2026.08";

export const userGuideSections: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    summary: "Sign in, find your way around, and understand the Crestwell workflow.",
    items: [
      {
        title: "The Crestwell workflow",
        body:
          "Every piece of business moves through the same lifecycle: Lead → Qualified → Trip → Proposal → Booked → Traveled → Closed. Leads live in CRM, trips live in Trips, and money lives in Commissions and the Back Office. If a record feels stuck, check that the previous stage is complete — most gates (payments, approvals, booking status) are enforced by the stage before them.",
      },
      {
        title: "Sidebar layout",
        body:
          "Navigation is grouped by what you are doing: Work (dashboard, CRM, scheduling, inboxes), Trips (trips, trip builder, bookings, suppliers, commissions), Search (cruise, hotel, flight, excursions, car rentals, financing), Marketing, and Grow. Admin, bookkeeper, and back-office groups appear only for the roles that own them.",
        path: "/",
      },
      {
        title: "Roles and access",
        body:
          "Admin sees everything. Office Admin manages team and training. Bookkeeper sees financial reporting and reconciliation. Travel Advisors see their own clients, trips, payments, and storefront. Dashboard access can be enabled or disabled per advisor in Team Management.",
        path: "/team",
      },
    ],
  },
  {
    id: "clients-leads",
    title: "Clients & Leads",
    summary: "Capture, qualify, assign, and enrich client records.",
    items: [
      {
        title: "Lead assignment to advisors",
        body:
          "Leads that arrive from an advisor's storefront or group page are automatically assigned to that advisor. Both you and the assigned advisor receive a notification, and all follow-up email to the client is sent with the assigned advisor's branding, logo, and reply-to address.",
        isNew: true,
        path: "/leads",
      },
      {
        title: "Passport capture with OCR",
        body:
          "On a client record, upload a passport image or PDF and the system reads the name, number, nationality, and expiry automatically, then writes them to the client profile. Always eyeball the parsed values before saving — glare and worn documents can produce misreads.",
        isNew: true,
        path: "/crm",
      },
      {
        title: "Intake forms & questionnaires",
        body:
          "Build a client questionnaire in Form Builder using text, date, dropdown, checkbox, and file-upload fields, then share the public link (/intake/your-slug). Submissions land against the client record so preferences, passport docs, and traveler details arrive before your first call.",
        isNew: true,
        path: "/forms",
      },
      {
        title: "Companions and travelers",
        body:
          "Add companions on the trip or client record. Companion data syncs to the primary client and to the advisor's records, and drives cabin occupancy fields on group trips.",
      },
      {
        title: "Business contacts (B2B)",
        body:
          "Corporate and group-organizer contacts are kept separate from leisure leads, with normalized CSV import for lists you bring in from events.",
        path: "/business-contacts",
      },
    ],
  },
  {
    id: "trips-itineraries",
    title: "Trips & Itineraries",
    summary: "Build, brand, publish, and version client-facing itineraries.",
    items: [
      {
        title: "Trip Builder workspace",
        body:
          "Trip Builder is the single place to assemble a trip: pick or search a trip from the entry screen, then work through days, bookings, pricing, and publishing with breadcrumbs back to the trip record. Trip details adapt to trip type — cruises ask for ship name, resort and land trips ask for hotel name.",
        isNew: true,
        path: "/trip-builder",
      },
      {
        title: "Import an itinerary from PDF or Word",
        body:
          "Use Import Itinerary on a trip to upload a supplier PDF or DOCX. Text is extracted, grouped by layout, and parsed by AI into day-by-day entries — including deriving day numbers from calendar dates. Review the proposed days, edit anything that looks off, then save into the itinerary.",
        isNew: true,
      },
      {
        title: "Itinerary photos & gallery",
        body:
          "Generated itineraries pull destination photography automatically, and you can curate images per day in the gallery. Published itineraries show the gallery to the client in their portal.",
        isNew: true,
      },
      {
        title: "Itinerary templates",
        body:
          "Save a day structure as a reusable template, then apply it to a new trip and adjust dates. Template days can be edited independently of the trips built from them.",
        isNew: true,
        path: "/template-library",
      },
      {
        title: "Publishing & versioning",
        body:
          "Publishing writes a snapshot of the itinerary the client sees, so later edits never silently change an approved document. Itineraries can carry their own departure and return dates that override the trip-level dates.",
        path: "/publish-manager",
      },
      {
        title: "Group trips and sub-trips",
        body:
          "A group trip is a parent record; each household or cabin is a sub-trip linked to it. New sub-trips inherit the parent's destination, dates, ship or hotel, and supplier defaults. Cabin and category options are editable directly on the parent trip and drive what group members can pick.",
        isNew: true,
      },
      {
        title: "Advisor tags on trips",
        body:
          "Trips list and Kanban views show an advisor tag on every card, and you can filter the pipeline by advisor to see exactly whose book of business a trip belongs to.",
        isNew: true,
        path: "/trips",
      },
    ],
  },
  {
    id: "bookings-suppliers",
    title: "Bookings & Suppliers",
    summary: "Search inventory, record bookings, and keep supplier data clean.",
    items: [
      {
        title: "Search: cruise, hotel, air, excursions",
        body:
          "Cruise search covers MSC (flat-file search, live booking API) and Widgety inventory. Hotel search runs on Hotelbeds and returns USD pricing with conversion applied to supplier responses. Flights run through Duffel with live monitoring of schedule changes. Excursions run through Viator, and land packages through Project Expedition.",
        isNew: true,
        path: "/cruises",
      },
      {
        title: "Parse a supplier confirmation",
        body:
          "Paste or upload a vendor confirmation email or PDF and the parser extracts confirmation number, supplier, travelers, dates, and amounts into a draft booking for review. This is the fastest way to get an offline booking into the system accurately.",
        isNew: true,
      },
      {
        title: "Booking prerequisites",
        body:
          "A trip can only move to Booked when the required booking data is present — supplier, confirmation number, gross, and cost. Deletion is blocked while payments or card authorizations are attached to a record.",
        path: "/bookings",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & Client Money",
    summary: "Collect, split, remind, and reconcile client payments.",
    items: [
      {
        title: "Split payments for shared bookings",
        body:
          "Two travelers sharing one cabin no longer need duplicate bookings. On the trip's Payments tab, choose Split Payment, select the booking, and assign payers from the traveler list or by manual entry. Shares split equally by default and are fully editable, and you can auto-generate monthly installments per payer. Each payer gets their own Stripe link and their own portal balance while the booking keeps a single invoice. Splitting applies to Stripe card and checkout payments only — Affirm, Uplift FlexPay, and manually logged payments behave exactly as before. Advisors can set split defaults on their own profile.",
        isNew: true,
      },
      {
        title: "Logging a payment",
        body:
          "Log Payment sits at the front of the Payments toolbar. You can attribute a manual or link-based payment to a specific payer share, and the portal shows the payer's name beside each line item.",
      },
      {
        title: "Stripe fees",
        body:
          "Stripe processing fees are captured per payment, so trip balances and reporting reflect net proceeds rather than gross charge amounts. Fees are visible in reconciliation and in the daily payment report.",
        path: "/recon/stripe",
      },
      {
        title: "Payment plans and reminders",
        body:
          "Installment plans run monthly with a five-day grace period and auto-cancel rules. Reminder emails explain that payments are processed through Crestwell Travel Network as the host agency, and carry the assigned advisor's branding.",
        path: "/payment-reminders",
      },
      {
        title: "Financing options",
        body:
          "Affirm virtual cards and Uplift FlexPay are offered to qualified clients, with DTI checks, auto-pay setup, and accounting sync on approved applications.",
        path: "/loan-applications",
      },
      {
        title: "Card data handling",
        body:
          "Card authorizations are stored encrypted. Advisors retrieve PAN, CVC, and expiry through a gated View CC Info action that requires re-authentication, shows values for 60 seconds, and expires the record after 30 days.",
        path: "/payment-security",
      },
    ],
  },
  {
    id: "client-portal",
    title: "Client Portal",
    summary: "What your clients see, approve, and pay.",
    items: [
      {
        title: "Three-step approval and payment flow",
        body:
          "The portal walks the client through a clear stepper: review the itinerary, approve and e-sign, then pay. Payment options unlock only after approval, and the flow blocks duplicate payments on the same balance.",
        isNew: true,
      },
      {
        title: "Pricing breakdown",
        body:
          "Clients see line-itemized costs with pass-through items presented appropriately and internal margin masked.",
      },
      {
        title: "Push notifications and messages",
        body:
          "Clients receive push notifications for itinerary updates, payment events, and advisor messages. Advisor replies appear in your notification bell and in the chat widget with unread badges.",
        isNew: true,
      },
      {
        title: "Admin preview",
        body:
          "Open a read-only preview of any client's portal to see exactly what they see before you send a link.",
        path: "/portal-management",
      },
      {
        title: "Post-trip surveys",
        body:
          "Returning clients automatically receive a branded feedback survey; responses roll up for review and testimonials.",
        path: "/trip-feedback",
      },
    ],
  },
  {
    id: "advisor-tools",
    title: "Advisor Tools & Storefronts",
    summary: "Your own brand, your own leads.",
    items: [
      {
        title: "Agent storefronts",
        body:
          "Each advisor gets a storefront at yourcompany.crestwelltravels.com with a rotating hero banner, featured trips, and a lead capture form. Leads submitted there are auto-assigned to you, and client email uses your logo and branding.",
        isNew: true,
      },
      {
        title: "Group landing pages",
        body:
          "Group pages carry the advisor's logo rather than the host agency's, and share cleanly on Facebook with proper preview images and titles.",
        isNew: true,
      },
      {
        title: "Donna — AI trip assistant",
        body:
          "Donna generates destination guides, itinerary copy, and trip suggestions from inside a trip. Donna's chat is separate from Team chat so agent conversations and AI drafting never get mixed up.",
        isNew: true,
      },
      {
        title: "Notes Chat",
        body:
          "Ask questions across your notes, client records, and call transcripts in plain language and get sourced answers.",
        isNew: true,
        path: "/notes-chat",
      },
      {
        title: "AI Notetaker",
        body:
          "Nadia captures client calls and turns them into structured notes and follow-up tasks on the client record.",
        isNew: true,
      },
    ],
  },
  {
    id: "back-office",
    title: "Back Office & Reporting",
    summary: "Admin and bookkeeper financial control.",
    items: [
      {
        title: "Agency Back Office",
        body:
          "All financial and accounting work now lives in one hub for admins and bookkeepers: payouts, supplier payments due, reconciliation, QBO health, issued cards, and monthly close.",
        isNew: true,
        path: "/back-office",
      },
      {
        title: "Commission statements with multi-splits",
        body:
          "A commission line can be split across multiple advisors and mentors with per-line percentages, then confirmed for payout. Overrides above the line's revenue trigger admin approval.",
        isNew: true,
        path: "/commissions",
      },
      {
        title: "Expected commissions",
        body:
          "The commission report tracks an Expected status so bookings that are sold but not yet paid by the supplier stay visible in your forecast instead of disappearing.",
        isNew: true,
        path: "/commission-report",
      },
      {
        title: "Daily payment report",
        body:
          "A daily report of client payments with KPI summaries, a By Month tab, and client filters. It is also emailed on a schedule.",
        isNew: true,
        path: "/reports/daily-payments",
      },
      {
        title: "Stripe & QBO reconciliation",
        body:
          "Reconciliation matches Stripe payouts to logged payments, flags mismatches and orphans by payment intent, and pushes approved entries into QuickBooks through the accounting lifecycle.",
        path: "/recon/dashboard",
      },
      {
        title: "Margin engine",
        body:
          "Booking margin lines are the source of truth for every total. Trip and agency figures always come from the margin calculation, and minimum-margin rules warn you before a trip is closed under target.",
      },
    ],
  },
  {
    id: "team-training",
    title: "Team & Training",
    summary: "Onboarding, permissions, and curriculum.",
    items: [
      {
        title: "Invites and onboarding",
        body:
          "Invite advisors by email with a token-based link and a role. New advisors receive the onboarding guides automatically, and their identity details feed card issuing and compliance requirements.",
        path: "/team",
      },
      {
        title: "Dashboard access toggle",
        body:
          "Admins can enable or disable an advisor's dashboard access from their team profile without deleting the account.",
        isNew: true,
      },
      {
        title: "Training library",
        body:
          "Phases, modules, lessons, quizzes, and badges are available to all advisors, with admin reporting on completion.",
        path: "/training",
      },
    ],
  },
];

export const guideNewCount = userGuideSections.reduce(
  (n, s) => n + s.items.filter((i) => i.isNew).length,
  0,
);
