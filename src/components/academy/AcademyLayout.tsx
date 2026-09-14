import { NavLink } from "react-router-dom";
import "@/styles/academy.css";
import ctnLogo from "@/assets/CTN-Logo.png";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";

const NAV = [
  { label: "Dashboard", to: "/academy", end: true },
  { label: "Curriculum", to: "/academy/curriculum", end: false },
  { label: "Resource Library", to: "/academy/library", end: false },
  { label: "Certificates", to: "/academy/certificates", end: false },
];

export function useAdvisorName(): { first: string; full: string; initials: string } {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const full = profile?.full_name || (user?.user_metadata?.full_name as string) || "Advisor";
  const parts = full.trim().split(/\s+/);
  return {
    first: parts[0] || "Advisor",
    full,
    initials: (parts[0]?.[0] || "A") + (parts.length > 1 ? parts[parts.length - 1][0] : ""),
  };
}

export function AcademyLayout({ children }: { children: React.ReactNode }) {
  const { initials } = useAdvisorName();

  return (
    <div className="academy">
      <header
        className="sticky top-0 z-30 flex flex-wrap items-center gap-x-10 gap-y-4"
        style={{ background: "var(--academy-pine)", padding: "18px 40px" }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center"
            style={{
              width: 82,
              height: 82,
              background: "#fff",
              borderRadius: 14,
              padding: 10,
              flex: "0 0 auto",
            }}
          >
            <img
              src={ctnLogo}
              alt="Crestwell Travel Network"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
          <div className="leading-tight">
            <div style={{ fontFamily: "Lora, Georgia, serif", fontSize: 18, color: "#fff", fontWeight: 600 }}>
              CTN Travel Academy
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
              Crestwell Travel Network
            </div>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-7">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="pb-1 text-[13.5px] transition-colors"
              style={({ isActive }) => ({
                color: isActive ? "#fff" : "rgba(255,255,255,0.75)",
                fontWeight: isActive ? 500 : 400,
                boxShadow: isActive ? "inset 0 -2px 0 0 var(--academy-gold)" : "none",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto">
          <div
            className="flex items-center justify-center"
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              background: "var(--academy-gold)",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 600,
            }}
            aria-label="Your account"
          >
            {initials.toUpperCase()}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "44px 40px 80px" }}>{children}</div>
    </div>
  );
}

/** Flat Academy card. */
export function AcademyCard({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={`academy-card ${className}`} style={{ padding: 24, ...style }}>
      {children}
    </section>
  );
}

export function AcademyEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="academy-eyebrow">{children}</p>;
}
