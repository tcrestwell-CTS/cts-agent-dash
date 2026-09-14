import { useEffect } from "react";
import { Check } from "lucide-react";
import { AcademyLayout, AcademyCard, AcademyEyebrow, useAdvisorName } from "@/components/academy/AcademyLayout";
import { useAcademyData } from "@/hooks/useAcademy";
import {
  useAcademyCertificates,
  useMyAcademyCertificates,
  useIssueEarnedCertificates,
} from "@/hooks/useAcademyExtras";
import { toast } from "@/hooks/use-toast";
import ctnLogo from "@/assets/CTN-Logo.png";

async function downloadCertificatePDF(opts: {
  advisorName: string;
  certificateName: string;
  credentialId: string;
  issuedOn: string;
}) {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  // Border
  doc.setDrawColor(214, 158, 46);
  doc.setLineWidth(3);
  doc.rect(28, 28, width - 56, height - 56);
  doc.setDrawColor(44, 82, 130);
  doc.setLineWidth(0.8);
  doc.rect(38, 38, width - 76, height - 76);

  // Logo
  try {
    const img = new Image();
    img.src = ctnLogo;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    doc.addImage(img, "PNG", width / 2 - 30, 62, 60, 60);
  } catch {
    /* logo is decorative */
  }

  doc.setTextColor(26, 54, 93);
  doc.setFont("times", "normal");
  doc.setFontSize(13);
  doc.text("CRESTWELL TRAVEL NETWORK", width / 2, 150, { align: "center" });

  doc.setFontSize(30);
  doc.text(opts.certificateName, width / 2, 200, { align: "center" });

  doc.setTextColor(74, 85, 104);
  doc.setFontSize(12);
  doc.text("This credential is awarded to", width / 2, 240, { align: "center" });

  doc.setTextColor(26, 32, 44);
  doc.setFontSize(28);
  doc.text(opts.advisorName, width / 2, 284, { align: "center" });

  doc.setDrawColor(214, 158, 46);
  doc.setLineWidth(1.2);
  doc.line(width / 2 - 150, 300, width / 2 + 150, 300);

  doc.setTextColor(74, 85, 104);
  doc.setFontSize(11.5);
  doc.text(
    "for completing the required coursework of the CTN Travel Academy. This credential verifies",
    width / 2,
    332,
    { align: "center" },
  );
  doc.text("training completion and is not a supplier appointment or license.", width / 2, 350, { align: "center" });

  doc.setFontSize(11);
  doc.text(`Credential ID: ${opts.credentialId}`, 80, height - 80);
  doc.text(`Issued: ${opts.issuedOn}`, 80, height - 62);
  doc.text("Verify at app.crestwelltravels.com/academy/certificates", width - 80, height - 62, { align: "right" });

  doc.save(`${opts.credentialId}.pdf`);
}

export default function AcademyCertificates() {
  const { full } = useAdvisorName();
  const academy = useAcademyData();
  const { data: catalogue } = useAcademyCertificates();
  const { data: mine } = useMyAcademyCertificates();
  const issue = useIssueEarnedCertificates();

  const completedModuleIds = academy.modules.filter((m) => m.isComplete).map((m) => m.id);

  useEffect(() => {
    if (!academy.isLoading && completedModuleIds.length > 0) issue.mutate(completedModuleIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academy.isLoading, completedModuleIds.join(",")]);

  const held = new Map((mine || []).map((r) => [r.certificate_id, r]));
  const earned = (catalogue || []).filter((c) => held.has(c.id));
  const inProgress = (catalogue || []).filter((c) => !held.has(c.id));

  const moduleTitle = (id: string) => academy.modules.find((m) => m.id === id)?.title || "Module";
  const moduleOrder = (id: string) => academy.modules.find((m) => m.id === id)?.sortOrder ?? 99;
  const orderedModules = (ids: string[]) => [...ids].sort((a, b) => moduleOrder(a) - moduleOrder(b));

  const share = async (credentialId: string) => {
    const url = `${window.location.origin}/academy/certificates?credential=${credentialId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Verification link copied", description: url });
    } catch {
      toast({ title: "Could not copy", description: url, variant: "destructive" });
    }
  };

  return (
    <AcademyLayout>
      <header className="mb-8">
        <AcademyEyebrow>Issued by Crestwell Travel Network</AcademyEyebrow>
        <h1 className="mt-1.5 text-[32px]" style={{ fontFamily: "Lora, Georgia, serif" }}>
          Certificates
        </h1>
        <p className="mt-2 max-w-[62ch] text-[14.5px]" style={{ color: "var(--academy-ink-soft)" }}>
          Credentials you have earned, shareable with suppliers and clients.
        </p>
      </header>

      <div className="academy-grid">
        <div className="space-y-6">
          <div>
            <AcademyEyebrow>Earned</AcademyEyebrow>
            <div className="mt-3 space-y-4">
              {earned.length === 0 && (
                <AcademyCard>
                  <p className="text-[13.5px]" style={{ color: "var(--academy-ink-soft)" }}>
                    No credentials yet — finish Module 1 to earn your first one.
                  </p>
                </AcademyCard>
              )}
              {earned.map((c) => {
                const row = held.get(c.id)!;
                const issuedOn = new Date(`${row.issued_on}T00:00:00`).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <AcademyCard key={c.id}>
                    <div className="flex flex-wrap items-start gap-5">
                      <span
                        className="flex items-center justify-center"
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 999,
                          border: "2px solid var(--academy-gold)",
                          background: "rgba(214,158,46,0.1)",
                          color: "var(--academy-gold-deep)",
                          fontFamily: "Lora, Georgia, serif",
                          fontSize: 13,
                          fontWeight: 600,
                          flex: "0 0 auto",
                        }}
                      >
                        {c.credential_prefix.replace("CTN-", "")}
                      </span>
                      <div className="min-w-[220px] flex-1">
                        <h3 className="text-[18px]">{c.name}</h3>
                        <p className="mt-1.5 text-[13px]" style={{ color: "var(--academy-ink-soft)" }}>
                          Issued {issuedOn} · Credential {row.credential_id}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2.5">
                          <button
                            onClick={() =>
                              downloadCertificatePDF({
                                advisorName: full,
                                certificateName: c.name,
                                credentialId: row.credential_id,
                                issuedOn,
                              })
                            }
                            className="rounded-[10px] px-4 py-2 text-[13px] font-medium"
                            style={{ background: "var(--academy-gold)", color: "#fff" }}
                          >
                            Download PDF
                          </button>
                          <button
                            onClick={() => share(row.credential_id)}
                            className="rounded-[10px] px-4 py-2 text-[13px] font-medium"
                            style={{ border: "1px solid var(--academy-line)", color: "var(--academy-pine)" }}
                          >
                            Share
                          </button>
                        </div>
                      </div>
                    </div>
                  </AcademyCard>
                );
              })}
            </div>
          </div>

          {inProgress.length > 0 && (
            <div>
              <AcademyEyebrow>In progress</AcademyEyebrow>
              <div className="mt-3 space-y-4">
                {inProgress.map((c) => {
                  const remaining = c.required_module_ids.filter((id) => !completedModuleIds.includes(id));
                  return (
                    <AcademyCard key={c.id}>
                      <div className="flex flex-wrap items-start gap-5">
                        <span
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 999,
                            border: "1.5px dashed var(--academy-line)",
                            flex: "0 0 auto",
                          }}
                        />
                        <div className="min-w-[220px] flex-1">
                          <h3 className="text-[18px]" style={{ color: "var(--academy-ink-soft)" }}>
                            {c.name}
                          </h3>
                          <p className="mt-1.5 text-[13px]" style={{ color: "var(--academy-ink-soft)" }}>
                            {remaining.length} module{remaining.length === 1 ? "" : "s"} left before this is issued.
                          </p>
                          <ul className="mt-3.5 space-y-2">
                            {orderedModules(c.required_module_ids).map((id) => {
                              const met = completedModuleIds.includes(id);
                              return (
                                <li key={id} className="flex items-center gap-2.5 text-[13.5px]">
                                  <span
                                    className="flex items-center justify-center"
                                    style={{
                                      width: 15,
                                      height: 15,
                                      borderRadius: 3,
                                      flex: "0 0 auto",
                                      background: met ? "var(--academy-pine)" : "transparent",
                                      border: met ? "none" : "1.5px solid var(--academy-line)",
                                      color: "#fff",
                                    }}
                                  >
                                    {met && <Check size={10} strokeWidth={4} />}
                                  </span>
                                  <span style={{ color: met ? "var(--academy-ink)" : "var(--academy-ink-soft)" }}>
                                    {moduleTitle(id)}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </AcademyCard>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <AcademyCard>
            <AcademyEyebrow>About credentials</AcademyEyebrow>
            <p className="mt-3 text-[13.5px]" style={{ color: "var(--academy-ink-soft)", lineHeight: 1.65 }}>
              These credentials verify training completion, not supplier appointments. Each PDF carries a credential ID
              the agency can verify on request.
            </p>
          </AcademyCard>
        </div>
      </div>
    </AcademyLayout>
  );
}
