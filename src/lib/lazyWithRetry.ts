import { lazy, type ComponentType } from "react";

const KEY = "__cw_lazy_reload_at";

/**
 * React.lazy wrapper that survives stale deploys: if a page chunk fails to
 * load or resolves without a default export (mixed old/new chunks), it retries
 * once, then forces a single cache-busted reload instead of a blank screen.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | undefined>,
) {
  return lazy(async () => {
    const load = async () => {
      const mod = await factory();
      if (!mod || !mod.default) throw new Error("ChunkLoadError: module missing default export");
      return mod as { default: T };
    };
    try {
      return await load();
    } catch {
      try {
        await new Promise((r) => setTimeout(r, 400));
        return await load();
      } catch (err) {
        let last = 0;
        try { last = Number(sessionStorage.getItem(KEY) || 0); } catch { /* ignore */ }
        if (Date.now() - last > 10_000) {
          try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
          const url = new URL(window.location.href);
          url.searchParams.set("__r", String(Date.now()));
          window.location.replace(url.toString());
          return new Promise<{ default: T }>(() => {});
        }
        throw err;
      }
    }
  });
}
