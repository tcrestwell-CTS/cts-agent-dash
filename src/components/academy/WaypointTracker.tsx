import { Check } from "lucide-react";
import { MODULE_SHORT_NAMES, type AcademyModuleState } from "@/hooks/useAcademy";

/**
 * Six-stop route tracker. The track is inset by half a column on each side and
 * the filled portion terminates exactly on the current stop's centre.
 */
export function WaypointTracker({ modules }: { modules: AcademyModuleState[] }) {
  const stops = modules.slice(0, 6);
  const completed = stops.filter((m) => m.isComplete).length;
  const currentIndex = Math.min(completed, stops.length - 1);
  const fill = `${(Math.min(completed, 5) / 5) * 83.334}%`;

  return (
    <div className="academy-waypoints" role="list" aria-label="Foundational track progress">
      <span className="academy-waypoints-track" aria-hidden="true" />
      <span className="academy-waypoints-fill" aria-hidden="true" style={{ width: fill, height: fill }} />

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
