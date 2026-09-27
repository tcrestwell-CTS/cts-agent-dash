import { supabase } from "@/integrations/supabase/client";

export interface AIContext {
  destination?: string | null;
  tripName?: string | null;
}

export interface TripOverviewContext extends AIContext {
  departDate?: string | null;
  returnDate?: string | null;
  instructions?: string;
}

export interface AISuggestedItem {
  title: string;
  description: string | null;
  category: string;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
}

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("itinerary-ai-action", { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx: any = (error as any).context;
      const j = ctx?.json ? await ctx.json() : null;
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function aiWriteDescription(ctx: AIContext, item: { title: string; category?: string; location?: string | null; description?: string | null }) {
  const plain = (item.description || "").replace(/<[^>]+>/g, " ").trim();
  const data = await call({ action: "describe", ...ctx, item: { ...item, description: plain } });
  return String(data.description || "");
}

export async function aiWriteTripOverview(ctx: TripOverviewContext) {
  const data = await call({ action: "trip_overview", ...ctx });
  return String(data.overview || "");
}

export async function aiDayItems(
  action: "suggest" | "fill_day",
  ctx: AIContext & { dayNumber: number; date?: string | null; dayItems: { title: string; start_time?: string | null; location?: string | null }[]; instructions?: string },
): Promise<AISuggestedItem[]> {
  const data = await call({ action, ...ctx });
  return (data.items || []) as AISuggestedItem[];
}
