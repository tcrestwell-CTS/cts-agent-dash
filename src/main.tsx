import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

const isClientPortalRoute = window.location.pathname.startsWith("/client");

if ("serviceWorker" in navigator && !isClientPortalRoute) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(
        registrations
          .filter((registration) => {
            const scopePath = new URL(registration.scope).pathname;
            return !scopePath.startsWith("/client/");
          })
          .map((registration) => registration.unregister())
      )
    )
    .catch(() => undefined);

  if ("caches" in window) {
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.includes("workbox") || key.includes("vite-pwa"))
            .map((key) => caches.delete(key))
        )
      )
      .catch(() => undefined);
  }
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Auto-recover from stale dynamic import failures (common after deploys/HMR).
// If a chunk fails to load, reload once to fetch fresh module URLs.
const RELOAD_KEY = "__cw_chunk_reload_at";
const isChunkLoadError = (msg: string) =>
  /Failed to fetch dynamically imported module/i.test(msg) ||
  /Importing a module script failed/i.test(msg) ||
  /error loading dynamically imported module/i.test(msg) ||
  /ChunkLoadError/i.test(msg);

const purgeCaches = async () => {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => undefined)));
    }
  } catch {
    /* ignore */
  }
};

const tryReload = () => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    // Avoid reload loops: only reload once per 10s
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* ignore storage errors */
  }
  // Stale chunk hashes come from a cached index.html / service worker.
  // Clear both, then force a fresh document fetch (cache-busted).
  void purgeCaches().finally(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("__r", String(Date.now()));
    window.location.replace(url.toString());
  });
};

// Vite emits this when a lazy route's preloaded chunk 404s after a deploy.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  tryReload();
});

window.addEventListener("error", (event) => {
  const msg = event?.message || String(event?.error?.message || "");
  if (isChunkLoadError(msg)) tryReload();
});

window.addEventListener("unhandledrejection", (event) => {
  const reason: any = event?.reason;
  const msg = typeof reason === "string" ? reason : reason?.message || "";
  if (isChunkLoadError(msg)) tryReload();
});
