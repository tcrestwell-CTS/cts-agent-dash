import { createRoot } from "react-dom/client";
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

createRoot(document.getElementById("root")!).render(<App />);

// Auto-recover from stale dynamic import failures (common after deploys/HMR).
// If a chunk fails to load, reload once to fetch fresh module URLs.
const RELOAD_KEY = "__cw_chunk_reload_at";
const isChunkLoadError = (msg: string) =>
  /Failed to fetch dynamically imported module/i.test(msg) ||
  /Importing a module script failed/i.test(msg) ||
  /error loading dynamically imported module/i.test(msg) ||
  /ChunkLoadError/i.test(msg);

const tryReload = () => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    // Avoid reload loops: only reload once per 10s
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* ignore storage errors */
  }
  window.location.reload();
};

window.addEventListener("error", (event) => {
  const msg = event?.message || String(event?.error?.message || "");
  if (isChunkLoadError(msg)) tryReload();
});

window.addEventListener("unhandledrejection", (event) => {
  const reason: any = event?.reason;
  const msg = typeof reason === "string" ? reason : reason?.message || "";
  if (isChunkLoadError(msg)) tryReload();
});
