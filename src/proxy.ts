import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every navigation except static assets, image optimization — and
     * `/api`.
     *
     * The middleware's job here is to refresh the auth cookie for *pages*.
     * An API route reads the session itself and answers JSON; running the
     * middleware first meant a second round trip to Supabase Auth before
     * the route even started, on every import pass, every outbox flush,
     * every signup. Pages still get the refresh they need.
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)",
  ],
};
