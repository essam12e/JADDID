# Supabase auth email templates (Arabic)

Supabase Auth sends the signup-confirmation, password-reset and
email-change messages itself, from templates stored in the project's
dashboard. Those templates are **not** reachable from the codebase or
from any API this project has, so they cannot be deployed with a
migration — they have to be pasted in once.

Until that is done, Supabase sends its stock English template
("Confirm your email address"), which is why a merchant who signs up in
Arabic gets an English, unbranded email.

These three files are ready to paste. They use the same layout, brand
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
