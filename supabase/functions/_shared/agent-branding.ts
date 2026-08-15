// Resolves the branding that client-facing emails/notifications should carry
// for a given advisor (assigned agent). Falls back to the agency defaults.

export interface AgentBranding {
  userId: string | null;
  agencyName: string;
  advisorName: string;
  advisorTitle: string;
  phone: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  avatarUrl: string | null;
  website: string | null;
  tagline: string | null;
  /** "Name <email>" for Resend */
  from: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
}

const DEFAULTS = {
  agencyName: "Crestwell Travel Services",
  advisorName: "Tim Crestwell",
  advisorTitle: "Travel Advisor",
  phone: "888.508.6893",
  primaryColor: "#0b2545",
  accentColor: "#c9a84c",
  fromEmail: "send@crestwellgetaways.com",
  replyTo: "info@crestwellgetaways.com",
};

// deno-lint-ignore no-explicit-any
export async function resolveAgentBranding(admin: any, userId?: string | null): Promise<AgentBranding> {
  let branding: Record<string, any> | null = null;
  let profile: Record<string, any> | null = null;

  if (userId) {
    const [b, p] = await Promise.all([
      admin.from("branding_settings").select("*").eq("user_id", userId).maybeSingle(),
      admin
        .from("profiles")
        .select("full_name, job_title, phone, avatar_url, agency_name, storefront_email, storefront_logo_url")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    branding = b?.data ?? null;
    profile = p?.data ?? null;
  }

  const agencyName =
    branding?.agency_name || profile?.agency_name || profile?.full_name || DEFAULTS.agencyName;
  const advisorName = profile?.full_name || DEFAULTS.advisorName;
  const fromEmail = branding?.from_email || DEFAULTS.fromEmail;
  const fromName = branding?.from_name || agencyName;
  const replyTo =
    branding?.email_address || profile?.storefront_email || DEFAULTS.replyTo;

  return {
    userId: userId ?? null,
    agencyName,
    advisorName,
    advisorTitle: profile?.job_title || DEFAULTS.advisorTitle,
    phone: branding?.phone || profile?.phone || DEFAULTS.phone,
    primaryColor: branding?.primary_color || DEFAULTS.primaryColor,
    accentColor: branding?.accent_color || DEFAULTS.accentColor,
    logoUrl: branding?.logo_url || profile?.storefront_logo_url || null,
    avatarUrl: profile?.avatar_url || null,
    website: branding?.website || null,
    tagline: branding?.tagline || null,
    from: `${fromName} <${fromEmail}>`,
    fromEmail,
    fromName,
    replyTo,
  };
}
