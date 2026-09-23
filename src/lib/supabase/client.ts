import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Uses only the public anon key.
 * Never import the service role key here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
