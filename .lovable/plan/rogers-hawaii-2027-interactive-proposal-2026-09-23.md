# Rogers Hawaii 2027 Interactive Proposal

## Goal
Replace the current Rogers Hawaii group page with a polished, client-facing proposal where each traveler or couple can mix and match one of two sailings, five cabin categories, three Waikiki hotels, room types, Free at Sea preferences, service-charge preferences, excursions, and special requests.

Submissions will be saved for **advisor review first**. They will not create a confirmed booking, payment schedule, or payment link until Crestwell reviews and confirms the selection.

## Client Experience
- Present a premium Hawaii introduction for **Norwegian Cruise Line Pride of America**, with a two-night Waikiki stay immediately before the chosen sailing.
- Show a clear sailing comparison for:
  - March 20–27, 2027
  - March 27–April 3, 2027
- Show the exact supplied cabin prices for both dates, highlighting Inside, Oceanview, and Balcony while retaining Club Balcony Suite and Suite as upgrades.
- Add a guided vacation builder:
  1. Sailing
  2. Cabin
  3. Hotel
  4. Hotel room
  5. Free at Sea preference
  6. Service-charge preference
  7. Excursion interest
  8. Traveler details and special/accessibility requests
- Update room choices immediately after the traveler selects a hotel.
- Calculate known costs live: cabin total, two-night hotel base, and the OUTRIGGER $48 pay-at-property amount.
- Keep all unknown cruise taxes, hotel taxes/fees, service charges, Free at Sea costs, group benefits, and unconfirmed excursion costs outside the estimated total and label them clearly as requiring confirmation.
- Show example mix-and-match configurations as illustrations only, never recommendations or mandatory packages.
- Include the requested pricing and booking disclosures before submission.

## Content and Accuracy
- Use only the supplied cruise and hotel amounts.
- Preserve `[CONFIRM]` and `[ENTER ACTUAL AMOUNT]` for missing facts rather than inventing values.
- Verify current official NCL language for Free at Sea, shore-excursion credit rules, daily service charges, and Free at Sea Plus. Any term that cannot be tied confidently to this specific sailing will remain marked for confirmation.
- Present Maui, Hilo, Kona, and Kauai excursion ideas as approximate planning examples, clearly separated from confirmed booking prices.
- Present group benefits as pending NCL group-department confirmation unless a confirmed benefit exists in the trip record.

## CRM and Advisor Workflow
- Add a structured Hawaii proposal configuration to the trip so Crestwell can update sailings, cabin prices, hotel rates, fees, benefits, and availability without rebuilding the page.
- Add a dedicated selection record for each submitted party, including:
  - traveler and party details
  - selected sailing and dates
  - cabin category and quoted price snapshot
  - hotel, room, nightly price, dates, and known fees
  - Free at Sea, service-charge, excursion, benefit, and upgrade choices
  - known-cost total, per-person estimate, confirmation-needed items
  - original quoted total and separate final confirmed total
  - payment/booking status, special requests, accessibility needs, comments, and advisor notes
- Notify the assigned advisor when a selection is submitted.
- Keep submitted selections in a review state. Do not create accounting entries until the advisor converts one into a real booking.
- Add a staff view on the Rogers trip so the advisor can review each structured submission and later enter a confirmed total without overwriting the original quote.

## Existing Rogers Data
- Update the parent trip dates and presentation to the two new sailing choices rather than the obsolete March 6 setup.
- Remove the three existing Tim Crestwell/John Thomas test reservations and their related test-only sub-trips, signups, bookings, payment links, and copied itinerary data. Do not remove their client accounts.
- Replace the existing four cabin entries with the exact date-specific pricing supplied in the request.

## Design
- Use Crestwell’s established premium navy/gold visual language with Playfair Display headings, restrained ocean-blue accents, crisp comparison tables, and real Hawaii/cruise imagery.
- Avoid a long wall of text by using sections, compact comparison tables, disclosure panels, and a persistent cost summary on larger screens.
- Make the full experience usable on phones, including selection controls, comparison tables, calculator, and submission form.
- Keep the page on `app.crestwelltravels.com/group/904395d031d5baef84b4f0ed`.

## Technical Details
- Extend the existing token-based group page rather than creating an unrelated proposal system.
- Store editable proposal configuration in the trip’s landing-page configuration.
- Create a dedicated, access-controlled proposal-selection table for immutable quoted snapshots and later confirmed values; advisors see only records belonging to their trips, while public visitors can submit only through the rate-limited server function.
- Validate every submitted option against the server-side trip configuration and recompute totals server-side; never trust totals sent by the browser.
- Preserve existing group pages by activating the specialized Hawaii proposal only when the trip contains the new proposal configuration.
- Update the confirmation email to summarize the requested selections and explain that Crestwell will review pricing before anything is booked.
- Verify the public page and advisor review flow on desktop and mobile, including dynamic hotel rooms, both sailing price sets, cost math, required fields, and successful submission.
