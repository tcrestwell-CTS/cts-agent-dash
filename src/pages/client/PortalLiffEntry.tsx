import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, MessageCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { LINE_LIFF_ID } from "@/config/liff";
import { Button } from "@/components/ui/button";

declare global {
  interface Window { liff?: any }
}

const SDK_URL = "https://static.line-scdn.net/liff/edge/2/sdk.js";

function loadLiffSdk(): Promise<any> {
  if (window.liff) return Promise.resolve(window.liff);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.onload = () => (window.liff ? resolve(window.liff) : reject(new Error("LIFF SDK unavailable")));
    script.onerror = () => reject(new Error("Could not load the LINE SDK"));
    document.head.appendChild(script);
  });
}

/**
 * Entry point clients open from inside LINE. LINE itself has already
 * authenticated the user, so we exchange their LINE profile for a real
 * portal session (see the liff-line-session edge function) and hand off
 * to the normal client portal.
 */
/** Maps the LIFF URL segment (e.g. /liff/payments) to a portal route. */
const LIFF_DESTINATIONS: Record<string, string> = {
  payments: "/client/payments",
  invoices: "/client/invoices",
  trips: "/client/trips",
  messages: "/client/messages",
  documents: "/client/documents",
  profile: "/client/profile",
};

export default function PortalLiffEntry() {
  const navigate = useNavigate();
  const { target } = useParams();
  const destination = (target && LIFF_DESTINATIONS[target]) || "/client";
  const { loginWithToken } = usePortalAuth();
  const [status, setStatus] = useState<"loading" | "not_linked" | "error">("loading");
  const [message, setMessage] = useState("Connecting to your travel portal…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const liff = await loadLiffSdk();
        await liff.init({ liffId: LINE_LIFF_ID });

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const profile = await liff.getProfile();
        setMessage(`Welcome back, ${profile.displayName}. Opening your trips…`);

        const { data, error } = await supabase.functions.invoke("liff-line-session", {
          body: { lineUserId: profile.userId },
        });

        if (error || !data?.portalToken) {
          const notLinked = data?.error === "not_linked";
          setStatus(notLinked ? "not_linked" : "error");
          if (!notLinked) setMessage("We couldn't open your portal. Please message your travel advisor.");
          return;
        }

        const result = await loginWithToken(data.portalToken);
        if (!result.success) {
          setStatus("error");
          setMessage(result.error || "Your session could not be started.");
          return;
        }

        navigate(destination, { replace: true });
      } catch (err) {
        console.error("[LIFF] entry failed:", err);
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Something went wrong.");
      }
    })();
  }, [loginWithToken, navigate, destination]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          {status === "loading"
            ? <Loader2 className="h-7 w-7 text-primary animate-spin" />
            : status === "not_linked"
              ? <MessageCircle className="h-7 w-7 text-primary" />
              : <AlertCircle className="h-7 w-7 text-destructive" />}
        </div>

        {status === "not_linked" ? (
          <>
            <h1 className="text-xl font-semibold">Almost there</h1>
            <p className="text-sm text-muted-foreground">
              Your LINE account isn't connected to a client record yet. Send your travel
              advisor a quick message here in LINE and they'll link it for you.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">
              {status === "error" ? "Couldn't open your portal" : "One moment"}
            </h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}

        {status === "error" && (
          <Button variant="outline" onClick={() => window.location.reload()}>Try again</Button>
        )}
      </div>
    </main>
  );
}
