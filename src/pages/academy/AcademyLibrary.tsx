import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { AcademyLayout, AcademyCard, AcademyEyebrow } from "@/components/academy/AcademyLayout";
import { useAcademyResources, RESOURCE_CATEGORIES, type ResourceCategory } from "@/hooks/useAcademyExtras";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AcademyLibrary() {
  const [params, setParams] = useSearchParams();
  const { data: resources } = useAcademyResources();
  const [query, setQuery] = useState("");
  const [video, setVideo] = useState<{ title: string; url: string } | null>(null);

  const category = (params.get("category") as ResourceCategory) || "All";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (resources || []).filter((r) => {
      if (category !== "All" && r.category !== category) return false;
      if (!q) return true;
      return `${r.title} ${r.description || ""}`.toLowerCase().includes(q);
    });
  }, [resources, category, query]);

  const setCategory = (c: ResourceCategory) => {
    if (c === "All") setParams({});
    else setParams({ category: c });
  };

  const open = (r: { title: string; file_url: string | null; category: string }) => {
    if (!r.file_url) return;
    if (r.category === "Recordings") {
      setVideo({ title: r.title, url: r.file_url });
      return;
    }
    window.open(r.file_url, "_blank", "noopener,noreferrer");
  };

  return (
    <AcademyLayout>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <AcademyEyebrow>Updated weekly by the Crestwell education team</AcademyEyebrow>
          <h1 className="mt-1.5 text-[32px]" style={{ fontFamily: "Lora, Georgia, serif" }}>
            Resource Library
          </h1>
        </div>
        <div className="relative">
          <Search
            size={15}
            style={{ position: "absolute", left: 12, top: 11, color: "var(--academy-ink-soft)" }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources"
            className="rounded-[10px] py-2.5 pl-9 pr-3 text-[13.5px]"
            style={{ border: "1px solid var(--academy-line)", background: "var(--academy-surface)", minWidth: 260 }}
          />
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {RESOURCE_CATEGORIES.map((c) => {
          const active = c === category;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium"
              style={{
                background: active ? "var(--academy-pine)" : "var(--academy-surface)",
                color: active ? "#fff" : "var(--academy-ink)",
                border: active ? "1px solid var(--academy-pine)" : "1px solid var(--academy-line)",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--academy-ink-soft)" }}>
          Nothing matches that yet.{" "}
          <button
            onClick={() => {
              setQuery("");
              setCategory("All");
            }}
            style={{ color: "var(--academy-gold-deep)", textDecoration: "underline" }}
          >
            Clear the filters
          </button>{" "}
          to see everything.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => open(r)}
              className="academy-card text-left transition-colors"
              style={{ padding: 20 }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--academy-gold)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--academy-line)")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="academy-eyebrow" style={{ color: "var(--academy-gold-deep)" }}>
                  {r.kind}
                </span>
                <span className="text-[11.5px]" style={{ color: "var(--academy-ink-soft)" }}>
                  {r.size_label}
                </span>
              </div>
              <h3 className="mt-2.5 text-[16.5px]">{r.title}</h3>
              <p
                className="mt-2 text-[13px]"
                style={{
                  color: "var(--academy-ink-soft)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {r.description}
              </p>
              <div
                className="mt-4 flex items-center justify-between pt-3 text-[12px]"
                style={{ borderTop: "1px solid var(--academy-line)", color: "var(--academy-ink-soft)" }}
              >
                <span>
                  Updated{" "}
                  {r.updated_on
                    ? new Date(`${r.updated_on}T00:00:00`).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })
                    : "recently"}
                </span>
                <span style={{ color: "var(--academy-gold-deep)", fontWeight: 500 }}>Open →</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!video} onOpenChange={(o) => !o && setVideo(null)}>
        <DialogContent className="academy max-w-3xl" style={{ background: "var(--academy-surface)" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Lora, Georgia, serif" }}>{video?.title}</DialogTitle>
          </DialogHeader>
          {video && (
            <div style={{ aspectRatio: "16 / 9", width: "100%" }}>
              <iframe
                src={video.url}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                style={{ width: "100%", height: "100%", border: "none", borderRadius: 10 }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AcademyLayout>
  );
}
