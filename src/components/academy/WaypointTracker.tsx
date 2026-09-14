import { Check } from "lucide-react";
import { MODULE_SHORT_NAMES, type AcademyModuleState } from "@/hooks/useAcademy";

/**
 * Route tracker with one stop per required module. The track is inset by half a
 * column on each side and the filled portion terminates on the current stop's centre.
 */
export function WaypointTracker({ modules }: { modules: AcademyModuleState[] }) {
  const stops = modules;
  const count = Math.max(stops.length, 1);
  const inset = 50 / count;
  const span = 100 - 2 * inset;
  const completed = stops.filter((m) => m.isComplete).length;
  const currentIndex = Math.min(completed, stops.length - 1);
  const fill = `${count > 1 ? (Math.min(completed, count - 1) / (count - 1)) * span : 0}%`;

  return (
    <div
      className="academy-waypoints"
      role="list"
      aria-label="Foundational track progress"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      <span className="academy-waypoints-track" aria-hidden="true" style={{ left: `${inset}%`, right: `${inset}%` }} />
      <span className="academy-waypoints-fill" aria-hidden="true" style={{ width: fill, left: `${inset}%` }} />

      {stops.map((m, i) => {
        const state = m.isComplete ? "complete" : i === currentIndex ? "current" : "upcoming";
        return (
          <div className="academy-waypoint" key={m.id} role="listitem">
            <span
              className="academy-waypoint-dot"
              data-state={state}
              aria-label={`Module ${m.sortOrder}: ${m.title} — ${
                state === "complete" ? "complete" : state === "current" ? "in progress" : "not started"
              }`}
            >
              {state === "complete" ? <Check size={16} strokeWidth={3} /> : m.sortOrder}
            </span>
            <div className="academy-waypoint-labels">
              <span className="academy-waypoint-name" data-state={state}>
                {MODULE_SHORT_NAMES[m.sortOrder] || m.title}
              </span>
              <span
                className="academy-waypoint-here"
                aria-hidden="true"
                style={{ visibility: state === "current" ? "visible" : "hidden" }}
              >
                You are here
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
