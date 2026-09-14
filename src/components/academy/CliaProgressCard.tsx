import { useState } from "react";
import { AcademyCard, AcademyEyebrow } from "@/components/academy/AcademyLayout";
import {
  CLIA_ACC_TARGETS,
  CLIA_KIND_LABELS,
  useCliaTotals,
  useLogCliaActivity,
  type CliaActivityKind,
} from "@/hooks/useCliaProgress";
import { toast } from "sonner";

const KINDS: CliaActivityKind[] = ["stateroom_booking", "ship_inspection", "personal_cruise", "course_credit"];

/** Tracks the real CLIA activity that feeds an external counsellor credential. */
export function CliaProgressCard() {
  const totals = useCliaTotals();
  const log = useLogCliaActivity();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CliaActivityKind>("stateroom_booking");
  const [title, setTitle] = useState("");
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [credits, setCredits] = useState("");

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Add a ship, booking reference or course name.");
      return;
    }
    try {
      await log.mutateAsync({
        kind,
        title: title.trim(),
        occurred_on: occurredOn,
        credits: kind === "course_credit" ? Number(credits || 0) : 0,
      });
      toast.success("Logged.");
      setTitle("");
      setCredits("");
      setOpen(false);
    } catch {
      toast.error("Could not save that entry.");
    }
  };

  return (
    <AcademyCard>
      <AcademyEyebrow>Toward CLIA ACC</AcademyEyebrow>
      <h3 className="mt-1.5 text-[17px]" style={{ fontFamily: "Lora, Georgia, serif" }}>
        Your cruise credential log
      </h3>

      <div className="mt-4 space-y-3">
        {KINDS.map((k) => {
          const value = totals[k];
          const target = CLIA_ACC_TARGETS[k];
          const pct = Math.min(100, target ? (value / target) * 100 : 0);
          return (
            <div key={k}>
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span style={{ color: "var(--academy-ink-soft)" }}>{CLIA_KIND_LABELS[k]}</span>
                <span style={{ fontFamily: "Lora, Georgia, serif" }}>
                  {value} <span style={{ color: "var(--academy-ink-soft)" }}>/ {target}</span>
                </span>
              </div>
              <div
                className="mt-1.5"
                style={{ height: 3, borderRadius: 999, background: "var(--academy-parchment)", overflow: "hidden" }}
              >
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--academy-gold)" }} />
              </div>
            </div>
          );
        })}
      </div>

      {open ? (
        <div className="mt-4 space-y-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CliaActivityKind)}
            className="w-full rounded-[8px] px-3 py-2 text-[13px]"
            style={{ border: "1px solid var(--academy-line)" }}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {CLIA_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ship, booking reference or course"
            className="w-full rounded-[8px] px-3 py-2 text-[13px]"
            style={{ border: "1px solid var(--academy-line)" }}
          />
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full rounded-[8px] px-3 py-2 text-[13px]"
            style={{ border: "1px solid var(--academy-line)" }}
          />
          {kind === "course_credit" && (
            <input
              type="number"
              min={0}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder="Credits earned"
              className="w-full rounded-[8px] px-3 py-2 text-[13px]"
              style={{ border: "1px solid var(--academy-line)" }}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={log.isPending}
              className="flex-1 rounded-[10px] px-4 py-2.5 text-[13px] font-medium disabled:opacity-50"
              style={{ background: "var(--academy-gold)", color: "#fff" }}
            >
              Save entry
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-[10px] px-4 py-2.5 text-[13px] font-medium"
              style={{ border: "1px solid var(--academy-line)", color: "var(--academy-pine)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-[10px] px-4 py-2.5 text-[13px] font-medium"
          style={{ border: "1px solid var(--academy-line)", color: "var(--academy-pine)" }}
        >
          Log activity
        </button>
      )}

      <p className="mt-3 text-[11.5px]" style={{ color: "var(--academy-ink-soft)" }}>
        CLIA requirements vary by year. Confirm current minimums with CLIA before you submit, and keep your own evidence.
      </p>
    </AcademyCard>
  );
}
