# Supabase auth email templates (Arabic)

> **The two that matter are no longer needed.** Signup confirmation and
> password reset are now sent by the application itself, in Arabic, with
> the logo — see "The app sends them now" below. Nothing has to be pasted
> for those two.

Supabase Auth sends signup-confirmation, password-reset and email-change
from templates stored in its **dashboard**. Those are not reachable from
the codebase or from any API this project holds, so they cannot be
deployed with a migration — which is exactly why merchants kept getting
the stock English "Confirm your email address" no matter what the repo
said.

## The app sends them now

`src/lib/auth/mailLinks.ts` calls `auth.admin.generateLink()`, which
mints the confirmation / recovery link **and its one-time code without
mailing anything**. The app then queues its own Arabic message through
the same Resend outbox as every other email it sends.

* `POST /api/auth/signup` replaces `supabase.auth.signUp()`
* `POST /api/auth/reset-password` replaces `supabase.auth.resetPasswordForEmail()`

Both answer identically for an address that does or doesn't have an
account, so neither screen can be used to enumerate registered emails,
and both are rate-limited per address by counting recent outbox rows —
no extra table.

## These files are now a fallback

Still worth pasting in, because Supabase will use its own template for
any flow that does not go through the routes above (email change, or a
link generated outside the app). They use the same layout, brand
colours, RTL direction and logo as every other email JADDID sends.

| File | Dashboard template |
|---|---|
| `confirm-signup.html`  | Confirm signup |
| `reset-password.html`  | Reset password |
| `change-email.html`    | Change email address |

**Where:** Supabase → Authentication → Emails → pick the template →
paste into the *Message body* (HTML) field → Save.

Set the subjects too, since those are separate fields:

| Template | Subject |
|---|---|
| Confirm signup | `أكّد بريدك وابدأ مع جَدِّد` |
| Reset password | `إعادة تعيين كلمة المرور — جَدِّد` |
| Change email address | `أكّد بريدك الجديد — جَدِّد` |

## Why each one carries a code as well as a button

Every template renders `{{ .ConfirmationURL }}` as the button **and**
`{{ .Token }}` as a 6-digit code. That is deliberate, and it fixes two
real failures seen in production:

* **A link is single-use, and mail clients pre-open links.** Security
  scanners and inbox previews fetch the URL before the human clicks, so
  the human's click is frequently the second one and fails on an account
  that is already confirmed.
* **A link can't cross devices.** The flow is PKCE: the `code_verifier`
  lives in the browser that started the signup. Open the link on a phone
  after signing up on a laptop and the exchange cannot succeed, no matter
  how many times it is retried.

A code has neither problem, and the app already has the screen for it —
`/verify-email` calls `verifyOtp`. Shipping both means whichever the
merchant reaches for works.

## The logo

Loaded from `https://j-addid.com/brand/jaddid-email-logo.png`, on an
explicit white plate so the navy wordmark stays legible in dark-mode
clients. It must stay publicly reachable — mail clients fetch it through
their own proxies with no session.
