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

async function buildPdf(input: {
  fullName: string;
  email: string;
  plan?: string;
  signature: string;
  signatureDate: string;
  agreements: Record<string, boolean>;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Crestwell Travel Network - Independent Contractor Agreement");
  doc.setAuthor("Crestwell Travel Services");
  doc.setSubject("Signed Independent Contractor Agreement");

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
  page.drawText("Independent Contractor Agreement", {
    x: MARGIN, y: PAGE_H - 66, size: 11, font: regular, color: rgb(0.82, 0.71, 0.42),
  });
  page.drawText("A division of Crestwell Travel Services - Chattanooga, Tennessee", {
    x: MARGIN, y: PAGE_H - 82, size: 8, font: regular, color: rgb(0.75, 0.79, 0.85),
  });
  y = PAGE_H - 118;

  text(`Contractor: ${input.fullName}`, { font: bold, size: 10 });
  text(`Email: ${input.email}`, { size: 9.5 });
  text(`Plan Tier: ${planLabel(input.plan)}`, { size: 9.5 });
  text(`Executed: ${input.signatureDate}`, { size: 9.5, gap: 8 });

  text(INTRO, { gap: 8 });

  for (const s of SECTIONS) {
    need(28);
    text(s.heading, { font: bold, size: 9.5 });
    text(s.body, { gap: 6 });
  }

  need(40);
  y -= 6;
  page.drawText("SCHEDULE OF COMPENSATION", { x: MARGIN, y: y - 12, size: 12, font: bold, color: navy });
  y -= 24;
  for (const s of COMPENSATION) {
    need(28);
    text(s.heading, { font: bold, size: 9.5 });
    text(s.body, { gap: 6 });
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
    "By typing their name below, Contractor acknowledges having read and agreed to this Agreement and the items indicated, and adopts the typed name as their legally binding electronic signature.",
    { size: 9, color: gray, gap: 10 },
  );

  const items: { label: string; key: string; required: boolean }[] = [
    { label: "Independent Contractor Agreement", key: "ic_agreement", required: true },
    { label: "Code of Ethics", key: "code_of_ethics", required: true },
    { label: "Media & Marketing Release", key: "media_release", required: false },
    { label: "Data Processing Consent", key: "data_consent", required: true },
  ];

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
    `Executed electronically ${new Date().toISOString()} - ${input.email} - Crestwell Travel Network`,
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

    const errors: string[] = [];
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("valid email is required");
    if (!signature || signature.length < 2) errors.push("signature (typed name) is required");
    if (plan && !["starter", "professional", "elite"].includes(plan)) {
      errors.push("plan must be starter, professional, or elite");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(signature_date)) errors.push("signature_date must be YYYY-MM-DD");

    const agreements = {
      ic_agreement: body.ic_agreement === true || body.agreements?.ic_agreement === true,
      code_of_ethics: body.code_of_ethics === true || body.agreements?.code_of_ethics === true,
      media_release: body.media_release === true || body.agreements?.media_release === true,
      data_consent: body.data_consent === true || body.agreements?.data_consent === true,
    };
    if (!agreements.ic_agreement) errors.push("ic_agreement must be accepted");
    if (!agreements.code_of_ethics) errors.push("code_of_ethics must be accepted");
    if (!agreements.data_consent) errors.push("data_consent must be accepted");

    if (errors.length) {
      return new Response(JSON.stringify({ error: errors.join("; ") }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullName = [first_name, last_name].filter(Boolean).join(" ") || signature;

    const pdfBytes = await buildPdf({
      fullName,
      email,
      plan,
      signature,
      signatureDate: signature_date,
      agreements,
    });

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const slug = email.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const storagePath = `ic-agreement/${slug}/ic-agreement-${stamp}.pdf`;

    const { error: upErr } = await db.storage.from(BUCKET).upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

    // Best-effort link to an existing agent user account
    let userId: string | null = null;
    const { data: prof } = await db
      .from("profiles")
      .select("user_id")
      .ilike("email", email)
      .maybeSingle();
    if (prof?.user_id) userId = prof.user_id as string;

    const { data: record, error: insErr } = await db
      .from("signed_documents")
      .insert({
        user_id: userId,
        email,
        document_type: "ic_agreement",
        plan: plan || null,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        signature,
        signature_date,
        agreements,
      })
      .select("id, created_at")
      .single();
    if (insErr) throw new Error(`record insert failed: ${insErr.message}`);

    // Keep the onboarding row pointing at the latest signed copy (non-fatal)
    await db
      .from("ic_onboarding")
      .update({ signed_agreement_path: storagePath })
      .ilike("email", email);

    const { data: signed } = await db.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: record.id,
        bucket: BUCKET,
        storage_path: storagePath,
        signed_url: signed?.signedUrl || null,
        signed_url_expires_in_seconds: 60 * 60 * 24 * 7,
        created_at: record.created_at,
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
