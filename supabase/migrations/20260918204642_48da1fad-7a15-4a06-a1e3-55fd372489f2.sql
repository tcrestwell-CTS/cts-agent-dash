
INSERT INTO public.training_quizzes (title, description, passing_score, retry_limit, status, created_by) VALUES
('Orientation Knowledge Check','Confirm you understand how CTN works, who owns the client record, and your contractor terms.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('Industry Foundations Knowledge Check','Money flow, commissions, credentials and supplier terms.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('Compliance Knowledge Check','Critical compliance questions. A perfect score is required.',100,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('Quoting and Itineraries Knowledge Check','Research, quoting, margin and itinerary delivery.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('CRM and Booking Operations Knowledge Check','Pipeline hygiene, itemising bookings and record quality.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('Cruise Sales Knowledge Check','Cruise pricing, packages, group space and the CLIA ladder.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('Resorts and All-Inclusive Knowledge Check','Resort categories, inclusions and celebration bookings.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('Packages and Specialty Travel Knowledge Check','Packages, tours, family travel and niche selection.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('Group Travel Knowledge Check','Group concepts, contracts, rooming lists and complimentary space.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('Marketing Knowledge Check','Branding within CTN rules, content, reviews and image rights.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('Client Service Knowledge Check','Pre-departure service, disruption handling and service recovery.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('Business Growth Knowledge Check','Planning, revenue tracking, fees and retention.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562'),
('Product Experience Knowledge Check','Why product experience matters and how the two capstone formats work.',80,3,'published','5c2d70a4-a902-47fa-aaf0-f29fc2eb1562');

INSERT INTO public.training_quiz_questions (quiz_id, question_text, answer_options, correct_answer, explanation, sort_order)
SELECT q.id, v.question, v.opts::jsonb, v.correct, v.expl, v.ord
FROM (VALUES
-- Orientation
('Orientation Knowledge Check','Who owns the client record for a booking you make through CTN?','["The advisor personally","Crestwell Travel Network, with the advisor servicing the client","The supplier","Whoever paid the deposit"]','Crestwell Travel Network, with the advisor servicing the client','Client records belong to CTN; advisors service them under the contractor agreement.',1),
('Orientation Knowledge Check','As an independent contractor with CTN, how is your income reported?','["W-2 wages with tax withheld","On a 1099, with no tax withheld","It is not reported","Only if you exceed 100 bookings"]','On a 1099, with no tax withheld','Contractors receive a 1099 and are responsible for their own taxes.',2),
('Orientation Knowledge Check','Which email and domain may you use with clients?','["Any personal address you like","An approved CTN address and approved branding","Your supplier portal address","A free address branded as the supplier"]','An approved CTN address and approved branding','Communication standards require approved addresses, logos and disclosures.',3),
('Orientation Knowledge Check','If you leave CTN, what happens to client records and pending commissions?','["Records stay with CTN and commissions follow the agreement terms","You take the client list with you","All pending commissions are forfeited automatically","Suppliers decide case by case"]','Records stay with CTN and commissions follow the agreement terms','Departure terms are set in the contractor agreement, including offsets and payout timing.',4),
-- Foundations
('Industry Foundations Knowledge Check','In a typical booking, who pays the advisor commission?','["The client, on top of the fare","The supplier, out of the gross fare","CTN, from membership dues","The credit-card processor"]','The supplier, out of the gross fare','Commission flows from the supplier to the agency, then splits to the advisor.',1),
('Industry Foundations Knowledge Check','Which statement about IATA/IATAN is correct?','["It is an individual advisor certification","It is an agency-level accreditation, not an individual credential","It replaces a seller-of-travel registration","It is issued by CLIA"]','It is an agency-level accreditation, not an individual credential','IATAN accreditation sits at agency level; advisor credentials come from bodies like The Travel Institute, ASTA and CLIA.',2),
('Industry Foundations Knowledge Check','What is a net rate?','["The price after commission is removed","The price including all taxes","The deposit amount","The supplier list price"]','The price after commission is removed','Net rates exclude commission; the sell price is built on top.',3),
('Industry Foundations Knowledge Check','Why does the final payment date matter more than the deposit date?','["It is when penalties and cancellation terms tighten sharply","It is when commission is paid","It is when the passport must be renewed","It has no practical impact"]','It is when penalties and cancellation terms tighten sharply','Missing final payment risks auto-cancellation and penalties.',4),
-- Compliance (100%)
('Compliance Knowledge Check','How should a client credit-card number be handled?','["Stored in your personal notes app","Emailed to the supplier","Entered only through the approved secure form, never stored by you","Texted to the client for confirmation"]','Entered only through the approved secure form, never stored by you','Card data must stay inside approved secure channels with limited visibility and expiry.',1),
('Compliance Knowledge Check','A client asks you to advise whether their visa situation is legal. What do you do?','["Give your best legal opinion","Provide official source information and tell them to confirm with the authority or counsel","Guarantee entry","Book it and hope for the best"]','Provide official source information and tell them to confirm with the authority or counsel','Advisors share official requirements; they do not give legal advice.',2),
('Compliance Knowledge Check','Which practice helps prevent fraud and chargebacks?','["Accepting a card from someone not travelling with no authorisation","Collecting a signed card authorisation and verifying the cardholder","Skipping documentation to close faster","Splitting payment across unknown cards"]','Collecting a signed card authorisation and verifying the cardholder','Signed authorisations and cardholder verification are required controls.',3),
('Compliance Knowledge Check','How must advertised pricing be presented?','["Lowest possible number, details later","Accurate and complete, with mandatory fees and conditions disclosed","Without cancellation terms","Supplier photos only, no price"]','Accurate and complete, with mandatory fees and conditions disclosed','Advertising and pricing disclosures must be truthful and complete.',4),
-- Quoting
('Quoting and Itineraries Knowledge Check','Which items should be excluded from margin calculations?','["Insurance premiums","Pass-through items such as government taxes and port fees","Hotel nights","Tour costs"]','Pass-through items such as government taxes and port fees','Pass-through lines are excluded so they do not distort margin and commission math.',1),
('Quoting and Itineraries Knowledge Check','Where does margin most commonly leak?','["Quoting from stale rates and absorbing changes silently","Using the current supplier rate","Itemising the quote","Confirming the final payment date"]','Quoting from stale rates and absorbing changes silently','Refresh rates before presenting and re-quote when supplier pricing changes.',2),
('Quoting and Itineraries Knowledge Check','What is the safest approach to air connections on a cruise departure day?','["Same-day tight connection to save money","Arrive a day early where possible","Book the last flight of the day","Let the client choose without guidance"]','Arrive a day early where possible','Early arrival protects against delays and missed sailings.',3),
('Quoting and Itineraries Knowledge Check','For a multi-payer group trip, what must the quote make clear?','["Only the total","Each payer share, deposits and deadlines","The supplier net rate","Your commission"]','Each payer share, deposits and deadlines','Payer shares and deadlines prevent disputes and missed payments.',4),
-- CRM
('CRM and Booking Operations Knowledge Check','What must exist before a trip can be marked booked?','["A client record and a confirmed booking with supplier details","A quote only","A verbal agreement","An itinerary draft"]','A client record and a confirmed booking with supplier details','Booked status requires real confirmation data on the booking.',1),
('CRM and Booking Operations Knowledge Check','Why is itemising a booking correctly important?','["It looks tidy","It drives the invoice, margin and commission figures","It is required by the supplier","It speeds up the search"]','It drives the invoice, margin and commission figures','Line items are the source of truth for financial totals.',2),
('CRM and Booking Operations Knowledge Check','What does the client portal let the client do?','["Change supplier pricing","Review and approve the itinerary and make payments","Edit the booking record","Contact the supplier directly"]','Review and approve the itinerary and make payments','Approvals unlock payment options in the portal.',3),
('CRM and Booking Operations Knowledge Check','What is a booking-quality audit checking for?','["Photo quality","Complete, accurate documentation and financial detail on the booking","Client satisfaction score","Marketing reach"]','Complete, accurate documentation and financial detail on the booking','Audits confirm records are complete enough to defend and reconcile.',4),
-- Cruise
('Cruise Sales Knowledge Check','Which CLIA level comes first on the counsellor ladder?','["ACC","CCC","MCC","ECC"]','CCC','The ladder runs CCC, ACC, MCC, then ECC.',1),
('Cruise Sales Knowledge Check','What must be logged to progress toward ACC?','["Only quiz scores","Stateroom bookings, ship inspections, personal cruises and course credits","Social posts","Client reviews"]','Stateroom bookings, ship inspections, personal cruises and course credits','ACC requires real activity minimums, tracked in the Academy dashboard.',2),
('Cruise Sales Knowledge Check','Government taxes and port fees on a cruise quote are best treated how?','["As margin","As pass-through lines","As a discount","As commission"]','As pass-through lines','They are collected on behalf of authorities and excluded from margin.',3),
('Cruise Sales Knowledge Check','What is the most common cruise-booking mistake to avoid?','["Confirming the final payment date","Missing the penalty and final payment schedule","Quoting the cabin category","Explaining dining packages"]','Missing the penalty and final payment schedule','Penalty dates drive cancellation exposure and must be tracked.',4),
-- Resorts
('Resorts and All-Inclusive Knowledge Check','What should you verify before promising an all-inclusive inclusion?','["The brochure cover","The specific resort and room-category inclusions in the supplier terms","The client budget","The airline meal"]','The specific resort and room-category inclusions in the supplier terms','Inclusions vary by property and room category.',1),
('Resorts and All-Inclusive Knowledge Check','How reliable are resort star ratings?','["Globally standardised","They vary by supplier and destination, so describe the experience honestly","Set by governments everywhere","Set by advisors"]','They vary by supplier and destination, so describe the experience honestly','Ratings are inconsistent; honest description protects the client relationship.',2),
('Resorts and All-Inclusive Knowledge Check','A family with young children asks for an adults-only resort. What do you do?','["Book it anyway","Explain the age policy and offer suitable family options","Ask the supplier to waive the policy","Leave it to the resort at check-in"]','Explain the age policy and offer suitable family options','Age policies are enforced at check-in; set expectations early.',3),
('Resorts and All-Inclusive Knowledge Check','For a destination wedding or honeymoon, what matters most in the quote?','["Only the room rate","Documentation, legal requirements, transfers and celebration inclusions","The flight time","The airline lounge"]','Documentation, legal requirements, transfers and celebration inclusions','Celebration bookings carry extra documentation and logistics.',4),
-- Packages
('Packages and Specialty Travel Knowledge Check','What typically makes a vacation package cheaper than booking parts separately?','["A bundled contract rate across air, hotel and transfers","Removing taxes","Skipping transfers","Lower commission"]','A bundled contract rate across air, hotel and transfers','Packages combine contracted components at a bundled price.',1),
('Packages and Specialty Travel Knowledge Check','What is the key difference between escorted and independent tours?','["Price only","An escorted tour includes a guide and fixed group itinerary","Independent tours have no hotels","Escorted tours exclude transfers"]','An escorted tour includes a guide and fixed group itinerary','Independent tours leave day-to-day choices to the traveller.',2),
('Packages and Specialty Travel Knowledge Check','Why choose a niche?','["To limit your income","To build expertise, referrals and repeat business","Because CTN requires one","To avoid cruise bookings"]','To build expertise, referrals and repeat business','Focus makes marketing and selling far more efficient.',3),
('Packages and Specialty Travel Knowledge Check','What must you confirm on international air before ticketing?','["Seat colour","Names matching passports, connection times and baggage rules","Meal preference only","Loyalty number only"]','Names matching passports, connection times and baggage rules','Name and timing errors after ticketing are costly or unfixable.',4),
-- Group
('Group Travel Knowledge Check','What does blocked inventory mean in a group contract?','["Rooms held for your group under contract terms","Rooms the supplier cancelled","Unavailable rooms","Discounted single rooms"]','Rooms held for your group under contract terms','Blocked space carries review dates and release terms.',1),
('Group Travel Knowledge Check','What is the group leader responsible for?','["Supplier payments","Recruiting and communicating with the group alongside you","Setting commission","Issuing tickets"]','Recruiting and communicating with the group alongside you','The leader drives recruitment; you manage the trade side.',2),
('Group Travel Knowledge Check','What must be communicated early to every group traveller?','["Your commission","Payment schedule, deadlines and cancellation terms","Supplier net rates","Amenity point totals"]','Payment schedule, deadlines and cancellation terms','Clear deadlines prevent cancellations and disputes.',3),
('Group Travel Knowledge Check','How should complimentary space be handled?','["Kept quietly as extra profit regardless of contract","Applied per the supplier contract and disclosed as agreed","Given to the first traveller who asks","Sold at full price"]','Applied per the supplier contract and disclosed as agreed','Comp space terms are contractual and must be applied correctly.',4),
-- Marketing
('Marketing Knowledge Check','How may you use supplier images and trademarks?','["Any way you like","Only as the supplier permits, with required attribution","Edited to remove logos","Only in print"]','Only as the supplier permits, with required attribution','Image and trademark use is limited by supplier terms.',1),
('Marketing Knowledge Check','What must your personal branding include?','["Nothing specific","The approved CTN affiliation and required disclosures","A competitor comparison","Supplier pricing"]','The approved CTN affiliation and required disclosures','Personal brands operate inside CTN branding rules.',2),
('Marketing Knowledge Check','What makes a review or testimonial compliant?','["It is genuine and not edited to mislead","It is written by you","It promises results","It hides the trip date"]','It is genuine and not edited to mislead','Testimonials must be truthful and not misleading.',3),
('Marketing Knowledge Check','What is the purpose of a lead magnet?','["To replace a quote","To trade useful content for permission to follow up","To lower supplier prices","To advertise net rates"]','To trade useful content for permission to follow up','Lead magnets build a permission-based list you can nurture.',4),
-- Client service
('Client Service Knowledge Check','What prevents most in-trip problems?','["Thorough pre-departure service and documentation","Discounting","Waiting for the client to call","Supplier upgrades"]','Thorough pre-departure service and documentation','Most issues trace back to missing pre-departure detail.',1),
('Client Service Knowledge Check','A supplier cancels a hotel two weeks out. What is your first step?','["Tell the client to sort it out","Secure a comparable alternative and document everything before contacting the client with options","Refund from your commission","Wait for the supplier to call"]','Secure a comparable alternative and document everything before contacting the client with options','Come to the client with solutions and a documented record.',2),
('Client Service Knowledge Check','During an in-trip emergency, what matters most?','["Winning the argument","Fast reachable communication and escalation to the right party","Waiting until they return","Posting an update online"]','Fast reachable communication and escalation to the right party','Availability and correct escalation define the response.',3),
('Client Service Knowledge Check','Why document every complaint and resolution?','["To assign blame","To protect the client, you and CTN, and to improve the process","To share on social media","It is optional"]','To protect the client, you and CTN, and to improve the process','Documentation is the basis of service recovery and dispute defence.',4),
-- Business growth
('Business Growth Knowledge Check','What is the honest way to set a revenue goal?','["Pick a number and hope","Work back from commission per booking to bookings needed","Copy another advisor","Wait for referrals"]','Work back from commission per booking to bookings needed','Goals must reduce to a weekly booking and pipeline target.',1),
('Business Growth Knowledge Check','When is a planning fee appropriate?','["Never","When the research work is substantial and the fee is disclosed up front","Only for cruises","After the trip"]','When the research work is substantial and the fee is disclosed up front','Fees must be disclosed and agreed before the work begins.',2),
('Business Growth Knowledge Check','What is the cheapest source of new revenue?','["Paid advertising","Retention and referrals from existing clients","Cold calling","Discounting"]','Retention and referrals from existing clients','Existing relationships convert far more cheaply than new leads.',3),
('Business Growth Knowledge Check','Why develop groups as a growth strategy?','["One relationship produces many bookings","Groups need no contracts","Commissions are unlimited","It avoids documentation"]','One relationship produces many bookings','Group work multiplies output from a single leader relationship.',4),
-- Capstone
('Product Experience Knowledge Check','Why does firsthand product experience matter?','["It replaces training","It makes your recommendations specific and credible","It guarantees upgrades","It removes supplier terms"]','It makes your recommendations specific and credible','Specific firsthand detail is what clients cannot get elsewhere.',1),
('Product Experience Knowledge Check','What is Format A of the capstone?','["A cohort product experience with pre-work and in-destination learning","A written exam","A mentor call","A supplier webinar"]','A cohort product experience with pre-work and in-destination learning','Format A is the group trip or FAM-style experience.',2),
('Product Experience Knowledge Check','What is Format B of the capstone?','["A cruise inspection","Mentor support through your first one to three real client bookings","A marketing course","A compliance review"]','Mentor support through your first one to three real client bookings','Format B is the lower-cost mentored booking bootcamp.',3),
('Product Experience Knowledge Check','Is the capstone required to graduate?','["Yes, it is a hard requirement","No, it is optional but strongly encouraged","Only for cruise advisors","Only for full-time advisors"]','No, it is optional but strongly encouraged','The capstone is encouraged on the certified pathway, not a hard gate.',4)
) AS v(quiz_title, question, opts, correct, expl, ord)
JOIN public.training_quizzes q ON q.title = v.quiz_title;

UPDATE public.training_lessons l
SET quiz_id = q.id, updated_at = now()
FROM (
  SELECT m.sort_order,
         (SELECT x.id FROM public.training_lessons x WHERE x.module_id = m.id ORDER BY x.sort_order DESC LIMIT 1) AS last_lesson_id
  FROM public.training_modules_v2 m
  JOIN public.training_phases p ON p.id = m.phase_id
  WHERE p.title ILIKE '%academy%'
) lm
JOIN (VALUES
 (1,'Orientation Knowledge Check'),
 (2,'Industry Foundations Knowledge Check'),
 (3,'Compliance Knowledge Check'),
 (5,'Quoting and Itineraries Knowledge Check'),
 (6,'CRM and Booking Operations Knowledge Check'),
 (8,'Cruise Sales Knowledge Check'),
 (9,'Resorts and All-Inclusive Knowledge Check'),
 (10,'Packages and Specialty Travel Knowledge Check'),
 (11,'Group Travel Knowledge Check'),
 (12,'Marketing Knowledge Check'),
 (13,'Client Service Knowledge Check'),
 (14,'Business Growth Knowledge Check'),
 (15,'Product Experience Knowledge Check')
) AS map(ord, quiz_title) ON map.ord = lm.sort_order
JOIN public.training_quizzes q ON q.title = map.quiz_title
WHERE l.id = lm.last_lesson_id;
