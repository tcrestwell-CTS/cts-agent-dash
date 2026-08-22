# Crestwell Agent Dashboard — User Guide

_Version 2026.08_

Features marked **NEW** were added in the most recent release cycle.

## Contents

- [Getting Started](#getting-started)
- [Clients & Leads](#clients-leads)
- [Trips & Itineraries](#trips-itineraries)
- [Bookings & Suppliers](#bookings-suppliers)
- [Payments & Client Money](#payments)
- [Client Portal](#client-portal)
- [Advisor Tools & Storefronts](#advisor-tools)
- [Back Office & Reporting](#back-office)
- [Team & Training](#team-training)

<a id="getting-started"></a>

## Getting Started

_Sign in, find your way around, and understand the Crestwell workflow._

### The Crestwell workflow

Every piece of business moves through the same lifecycle: Lead → Qualified → Trip → Proposal → Booked → Traveled → Closed. Leads live in CRM, trips live in Trips, and money lives in Commissions and the Back Office. If a record feels stuck, check that the previous stage is complete — most gates (payments, approvals, booking status) are enforced by the stage before them.

### Sidebar layout

Navigation is grouped by what you are doing: Work (dashboard, CRM, scheduling, inboxes), Trips (trips, trip builder, bookings, suppliers, commissions), Search (cruise, hotel, flight, excursions, car rentals, financing), Marketing, and Grow. Admin, bookkeeper, and back-office groups appear only for the roles that own them.

Where: `/`

### Roles and access

Admin sees everything. Office Admin manages team and training. Bookkeeper sees financial reporting and reconciliation. Travel Advisors see their own clients, trips, payments, and storefront. Dashboard access can be enabled or disabled per advisor in Team Management.

Where: `/team`

<a id="clients-leads"></a>

## Clients & Leads

_Capture, qualify, assign, and enrich client records._

### Lead assignment to advisors **NEW**

Leads that arrive from an advisor's storefront or group page are automatically assigned to that advisor. Both you and the assigned advisor receive a notification, and all follow-up email to the client is sent with the assigned advisor's branding, logo, and reply-to address.

Where: `/leads`

### Passport capture with OCR **NEW**

On a client record, upload a passport image or PDF and the system reads the name, number, nationality, and expiry automatically, then writes them to the client profile. Always eyeball the parsed values before saving — glare and worn documents can produce misreads.

Where: `/crm`

### Intake forms & questionnaires **NEW**

Build a client questionnaire in Form Builder using text, date, dropdown, checkbox, and file-upload fields, then share the public link (/intake/your-slug). Submissions land against the client record so preferences, passport docs, and traveler details arrive before your first call.

Where: `/forms`

### Companions and travelers

Add companions on the trip or client record. Companion data syncs to the primary client and to the advisor's records, and drives cabin occupancy fields on group trips.

### Business contacts (B2B)

Corporate and group-organizer contacts are kept separate from leisure leads, with normalized CSV import for lists you bring in from events.

Where: `/business-contacts`

<a id="trips-itineraries"></a>

## Trips & Itineraries

_Build, brand, publish, and version client-facing itineraries._

### Trip Builder workspace **NEW**

Trip Builder is the single place to assemble a trip: pick or search a trip from the entry screen, then work through days, bookings, pricing, and publishing with breadcrumbs back to the trip record. Trip details adapt to trip type — cruises ask for ship name, resort and land trips ask for hotel name.

Where: `/trip-builder`

### Import an itinerary from PDF or Word **NEW**

Use Import Itinerary on a trip to upload a supplier PDF or DOCX. Text is extracted, grouped by layout, and parsed by AI into day-by-day entries — including deriving day numbers from calendar dates. Review the proposed days, edit anything that looks off, then save into the itinerary.

### Itinerary photos & gallery **NEW**

Generated itineraries pull destination photography automatically, and you can curate images per day in the gallery. Published itineraries show the gallery to the client in their portal.

### Itinerary templates **NEW**

Save a day structure as a reusable template, then apply it to a new trip and adjust dates. Template days can be edited independently of the trips built from them.

Where: `/template-library`

### Publishing & versioning

Publishing writes a snapshot of the itinerary the client sees, so later edits never silently change an approved document. Itineraries can carry their own departure and return dates that override the trip-level dates.

Where: `/publish-manager`

### Group trips and sub-trips **NEW**

A group trip is a parent record; each household or cabin is a sub-trip linked to it. New sub-trips inherit the parent's destination, dates, ship or hotel, and supplier defaults. Cabin and category options are editable directly on the parent trip and drive what group members can pick.

### Advisor tags on trips **NEW**

Trips list and Kanban views show an advisor tag on every card, and you can filter the pipeline by advisor to see exactly whose book of business a trip belongs to.

Where: `/trips`

<a id="bookings-suppliers"></a>

## Bookings & Suppliers

_Search inventory, record bookings, and keep supplier data clean._

### Search: cruise, hotel, air, excursions **NEW**

Cruise search covers MSC (flat-file search, live booking API) and Widgety inventory. Hotel search runs on Hotelbeds and returns USD pricing with conversion applied to supplier responses. Flights run through Duffel with live monitoring of schedule changes. Excursions run through Viator, and land packages through Project Expedition.

Where: `/cruises`

### Parse a supplier confirmation **NEW**

Paste or upload a vendor confirmation email or PDF and the parser extracts confirmation number, supplier, travelers, dates, and amounts into a draft booking for review. This is the fastest way to get an offline booking into the system accurately.

### Booking prerequisites

A trip can only move to Booked when the required booking data is present — supplier, confirmation number, gross, and cost. Deletion is blocked while payments or card authorizations are attached to a record.

Where: `/bookings`

<a id="payments"></a>

## Payments & Client Money

_Collect, split, remind, and reconcile client payments._

### Split payments for shared bookings **NEW**

Two travelers sharing one cabin no longer need duplicate bookings. On the trip's Payments tab, choose Split Payment, select the booking, and assign payers from the traveler list or by manual entry. Shares split equally by default and are fully editable, and you can auto-generate monthly installments per payer. Each payer gets their own Stripe link and their own portal balance while the booking keeps a single invoice. Splitting applies to Stripe card and checkout payments only — Affirm, Uplift FlexPay, and manually logged payments behave exactly as before. Advisors can set split defaults on their own profile.

### Logging a payment

Log Payment sits at the front of the Payments toolbar. You can attribute a manual or link-based payment to a specific payer share, and the portal shows the payer's name beside each line item.

### Stripe fees

Stripe processing fees are captured per payment, so trip balances and reporting reflect net proceeds rather than gross charge amounts. Fees are visible in reconciliation and in the daily payment report.

Where: `/recon/stripe`

### Payment plans and reminders

Installment plans run monthly with a five-day grace period and auto-cancel rules. Reminder emails explain that payments are processed through Crestwell Travel Network as the host agency, and carry the assigned advisor's branding.

Where: `/payment-reminders`

### Financing options

Affirm virtual cards and Uplift FlexPay are offered to qualified clients, with DTI checks, auto-pay setup, and accounting sync on approved applications.

Where: `/loan-applications`

### Card data handling

Card authorizations are stored encrypted. Advisors retrieve PAN, CVC, and expiry through a gated View CC Info action that requires re-authentication, shows values for 60 seconds, and expires the record after 30 days.

Where: `/payment-security`

<a id="client-portal"></a>

## Client Portal

_What your clients see, approve, and pay._

### Three-step approval and payment flow **NEW**

The portal walks the client through a clear stepper: review the itinerary, approve and e-sign, then pay. Payment options unlock only after approval, and the flow blocks duplicate payments on the same balance.

### Pricing breakdown

Clients see line-itemized costs with pass-through items presented appropriately and internal margin masked.

### Push notifications and messages **NEW**

Clients receive push notifications for itinerary updates, payment events, and advisor messages. Advisor replies appear in your notification bell and in the chat widget with unread badges.

### Admin preview

Open a read-only preview of any client's portal to see exactly what they see before you send a link.

Where: `/portal-management`

### Post-trip surveys

Returning clients automatically receive a branded feedback survey; responses roll up for review and testimonials.

Where: `/trip-feedback`

<a id="advisor-tools"></a>

## Advisor Tools & Storefronts

_Your own brand, your own leads._

### Agent storefronts **NEW**

Each advisor gets a storefront at yourcompany.crestwelltravels.com with a rotating hero banner, featured trips, and a lead capture form. Leads submitted there are auto-assigned to you, and client email uses your logo and branding.

### Group landing pages **NEW**

Group pages carry the advisor's logo rather than the host agency's, and share cleanly on Facebook with proper preview images and titles.

### Donna — AI trip assistant **NEW**

Donna generates destination guides, itinerary copy, and trip suggestions from inside a trip. Donna's chat is separate from Team chat so agent conversations and AI drafting never get mixed up.

### Notes Chat **NEW**

Ask questions across your notes, client records, and call transcripts in plain language and get sourced answers.

Where: `/notes-chat`

### AI Notetaker **NEW**

Nadia captures client calls and turns them into structured notes and follow-up tasks on the client record.

<a id="back-office"></a>

## Back Office & Reporting

_Admin and bookkeeper financial control._

### Agency Back Office **NEW**

All financial and accounting work now lives in one hub for admins and bookkeepers: payouts, supplier payments due, reconciliation, QBO health, issued cards, and monthly close.

Where: `/back-office`

### Commission statements with multi-splits **NEW**

A commission line can be split across multiple advisors and mentors with per-line percentages, then confirmed for payout. Overrides above the line's revenue trigger admin approval.

Where: `/commissions`

### Expected commissions **NEW**

The commission report tracks an Expected status so bookings that are sold but not yet paid by the supplier stay visible in your forecast instead of disappearing.

Where: `/commission-report`

### Daily payment report **NEW**

A daily report of client payments with KPI summaries, a By Month tab, and client filters. It is also emailed on a schedule.

Where: `/reports/daily-payments`

### Stripe & QBO reconciliation

Reconciliation matches Stripe payouts to logged payments, flags mismatches and orphans by payment intent, and pushes approved entries into QuickBooks through the accounting lifecycle.

Where: `/recon/dashboard`

### Margin engine

Booking margin lines are the source of truth for every total. Trip and agency figures always come from the margin calculation, and minimum-margin rules warn you before a trip is closed under target.

<a id="team-training"></a>

## Team & Training

_Onboarding, permissions, and curriculum._

### Invites and onboarding

Invite advisors by email with a token-based link and a role. New advisors receive the onboarding guides automatically, and their identity details feed card issuing and compliance requirements.

Where: `/team`

### Dashboard access toggle **NEW**

Admins can enable or disable an advisor's dashboard access from their team profile without deleting the account.

### Training library

Phases, modules, lessons, quizzes, and badges are available to all advisors, with admin reporting on completion.

Where: `/training`
