/**
 * THE ONLY FILE TO EDIT PER ADVISOR.
 * Copy the site, replace the values below, drop a headshot at /public/advisor.jpg, deploy.
 */
export interface AdvisorStat {
  value: string;
  label: string;
}

export interface AdvisorTrip {
  place: string;
  title: string;
  price: string;
  unit: string;
  image: string;
  destination: string;
}

export interface AdvisorConfig {
  name: string;
  title: string;
  agency: string;
  agentId: string;
  headshot: string;
  heroImage: string;
  heroImageAlt: string;
  bio: string;
  posterHeadline: string;
  phone: string;
  email: string;
  location: string;
  quoteBase: string;
  stats: AdvisorStat[];
  trips: AdvisorTrip[];
  networkLinks: { label: string; href: string }[];
}

export const advisor: AdvisorConfig = {
  name: "Kim W.",
  title: "Travel Advisor",
  agency: "Crestwell Travel Network",
  agentId: "28b6ea88-f54b-4723-a6d3-06f5e6f620de",
  headshot: "/advisor.jpg",
  heroImage:
    "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1400&q=80",
  heroImageAlt: "Cruise ship passing a glacier-lined coast in clear daylight",
  bio:
    "I plan cruises, all-inclusive resorts and group escapes — and I do the comparing, holding and re-pricing so you don't have to.",
  posterHeadline: "Tell me where. I handle the rest.",
  phone: "888.508.6893",
  email: "agents@crestwellgetaways.com",
  location: "Chattanooga, Tennessee",
  quoteBase: "https://crestwellgetaways.com/request-quote",
  stats: [
    { value: "Cruise-first", label: "Ocean, river, expedition" },
    { value: "24 hours", label: "Typical quote turnaround" },
    { value: "$0", label: "Planning fee on most bookings" },
    { value: "CLIA · IATAN", label: "Accredited host agency" },
  ],
  trips: [
    {
      place: "Alaska",
      title: "7-Day Alaska: Whittier to Vancouver",
      price: "$909",
      unit: "per person",
      image:
        "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=900&q=80",
      destination: "Alaska",
    },
    {
      place: "Riviera Maya",
      title: "5 Nights All-Inclusive, Adults Only",
      price: "$1,140",
      unit: "per person",
      image:
        "https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=900&q=80",
      destination: "Riviera Maya",
    },
    {
      place: "Mediterranean",
      title: "10-Day Rome, Naples and the Greek Isles",
      price: "$1,675",
      unit: "per person",
      image:
        "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=900&q=80",
      destination: "Mediterranean",
    },
    {
      place: "Iceland",
      title: "8-Day Reykjavik and the South Coast",
      price: "$2,240",
      unit: "per person",
      image:
        "https://images.unsplash.com/photo-1504829857797-ddff29c27927?auto=format&fit=crop&w=900&q=80",
      destination: "Iceland",
    },
    {
      place: "Japan",
      title: "9-Day Tokyo, Hakone and Kyoto by Rail",
      price: "$2,890",
      unit: "per person",
      image:
        "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=80",
      destination: "Japan",
    },
    {
      place: "Danube",
      title: "8-Day River Cruise: Budapest to Nuremberg",
      price: "$3,105",
      unit: "per person",
      image:
        "https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=900&q=80",
      destination: "Danube River",
    },
  ],
  networkLinks: [
    { label: "Crestwell Getaways", href: "https://crestwellgetaways.com" },
    { label: "Request a quote", href: "https://crestwellgetaways.com/request-quote" },
    { label: "Advisor portal", href: "https://app.crestwelltravels.com" },
  ],
};

/** Quote link for this advisor, with optional destination / trip context. */
export function quoteUrl(opts?: { destination?: string; trip?: string }) {
  let url = `${advisor.quoteBase}?agent=${encodeURIComponent(advisor.agentId)}`;
  if (opts?.destination) url += `&destination=${encodeURIComponent(opts.destination)}`;
  if (opts?.trip) url += `&trip=${encodeURIComponent(opts.trip)}`;
  return url;
}