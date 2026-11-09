import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Anchor, Ship, MapPin, Calendar, PartyPopper } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

export interface CelebrationPhoto {
  id: string;
  url: string;
  caption?: string;
}

export interface CelebrationConfig {
  enabled?: boolean;
  honoree_name?: string;
  occasion?: string;
  cruise_line?: string;
  ship_name?: string;
  embark_port?: string;
  embark_time?: string; // "HH:mm"
  photos?: CelebrationPhoto[];
}

interface Props {
  config: CelebrationConfig;
  departDate: string | null;
  returnDate: string | null;
  ports: string[];
  accentColor: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const diff = Math.max(0, target.getTime() - now);
  return {
    done: diff === 0,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    minutes: Math.floor((diff / 60000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function CelebrationSection({ config, departDate, returnDate, ports, accentColor }: Props) {
  const photos = (config.photos || []).filter((p) => p.url);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  let target: Date | null = null;
  if (departDate) {
    target = parseLocalDate(departDate);
    if (target && config.embark_time && /^\d{2}:\d{2}$/.test(config.embark_time)) {
      const [h, m] = config.embark_time.split(":").map(Number);
      target.setHours(h, m, 0, 0);
    }
  }
  const cd = useCountdown(target);

  useEffect(() => {
    if (photos.length < 2 || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % photos.length), 5000);
    return () => clearInterval(t);
  }, [photos.length, paused]);

  const depart = departDate ? parseLocalDate(departDate) : null;
  const ret = returnDate ? parseLocalDate(returnDate) : null;
  const nights = depart && ret ? differenceInCalendarDays(ret, depart) : null;
  const name = config.honoree_name?.trim();
  const occasion = config.occasion?.trim() || "celebration";

  const go = (d: number) => setIdx((i) => (i + d + photos.length) % photos.length);

  return (
    <section className="space-y-8" aria-label="Celebration">
      {/* Countdown */}
      {cd && (
        <div className="rounded-2xl border border-gray-200 p-6 md:p-8 text-center">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
            <PartyPopper className="h-4 w-4" />
            {cd.done ? "We've set sail" : `Countdown to sail away${name ? ` for ${name}` : ""}`}
          </p>
          {!cd.done && (
            <div className="mt-5 grid grid-cols-4 gap-2 md:gap-4 max-w-xl mx-auto" role="timer" aria-live="off">
              {[
                ["Days", cd.days],
                ["Hours", cd.hours],
                ["Minutes", cd.minutes],
                ["Seconds", cd.seconds],
              ].map(([label, v]) => (
                <div key={label as string} className="rounded-xl bg-gray-50 py-4">
                  <div className="text-3xl md:text-5xl font-bold tabular-nums text-gray-900">
                    {label === "Days" ? v : pad(v as number)}
                  </div>
                  <div className="text-xs md:text-sm text-gray-500 mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}
          {depart && (
            <p className="mt-4 text-sm text-gray-600">
              Sailing {format(depart, "EEEE, MMMM d, yyyy")}
              {config.embark_port ? ` from ${config.embark_port}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Photo slideshow */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-gray-900">
            {name ? `Celebrating ${name}` : "Celebrating together"}
          </h2>
          <div
            className="relative overflow-hidden rounded-2xl bg-gray-100 aspect-[4/3] md:aspect-[16/10]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            aria-roledescription="carousel"
          >
            {photos.map((p, i) => (
              <figure
                key={p.id}
                className={`absolute inset-0 transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                aria-hidden={i !== idx}
              >
                <img src={p.url} alt={p.caption || `${name || "Celebration"} photo ${i + 1}`} className="w-full h-full object-contain" loading={i === 0 ? "eager" : "lazy"} />
                {p.caption && (
                  <figcaption className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-sm px-4 py-2.5">{p.caption}</figcaption>
                )}
              </figure>
            ))}
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow hover:bg-white focus-visible:outline focus-visible:outline-2">
                  <ChevronLeft className="h-5 w-5 text-gray-800" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow hover:bg-white focus-visible:outline focus-visible:outline-2">
                  <ChevronRight className="h-5 w-5 text-gray-800" />
                </button>
              </>
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex justify-center gap-2">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === idx}
                  className="h-2.5 rounded-full transition-all"
                  style={{ width: i === idx ? 24 : 10, background: i === idx ? accentColor : "#d1d5db" }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cruise info */}
      <div className="rounded-2xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Ship className="h-5 w-5" style={{ color: accentColor }} /> Cruise details
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {(config.cruise_line || config.ship_name) && (
            <div>
              <dt className="text-gray-500">Ship</dt>
              <dd className="font-semibold text-gray-900">{[config.cruise_line, config.ship_name].filter(Boolean).join(" · ")}</dd>
            </div>
          )}
          {depart && (
            <div>
              <dt className="text-gray-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Dates</dt>
              <dd className="font-semibold text-gray-900">
                {format(depart, "MMM d")}{ret ? ` – ${format(ret, "MMM d, yyyy")}` : ""}{nights ? ` (${nights} nights)` : ""}
              </dd>
            </div>
          )}
          {config.embark_port && (
            <div>
              <dt className="text-gray-500 flex items-center gap-1"><Anchor className="h-3.5 w-3.5" /> Departs from</dt>
              <dd className="font-semibold text-gray-900">{config.embark_port}{config.embark_time ? ` · boarding ${format(new Date(`2000-01-01T${config.embark_time}`), "h:mm a")}` : ""}</dd>
            </div>
          )}
          {ports.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Ports of call</dt>
              <dd className="font-semibold text-gray-900">{ports.join(" → ")}</dd>
            </div>
          )}
        </dl>
        <p className="sr-only">This page is for the {occasion}.</p>
      </div>
    </section>
  );
}
