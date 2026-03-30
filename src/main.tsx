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
