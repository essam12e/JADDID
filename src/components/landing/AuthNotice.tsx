"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * Supabase's `/verify` endpoint bounces failures onto the project's Site
 * URL with `?error=...`, which means the landing page. Without this the
 * merchant lands on a normal-looking homepage carrying a cryptic query
 * string and no idea what happened — exactly what a real signup here hit.
 *
 * The common case is not a broken link at all: mail clients and security
 * scanners pre-open links, and the token is single-use, so the *user's*
 * click is often the second one and fails on an account that is already
 * confirmed. Say that, instead of "something went wrong".
 *
 * A client component reading the query on the client, deliberately: doing
 * this from the server's `searchParams` would opt the whole landing page
 * out of static rendering to serve a banner almost nobody sees.
 */
export default function AuthNotice() {
  const params = useSearchParams();
  const error = params.get("error");
  if (!error) return null;

  const errorCode = params.get("error_code");
  const alreadyUsed = errorCode === "otp_expired" || error === "access_denied";

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3" role="status">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-amber-900">
        {alreadyUsed ? (
          <>
            <span className="font-bold">رابط التأكيد استُخدم أو انتهت صلاحيته.</span>
            <span>غالبًا حسابك تفعّل فعلًا من أول ضغطة — جرّب تسجّل دخولك.</span>
          </>
        ) : (
          <span className="font-bold">تعذّر إكمال العملية. حاول مرة ثانية.</span>
        )}
        <Link
          href="/login"
          className="rounded-lg bg-amber-900 px-3 py-1 text-xs font-bold text-white"
        >
          تسجيل الدخول
        </Link>
      </div>
    </div>
  );
}
