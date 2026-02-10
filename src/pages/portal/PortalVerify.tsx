import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePortal } from "@/contexts/PortalContext";
import { portalRoutes } from "@/lib/portalRoutes";
import { toast } from "sonner";

export default function PortalVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = usePortal();
  const [error, setError] = useState("");
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setError("Invalid link");
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-auth`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ action: "verify-token", token }),
          }
        );

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Invalid or expired link");
          return;
        }

        login(data.token, data.client_id, data.client_name);
        toast.success(`Welcome back, ${data.client_name}!`);
        navigate("/dashboard", { replace: true });
      } catch {
        setError("Something went wrong. Please try again.");
      }
    };

    verify();
  }, [token, login, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Access Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <a href="/login" className="text-primary hover:underline text-sm">
            Request a new access link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/20" />
        <p className="text-sm text-muted-foreground">Verifying your access...</p>
      </div>
    </div>
  );
}
