import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "signed-agreements";

const SECTIONS: { heading: string; body: string }[] = [
  { heading: "1. Term.", body: "This Agreement is effective as of the date signed below and remains in effect until terminated in accordance with Section 18." },
  { heading: "2. Duties of Contractor.", body: "Contractor performs this Agreement as a self-employed business person to sell travel services to the general public and/or business entities, in accordance with travel industry ethical standards. Company does not require Contractor to work at Company's place of business, work a stated number of hours, or keep a specific schedule." },
  { heading: "3. Duties of Company.", body: "Company compensates Contractor per the Schedule of Compensation (commission splits by plan tier -- see below)." },
  { heading: "4. Sales Quotas; Minimums; Draws.", body: "Contractor is not required to meet any sales quota, guaranteed any minimum compensation, or entitled to a draw or advance." },
  { heading: "5. Sole Compensation.", body: "Amounts paid per the Schedule of Compensation are Contractor's sole compensation under this Agreement." },
  { heading: "6. Benefits.", body: "Contractor is not an employee and is not eligible for employee benefits such as sick leave, paid time off, medical insurance, or retirement plan participation." },
  { heading: "7. Use of IATA, ARC and CLIA Numbers.", body: "If Contractor is permitted to use Company's IATA, ARC, or CLIA number, Company is entitled to its share of resulting commission. Use of these numbers is strictly limited to this Agreement's purposes." },
  { heading: "8. Offset to Compensation.", body: "Company may deduct from Contractor's compensation the amount of any debit memo, commission recall, customer refund, chargeback, or similar post-sale adjustment connected to a sale completed by Contractor. If the adjustment exceeds available compensation, Contractor must pay the deficit within thirty (30) days of written demand, or Company may carry the shortfall forward against future compensation. This right survives termination." },
  { heading: "9. Expenses.", body: "Contractor is solely responsible for all expenses incurred performing this Agreement (office supplies, business cards, telephone, internet, bank charges, mileage, parking, etc.)." },
  { heading: "10. Compliance with the Law.", body: "Contractor is solely responsible for compliance with all applicable federal, state, and local laws, including state seller of travel registration requirements." },
  { heading: "11. Authority to Bind; Contracts.", body: "Contractor has no authority to bind or obligate Company except as specifically authorized in writing by a Company officer." },
  { heading: "12. Right to Contract with Third Parties.", body: "Both Company and Contractor retain the right to contract with other parties for similar services." },
  { heading: "13. Indemnification.", body: "Contractor agrees to indemnify and hold Company, its officers, employees and agents harmless from any liability claim arising from Contractor's transactions, clients, or acts or omissions, unless attributable to Company's negligence or willful misconduct. This obligation survives termination." },
  { heading: "14. Errors & Omissions Insurance.", body: "Company provides E&O insurance coverage for Contractor as a benefit of good-standing membership in Crestwell Travel Network, contingent on maintaining an active subscription and following Company's booking procedures. This does not relieve Contractor of responsibility for general business conduct outside that coverage's scope." },
  { heading: "15. Relationship of the Parties.", body: "Contractor is an independent contractor; nothing herein creates an employer-employee relationship, partnership, or joint venture. Contractor assumes the full risk of loss if compensation does not cover expenses incurred." },
  { heading: "16. Withholding.", body: "Company pays Contractor in full without withholding any taxes. Contractor is solely responsible for all applicable taxes. Company issues Form 1099 by January 31 each year." },
  { heading: "17. Confidential Information.", body: "Contractor will not use or disclose Company's confidential or proprietary information (business plans, trade secrets, client lists, pricing, supplier information, IATA/ARC/CLIA numbers, etc.) without Company's prior written consent, during or after this Agreement. Company is entitled to equitable relief, including injunction, for any breach." },
  { heading: "18. Termination.", body: "Either Party may terminate without cause upon thirty (30) days' written notice. Either Party may terminate for uncured material breach after five (5) calendar days' notice and opportunity to cure." },
  { heading: "19. Effect of Termination.", body: "Upon termination, Contractor receives all compensation earned but unpaid as of the termination date, must return all Confidential Information and Company property, and must cease all use of Company's intellectual property. Contractor is not entitled to compensation for services after termination." },
  { heading: "20. Non-Solicitation.", body: "During the Agreement and for one (1) year after termination, Contractor will not induce any person engaged by Company to terminate their relationship with Company to instead work with Contractor or a third party." },
  { heading: "21. License to Use Company Marks.", body: "Company grants Contractor a limited, non-exclusive, royalty-free license to use Company's trade name and logo on Contractor's personal storefront, business cards, website, and letterhead, provided Contractor clearly identifies as an \"independent sales agent.\" All use is subject to Company's reasonable prior approval." },
  { heading: "22. Notices.", body: "Notices are deemed given upon delivery to the addresses on file, or such other address as a Party specifies in writing." },
  { heading: "23. Governing Law.", body: "This Agreement is governed by the laws of the State of Tennessee, with exclusive jurisdiction and venue in its courts." },
  { heading: "24. Amendment.", body: "This Agreement may only be amended in a signed writing." },
  { heading: "25. Assignment.", body: "This Agreement may not be assigned by either Party without the other's written consent." },
  { heading: "26. Waiver.", body: "No waiver of any provision is a waiver of any other or future breach." },
  { heading: "27. Entire Agreement.", body: "This Agreement is the entire agreement between the Parties on this subject matter." },
];

const COMPENSATION: { heading: string; body: string }[] = [
  { heading: "Commission Split.", body: "Contractor's share of collected commission, regardless of lead source: Starter Plan -- 70% Contractor / 30% Company; Professional Plan -- 80% Contractor / 20% Company; Elite Plan -- 90% Contractor / 10% Company." },
  { heading: "When Payable.", body: "Commission is due after the sale is invoiced through Company, payment is collected by Company, and the gross commission is received by Company from the supplier. Company pays Contractor within ten (10) days thereafter." },
  { heading: "Unpaid Commissions.", body: "Company has no obligation to pursue unpaid supplier commissions on Contractor's behalf, and no liability for commission earned but not paid by the supplier." },
];

const INTRO =
  "This Independent Contractor Agreement (the \"Agreement\") is between Crestwell Travel Network, a division of Crestwell Travel Services, having its principal place of business in Chattanooga, Tennessee (\"Company\") and the undersigned advisor (\"Contractor\").";

// Strip characters WinAnsi (pdf-lib standard fonts) cannot encode.
function sanitize(s: string): string {
  return String(s)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

function wrap(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function planLabel(plan?: string): string {
  const p = (plan || "").toLowerCase();
  if (p === "professional") return "Professional Plan (80% Contractor / 20% Company)";
  if (p === "elite") return "Elite Plan (90% Contractor / 10% Company)";
  if (p === "starter") return "Starter Plan (70% Contractor / 30% Company)";
  return plan ? `${plan}` : "Not specified";
}


type DocKey = "ic_agreement" | "code_of_ethics" | "media_release" | "data_consent";

interface DocDef {
  key: DocKey;
  title: string;
  label: string;
  required: boolean;
  optionalNote?: string;
  intro: string;
  sections: { heading: string; body: string }[];
  compensation?: { heading: string; body: string }[];
}

const DOCS: DocDef[] = [
  {
    key: "ic_agreement", title: "Independent Contractor Agreement", label: "Independent Contractor Agreement",
    required: true, intro: INTRO, sections: SECTIONS, compensation: COMPENSATION,
  },
  {
    key: "code_of_ethics", title: "Code of Ethics", label: "Code of Ethics", required: true,
    intro: "This Code of Ethics (the \"Code\") applies to every independent contractor advisor (\"Contractor\") affiliated with Crestwell Travel Network (\"Company\"). Contractor agrees to conduct all travel-related business in accordance with this Code as a condition of continued affiliation.",
    sections: [
      { heading: "1. Honesty in Representations.", body: "Contractor will describe destinations, accommodations, transportation, pricing, and travel conditions accurately and will not knowingly misrepresent any product or service to a client. Contractor will promptly correct any error discovered after booking." },
      { heading: "2. Client's Best Interest.", body: "Contractor will recommend travel products based on the client's stated needs, budget, and preferences, not solely on the commission or incentive a supplier offers Contractor." },
      { heading: "3. Transparent Pricing.", body: "Contractor will disclose all fees charged directly by Contractor or Company before a client commits to purchase, and will not add undisclosed markups to supplier pricing." },
      { heading: "4. Client Confidentiality.", body: "Contractor will safeguard client personal, payment, and travel information, use it solely to arrange and support the client's travel, and will not disclose it to third parties except as required to complete a booking or as required by law." },
      { heading: "5. Conflicts of Interest.", body: "Contractor will disclose to Company and, where relevant, to the client, any financial or personal interest that could reasonably affect Contractor's recommendations." },
      { heading: "6. Fair Dealing with Suppliers.", body: "Contractor will represent supplier products accurately, honor supplier terms and conditions, and will not engage in deceptive practices toward any supplier, consortium, or host agency." },
      { heading: "7. Handling of Client Funds.", body: "Contractor will remit client payments through Company's booking and payment procedures and will not accept client funds outside those procedures except as Company expressly authorizes in writing." },
      { heading: "8. Non-Discrimination.", body: "Contractor will provide services without discrimination on the basis of race, color, religion, sex, national origin, age, disability, or any other status protected by applicable law." },
      { heading: "9. Professional Conduct.", body: "Contractor will communicate with clients, suppliers, and Company staff professionally and courteously, and will represent Company's reputation with integrity in all public-facing activity, including social media and marketing content." },
      { heading: "10. Compliance.", body: "Contractor will comply with all applicable travel industry laws and regulations, including state seller-of-travel registration requirements described in the Independent Contractor Agreement, and with any supplier, consortium, or host agency terms applicable to bookings Contractor makes." },
      { heading: "11. Reporting Concerns.", body: "Contractor will promptly report to Company any suspected violation of this Code by another Company-affiliated advisor, and any client complaint alleging a violation of this Code." },
      { heading: "12. Enforcement.", body: "A violation of this Code may result in corrective action up to and including termination of Contractor's Independent Contractor Agreement, at Company's discretion, consistent with the termination provisions of that Agreement." },
    ],
  },
  {
    key: "media_release", title: "Media & Marketing Release", label: "Media & Marketing Release", required: false,
    optionalNote: "This document is optional.",
    intro: "This Media & Marketing Release (the \"Release\") is between Crestwell Travel Network (\"Company\") and the undersigned independent contractor advisor (\"Contractor\"). Signing this Release is optional and is not a condition of Contractor's Independent Contractor Agreement.",
    sections: [
      { heading: "1. Grant of Rights.", body: "Contractor grants Company a non-exclusive, royalty-free, worldwide license to use Contractor's name, likeness, voice, professional biography, photographs, video, and direct quotations or testimonials (collectively, \"Contractor Content\") in Company's marketing and promotional materials, including its website, social media accounts, email campaigns, print materials, and advertising." },
      { heading: "2. Source of Content.", body: "Contractor Content may be supplied by Contractor directly or captured by Company at Company-hosted events, trainings, or promotional sessions Contractor participates in." },
      { heading: "3. No Compensation.", body: "Contractor understands that no additional compensation is paid for use of Contractor Content under this Release." },
      { heading: "4. Accuracy.", body: "Contractor represents that any testimonial or quotation Contractor provides reflects Contractor's genuine experience and opinion." },
      { heading: "5. Duration.", body: "This Release remains in effect while Contractor is affiliated with Company and for a reasonable period afterward solely to allow Company to remove or phase out existing materials already in production or circulation. Contractor may revoke this Release at any time by written notice to Company; revocation applies to new materials and does not require Company to recall previously published materials." },
      { heading: "6. No Obligation to Use.", body: "Company is under no obligation to use any Contractor Content." },
    ],
  },
  {
    key: "data_consent", title: "Data Processing Consent", label: "Data Processing Consent", required: true,
    intro: "This Data Processing Consent (the \"Consent\") explains how Crestwell Travel Network (\"Company\") collects, uses, and stores the personal information of independent contractor advisors (\"Contractor\") in connection with onboarding, verification, and ongoing affiliation.",
    sections: [
      { heading: "1. Information Collected.", body: "Company collects information Contractor provides during application and onboarding, which may include name, address, phone number, email, date of birth, government-issued identification, Social Security Number or Taxpayer Identification Number, banking information for commission payouts, and information from third-party identity verification and background screening services used to evaluate applications." },
      { heading: "2. Purpose of Processing.", body: "Company processes this information to evaluate Contractor's application, verify identity, administer Contractor's affiliation, calculate and pay commissions, issue required tax forms, maintain required business records, and comply with applicable law." },
      { heading: "3. Third-Party Services.", body: "Company uses third-party services for identity verification, background screening, and payment processing. Information Contractor submits during onboarding may be shared with these providers solely to perform these functions on Company's behalf." },
      { heading: "4. Data Security.", body: "Company takes reasonable measures to protect Contractor's personal information from unauthorized access, but no method of storage or transmission is completely secure." },
      { heading: "5. Retention.", body: "Company retains Contractor's personal information for as long as reasonably necessary to fulfill the purposes described in this Consent, including any period required by tax, business record-keeping, or other applicable law after Contractor's affiliation ends." },
      { heading: "6. Contractor's Rights.", body: "Contractor may request access to, correction of, or deletion of their personal information held by Company, subject to Company's legal and business record-keeping obligations, by contacting Company using the information on file." },
      { heading: "7. Consent.", body: "By signing below, Contractor consents to Company's collection, use, and disclosure of Contractor's personal information as described in this Consent, which is required to complete onboarding and maintain Contractor's affiliation with Company." },
    ],
  },
];

async function buildPdf(def: DocDef, input: {
  fullName: string;
  email: string;
  plan?: string;
  signature: string;
  signatureDate: string;
  agreements: Record<string, boolean>;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Crestwell Travel Network - ${def.title}`);
  doc.setAuthor("Crestwell Travel Services");
  doc.setSubject(`Signed ${def.title}`);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 54;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const navy = rgb(0.05, 0.11, 0.22);
  const gray = rgb(0.42, 0.45, 0.5);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let pageCount = 1;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pageCount++;
    y = PAGE_H - MARGIN;
  };

  const need = (h: number) => {
    if (y - h < MARGIN + 40) newPage();
  };

  const text = (
    content: string,
    opts: { font?: any; size?: number; color?: any; gap?: number; indent?: number } = {},
  ) => {
    const font = opts.font || regular;
    const size = opts.size ?? 9.5;
    const indent = opts.indent ?? 0;
    const lines = wrap(content, font, size, CONTENT_W - indent);
    for (const line of lines) {
      need(size + 3);
      page.drawText(line, {
        x: MARGIN + indent,
        y: y - size,
        size,
        font,
        color: opts.color || rgb(0.1, 0.1, 0.12),
      });
      y -= size + 3.5;
    }
    y -= opts.gap ?? 0;
  };

  // Header
  page.drawRectangle({ x: 0, y: PAGE_H - 96, width: PAGE_W, height: 96, color: navy });
  page.drawText("CRESTWELL TRAVEL NETWORK", {
    x: MARGIN, y: PAGE_H - 46, size: 17, font: bold, color: rgb(1, 1, 1),
  });
  page.drawText(sanitize(def.title), {
    x: MARGIN, y: PAGE_H - 66, size: 11, font: regular, color: rgb(0.82, 0.71, 0.42),
  });
  page.drawText("A division of Crestwell Travel Services - Chattanooga, Tennessee", {
    x: MARGIN, y: PAGE_H - 82, size: 8, font: regular, color: rgb(0.75, 0.79, 0.85),
  });
  y = PAGE_H - 118;

  text(`Contractor: ${input.fullName}`, { font: bold, size: 10 });
  text(`Email: ${input.email}`, { size: 9.5 });
  if (def.key === "ic_agreement") text(`Plan Tier: ${planLabel(input.plan)}`, { size: 9.5 });
  text(`Executed: ${input.signatureDate}`, { size: 9.5, gap: 8 });
  if (def.optionalNote) text(def.optionalNote, { font: italic, size: 9.5, color: gray, gap: 6 });

  text(def.intro, { gap: 8 });

  for (const s of def.sections) {
    need(28);
    text(s.heading, { font: bold, size: 9.5 });
    text(s.body, { gap: 6 });
  }

  if (def.compensation) {
    need(40);
    y -= 6;
    page.drawText("SCHEDULE OF COMPENSATION", { x: MARGIN, y: y - 12, size: 12, font: bold, color: navy });
    y -= 24;
    for (const s of def.compensation) {
      need(28);
      text(s.heading, { font: bold, size: 9.5 });
      text(s.body, { gap: 6 });
    }
  }

  // Signature block
  need(230);
  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1,
    color: rgb(0.8, 0.82, 0.86),
  });
  y -= 22;
  page.drawText("ACCEPTANCE AND ELECTRONIC SIGNATURE", { x: MARGIN, y: y - 12, size: 12, font: bold, color: navy });
  y -= 30;

  text(
    `By typing their name below, Contractor acknowledges having read and agreed to this ${def.title}, and adopts the typed name as their legally binding electronic signature.`,
    { size: 9, color: gray, gap: 10 },
  );

  const items = def.key === "ic_agreement"
    ? DOCS.map((d) => ({ label: d.label, key: d.key, required: d.required }))
    : [{ label: def.label, key: def.key, required: def.required }];

  for (const item of items) {
    const checked = !!input.agreements[item.key];
    need(16);
    const boxY = y - 11;
    page.drawRectangle({
      x: MARGIN, y: boxY, width: 10, height: 10,
      borderWidth: 0.8, borderColor: rgb(0.4, 0.42, 0.48),
      color: checked ? navy : rgb(1, 1, 1),
    });
    if (checked) {
      page.drawText("X", { x: MARGIN + 2.2, y: boxY + 1.8, size: 8, font: bold, color: rgb(1, 1, 1) });
    }
    page.drawText(
      sanitize(`${item.label} - ${item.required ? "Required" : "Optional"} - ${checked ? "Agreed" : "Not agreed"}`),
      { x: MARGIN + 18, y: boxY + 1, size: 9.5, font: regular, color: rgb(0.1, 0.1, 0.12) },
    );
    y -= 17;
  }

  y -= 18;
  need(80);
  page.drawText("Contractor Signature (typed):", { x: MARGIN, y: y - 10, size: 8.5, font: regular, color: gray });
  page.drawText(sanitize(input.signature), { x: MARGIN, y: y - 34, size: 18, font: italic, color: navy });
  page.drawLine({
    start: { x: MARGIN, y: y - 42 }, end: { x: MARGIN + 260, y: y - 42 },
    thickness: 0.8, color: rgb(0.55, 0.58, 0.63),
  });
  page.drawText("Date:", { x: MARGIN + 300, y: y - 10, size: 8.5, font: regular, color: gray });
  page.drawText(sanitize(input.signatureDate), { x: MARGIN + 300, y: y - 30, size: 11, font: bold, color: rgb(0.1, 0.1, 0.12) });
  page.drawLine({
    start: { x: MARGIN + 300, y: y - 42 }, end: { x: PAGE_W - MARGIN, y: y - 42 },
    thickness: 0.8, color: rgb(0.55, 0.58, 0.63),
  });
  y -= 66;

  need(50);
  page.drawText("Crestwell Travel Network", { x: MARGIN, y: y - 12, size: 9.5, font: bold, color: rgb(0.1, 0.1, 0.12) });
  page.drawText("Authorized Representative - Crestwell Travel Services", {
    x: MARGIN, y: y - 26, size: 8.5, font: regular, color: gray,
  });

  // Footers
  const pages = doc.getPages();
  const stamp = sanitize(
    `${def.title} - executed electronically ${new Date().toISOString()} - ${input.email} - Crestwell Travel Network`,
  );
  pages.forEach((p, i) => {
    p.drawText(stamp, { x: MARGIN, y: 30, size: 6.5, font: regular, color: gray });
    p.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: PAGE_W - MARGIN - 56, y: 30, size: 6.5, font: regular, color: gray,
    });
  });

  return await doc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const first_name = String(body.first_name || "").trim();
    const last_name = String(body.last_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const plan = body.plan ? String(body.plan).trim().toLowerCase() : undefined;
    const signature = String(body.signature || "").trim();
    const signature_date = String(body.signature_date || "").trim() ||
      new Date().toISOString().slice(0, 10);
    // Per-document typed signatures; `signature` is the IC Agreement signature and the
    // fallback for older forms that send one signature for the whole packet.
    const sigInput = (body.signatures && typeof body.signatures === "object") ? body.signatures : {};
    const sigFor = (k: DocKey) => String(sigInput[k] ?? (k === "ic_agreement" ? signature : "") ?? "").trim() || signature;

    const errors: string[] = [];
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("valid email is required");
    if (plan && !["starter", "professional", "elite"].includes(plan)) {
      errors.push("plan must be starter, professional, or elite");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(signature_date)) errors.push("signature_date must be YYYY-MM-DD");

    const agreements: Record<DocKey, boolean> = {
      ic_agreement: body.ic_agreement === true || body.agreements?.ic_agreement === true,
      code_of_ethics: body.code_of_ethics === true || body.agreements?.code_of_ethics === true,
      media_release: body.media_release === true || body.agreements?.media_release === true,
      data_consent: body.data_consent === true || body.agreements?.data_consent === true,
    };
    for (const d of DOCS) {
      if (d.required && !agreements[d.key]) errors.push(`${d.key} must be accepted`);
      if (agreements[d.key] && sigFor(d.key).length < 2) errors.push(`signature for ${d.key} (typed name) is required`);
    }

    if (errors.length) {
      return new Response(JSON.stringify({ error: errors.join("; ") }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullName = [first_name, last_name].filter(Boolean).join(" ") || sigFor("ic_agreement");
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string | null = null;
    const { data: prof } = await db.from("profiles").select("user_id").ilike("email", email).maybeSingle();
    if (prof?.user_id) userId = prof.user_id as string;

    const slug = email.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const documents: Record<string, unknown>[] = [];

    // Optional documents that weren't accepted are skipped, not generated.
    for (const def of DOCS.filter((d) => agreements[d.key])) {
      const docSig = sigFor(def.key);
      const pdfBytes = await buildPdf(def, {
        fullName, email, plan, signature: docSig, signatureDate: signature_date, agreements,
      });
      const folder = def.key.replace(/_/g, "-");
      const storagePath = `${folder}/${slug}/${folder}-${stamp}.pdf`;
      const { error: upErr } = await db.storage.from(BUCKET).upload(storagePath, pdfBytes, {
        contentType: "application/pdf", upsert: true,
      });
      if (upErr) throw new Error(`${def.key} storage upload failed: ${upErr.message}`);

      const { data: record, error: insErr } = await db.from("signed_documents").insert({
        user_id: userId, email, document_type: def.key, plan: plan || null,
        storage_bucket: BUCKET, storage_path: storagePath,
        signature: docSig, signature_date, agreements,
      }).select("id, created_at").single();
      if (insErr) throw new Error(`${def.key} record insert failed: ${insErr.message}`);

      const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      documents.push({
        document_type: def.key, document_id: record.id, storage_path: storagePath,
        signed_url: signed?.signedUrl || null, created_at: record.created_at,
      });
    }

    const ic = documents.find((d) => d.document_type === "ic_agreement")!;
    // Keep the onboarding row pointing at the latest signed IC copy and per-document flags (non-fatal)
    await db.from("ic_onboarding").update({
      signed_agreement_path: ic.storage_path,
      ic_agreement_signed: true,
      code_of_ethics_signed: agreements.code_of_ethics,
      media_release_signed: agreements.media_release,
      data_consent_signed: agreements.data_consent,
    }).ilike("email", email);

    return new Response(
      JSON.stringify({
        success: true,
        // Backward-compatible IC Agreement fields
        document_id: ic.document_id,
        bucket: BUCKET,
        storage_path: ic.storage_path,
        signed_url: ic.signed_url,
        signed_url_expires_in_seconds: 60 * 60 * 24 * 7,
        created_at: ic.created_at,
        documents,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("generate-signed-ic-agreement error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
