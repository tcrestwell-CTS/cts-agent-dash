import { useMemo } from "react";
import { useTeamProfiles } from "@/hooks/useTeamProfiles";
import { cn } from "@/lib/utils";

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Resolves an advisor's display name from the team profiles list. */
export function useAdvisorNames() {
  const { data: profiles = [] } = useTeamProfiles();
  return useMemo(() => {
    const map = new Map<string, { name: string; avatar: string | null }>();
    for (const p of profiles) {
      if (!p.user_id) continue;
      map.set(p.user_id, { name: p.full_name || "Advisor", avatar: p.avatar_url ?? null });
    }
    return map;
  }, [profiles]);
}

interface AdvisorTagProps {
  /** advisor_id, falling back to the trip's user_id */
  advisorId?: string | null;
  userId?: string | null;
  className?: string;
  compact?: boolean;
}

export function AdvisorTag({ advisorId, userId, className, compact }: AdvisorTagProps) {
  const names = useAdvisorNames();
  const id = advisorId || userId || null;
  const profile = id ? names.get(id) : undefined;

  if (!id) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
          className
        )}
      >
        Unassigned
      </span>
    );
  }

  const name = profile?.name ?? "Advisor";

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-foreground",
        className
      )}
      title={name}
    >
      {profile?.avatar ? (
        <img src={profile.avatar} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[8.5px] font-bold text-primary">
          {initialsOf(name)}
        </span>
      )}
      {!compact && <span className="truncate">{name}</span>}
    </span>
  );
}
