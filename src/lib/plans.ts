export type PublicPlan = {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  billing_period: string;
  active_customer_limit: number | null;
  stores_limit: number | null;
  features: Record<string, boolean>;
};

const COLUMNS =
  "id,slug,name,price,currency,billing_period,active_customer_limit,stores_limit,features";

/**
 * Public plan catalogue, fetched without a session and cached.
 *
 * The pricing section used to read this through the cookie-bound server
 * client. Touching cookies opts the route out of static rendering, so the
 * marketing homepage was server-rendered on *every* visit, and each
 * visitor waited on a round trip to Supabase for three rows that change maybe
 * twice a year.
 *
 * Plans are readable by anon under RLS (`is_active = true`), so this uses
 * a plain fetch with the publishable key and Next's data cache. The page
 * goes back to being static, and a price edit shows up within the
 * revalidate window.
 */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  try {
    const response = await fetch(
      `${url}/rest/v1/plans?select=${COLUMNS}&is_active=eq.true&order=price.asc`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        // Revalidate rather than cache forever: an admin changing a price
        // should not need a redeploy for it to show up.
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!response.ok) return [];
    return (await response.json()) as PublicPlan[];
  } catch {
    // A slow or unreachable database must not take the homepage with it;
    // the section renders its own empty state.
    return [];
  }
}
