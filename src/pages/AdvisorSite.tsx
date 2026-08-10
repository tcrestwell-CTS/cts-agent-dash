import { useEffect } from "react";
import { advisor, quoteUrl } from "@/config/advisor";
import "@/components/advisor-site/advisor-site.css";

const NAV = [
  { label: "Trips", href: "#trips" },
  { label: "How it works", href: "#how" },
  { label: "Contact", href: "#contact" },
];

const STEPS = [
  {
    n: "01",
    title: "Tell me the shape of it",
    body: "Dates, who's coming, the budget you'd rather not go past. A sentence is enough to start.",
  },
  {
    n: "02",
    title: "I come back with two or three real priced options",
    body: "Actual cabins, actual rooms, actual totals — not brochure ranges. You pick one or send me back for more.",
  },
  {
    n: "03",
    title: "I hold the rest of it",
    body: "Deposits, price drops, documents, and the 6am phone call when a flight moves.",
  },
];

const AdvisorSite = () => {
  useEffect(() => {
    document.title = `${advisor.name} — ${advisor.title}, ${advisor.agency}`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", advisor.bio);
  }, []);

  return (
    <div className="advisor-site min-h-screen">
      {/* 1. Header */}
      <header className="as-rule-b sticky top-0 z-50" style={{ background: "var(--as-bg)" }}>
        <div className="as-shell flex flex-wrap items-center justify-between gap-4 py-4">
          <a href="#top" className="flex items-baseline gap-3 no-underline" style={{ color: "var(--as-ink)" }}>
            <span className="as-display" style={{ fontSize: 22 }}>CRESTWELL</span>
            <span className="as-caps as-muted">Travel Network</span>
          </a>
          <nav aria-label="Primary" className="flex items-center gap-6">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="as-nav-link hidden sm:inline-flex">
                {item.label}
              </a>
            ))}
            <a className="as-btn as-btn-primary" href={quoteUrl()}>Get a free quote</a>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* 2. Hero */}
        <section className="as-rule-b">
          <div className="as-shell grid lg:grid-cols-2">
            <div className="py-12 lg:py-20 lg:pr-12">
              <p className="as-kicker">{advisor.title} · {advisor.location}</p>
              <h1 className="as-display mt-4" style={{ fontSize: "clamp(48px, 8vw, 92px)" }}>
                {advisor.name}
              </h1>
              <div className="mt-6 flex items-center gap-4">
                <img
                  src={advisor.headshot}
                  alt={`Portrait of ${advisor.name}`}
                  className="as-headshot"
                  width={72}
                  height={72}
                />
                <p className="as-caps">
                  {advisor.title}, independent with {advisor.agency}
                </p>
              </div>
              <p className="mt-6" style={{ fontSize: 19, maxWidth: "34ch", lineHeight: 1.5 }}>
                {advisor.bio}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="as-btn as-btn-primary" href={quoteUrl()}>Get a free quote</a>
                <a className="as-btn as-btn-secondary" href="#trips">See featured trips</a>
              </div>
            </div>
            <div className="as-rule-l -mx-6 lg:mx-0 lg:border-l-2" style={{ borderLeftWidth: 2 }}>
              <img
                src={advisor.heroImage}
                alt={advisor.heroImageAlt}
                className="as-hero-photo"
                width={1400}
                height={1050}
              />
            </div>
          </div>
        </section>

        {/* 3. Stat row */}
        <section className="as-rule-b" aria-label="At a glance">
          <div className="as-shell grid grid-cols-2 lg:grid-cols-4">
            {advisor.stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`py-8 lg:px-6 ${i > 0 ? "as-rule-l" : ""} ${i > 0 ? "lg:pl-6" : ""}`}
                style={i > 0 ? { borderLeftWidth: 2 } : undefined}
              >
                <p className="as-display" style={{ fontSize: 24, letterSpacing: "-0.015em" }}>{stat.value}</p>
                <p className="as-muted mt-2" style={{ fontSize: 13 }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Featured trips */}
        <section id="trips" className="as-rule-b">
          <div className="as-shell py-12 lg:py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="as-kicker">Currently pricing</p>
                <h2 className="as-h2 mt-3">Featured trips</h2>
              </div>
              <p className="as-muted lg:text-right" style={{ fontSize: 13, maxWidth: "38ch" }}>
                Starting fares, per person, based on double occupancy. I re-price before you pay.
              </p>
            </div>

            <ul className="mt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 list-none p-0">
              {advisor.trips.map((trip, i) => (
                <li
                  key={trip.title}
                  className="as-cell-rule-t md:as-cell-rule-l flex flex-col p-4"
                >
                  <img
                    src={trip.image}
                    alt={`${trip.place}: ${trip.title}`}
                    className="as-trip-photo"
                    loading="lazy"
                    width={900}
                    height={200}
                  />
                  <p className="as-caps mt-4">
                    <span style={{ color: "var(--as-accent)" }}>{String(i + 1).padStart(2, "0")}</span>{" "}
                    {trip.place}
                  </p>
                  <h3 className="mt-2" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>
                    {trip.title}
                  </h3>
                  <div className="as-cell-rule-t mt-auto pt-4 flex items-center justify-between gap-4">
                    <p style={{ fontSize: 13 }} className="as-muted">
                      from <strong style={{ color: "var(--as-ink)", fontWeight: 800 }}>{trip.price}</strong> {trip.unit}
                    </p>
                    <a
                      className="as-ghost"
                      href={quoteUrl({ destination: trip.destination, trip: trip.title })}
                    >
                      Request quote →
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5. How it works */}
        <section id="how" className="as-rule-b">
          <div className="as-shell grid lg:grid-cols-3 py-12 lg:py-16">
            <div className="lg:pr-12">
              <p className="as-kicker">The process</p>
              <h2 className="as-h2 mt-3">How it works</h2>
            </div>
            <div className="lg:col-span-2 lg:pl-12 mt-8 lg:mt-0 as-rule-l" style={{ borderLeftWidth: 2 }}>
              {STEPS.map((step, i) => (
                <div key={step.n} className={i > 0 ? "as-cell-rule-t pt-6 mt-6" : ""}>
                  <p className="as-caps" style={{ color: "var(--as-accent)" }}>{step.n}</p>
                  <h3 className="mt-2" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.015em" }}>
                    {step.title}
                  </h3>
                  <p className="as-muted mt-2" style={{ fontSize: 16, maxWidth: "60ch" }}>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Poster CTA */}
        <section className="as-poster">
          <div className="as-shell grid lg:grid-cols-2 gap-8 py-16">
            <h2 className="as-display" style={{ fontSize: "clamp(36px, 6vw, 64px)" }}>
              {advisor.posterHeadline}
            </h2>
            <div className="flex flex-col items-start gap-6 lg:pl-12">
              <p style={{ fontSize: 18 }}>No fee to ask. No obligation to book.</p>
              <a className="as-btn as-btn-invert" href={quoteUrl()}>Get a free quote</a>
            </div>
          </div>
        </section>

        {/* 7. Footer */}
        <footer id="contact" className="as-rule-t">
          <div className="as-shell grid md:grid-cols-3 gap-8 py-12">
            <div>
              <p className="as-display" style={{ fontSize: 18 }}>{advisor.agency}</p>
              <p className="as-muted mt-3" style={{ fontSize: 15, maxWidth: "38ch" }}>
                {advisor.name} is an independent travel advisor with {advisor.agency}, booking cruises,
                resorts and group travel from {advisor.location}.
              </p>
            </div>
            <div className="md:pl-8 as-cell-rule-l">
              <p className="as-caps">Contact</p>
              <ul className="mt-4 list-none p-0" style={{ fontSize: 15 }}>
                <li><a className="as-ghost" href={`tel:${advisor.phone.replace(/[^\d+]/g, "")}`}>{advisor.phone}</a></li>
                <li><a className="as-ghost" href={`mailto:${advisor.email}`}>{advisor.email}</a></li>
                <li className="as-muted pt-2">{advisor.location}</li>
              </ul>
            </div>
            <div className="md:pl-8 as-cell-rule-l">
              <p className="as-caps">Network</p>
              <ul className="mt-4 list-none p-0">
                {advisor.networkLinks.map((link) => (
                  <li key={link.href}>
                    <a className="as-ghost" href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="as-cell-rule-t">
            <div className="as-shell flex flex-wrap items-center gap-x-6 gap-y-2 py-6 as-muted" style={{ fontSize: 12 }}>
              <span>© {new Date().getFullYear()} {advisor.agency}</span>
              <span>FL Seller of Travel ST46414</span>
              <a className="as-ghost" href="https://crestwellgetaways.com/privacy">Privacy</a>
              <a className="as-ghost" href="https://crestwellgetaways.com/terms">Terms</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default AdvisorSite;