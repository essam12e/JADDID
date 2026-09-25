import { describe, it, expect } from "vitest";
import {
  confirmSignupEmail,
  resetPasswordEmail,
  welcomeEmail,
  activationSubmittedEmail,
  activationApprovedEmail,
  activationRejectedEmail,
  renewalDigestEmail,
  passwordChangedEmail,
  formatDate,
  formatMoney,
  TEMPLATES,
  emailChangeConfirmEmail,
  emailChangeNoticeEmail,
} from "./templates";
import { esc, siteUrl } from "./layout";

const ALL = [
  welcomeEmail({ name: "عصام", storeName: "متجر النور" }),
  activationSubmittedEmail({ orgName: "متجر النور", accountNumber: 1042 }),
  activationApprovedEmail({ orgName: "متجر النور", planName: "JADDID" }),
  activationRejectedEmail({ orgName: "متجر النور", note: "السجل التجاري غير واضح" }),
  renewalDigestEmail({
    storeName: "متجر النور",
    items: [{ customerName: "أحمد", productName: "Netflix", endDate: "2026-10-01", daysLeft: 5 }],
  }),
  passwordChangedEmail({ name: "عصام" }),
  confirmSignupEmail({ name: "عصام", actionLink: "https://j-addid.com/auth/callback?code=x", code: "482915" }),
  resetPasswordEmail({ name: "عصام", actionLink: "https://j-addid.com/auth/callback?code=y", code: "731204" }),
];

describe("email shell", () => {
  it("every template is RTL, Arabic and carries a subject", () => {
    for (const email of ALL) {
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.html).toContain('dir="rtl"');
      expect(email.html).toContain('lang="ar"');
      expect(email.text.length).toBeGreaterThan(0);
    }
  });

  it("every template embeds the logo as an absolute URL", () => {
    // Relative paths silently break in every mail client — there is no
    // page origin to resolve them against.
    for (const email of ALL) {
      expect(email.html).toContain(`${siteUrl()}/brand/jaddid-email-logo.png`);
      expect(email.html).toMatch(/<img[^>]+alt="جَدِّد \| JADDID"/);
    }
  });

  it("uses table layout rather than flex/grid, which Outlook drops", () => {
    for (const email of ALL) {
      expect(email.html).toContain("<table");
      expect(email.html).not.toMatch(/display:\s*(flex|grid)/);
    }
  });

  it("ships a preheader so the inbox preview is not raw markup", () => {
    for (const email of ALL) {
      expect(email.html).toMatch(/max-height:0[^>]*>[^<]+</);
    }
  });
});

describe("escaping", () => {
  it("neutralises markup coming from user-controlled names", () => {
    const email = welcomeEmail({ storeName: '<script>alert(1)</script>', name: '"x" & y' });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&amp;");
  });

  it("esc handles null and undefined without printing them", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });
});

describe("renewal digest", () => {
  it("flags expired items differently from upcoming ones", () => {
    const email = renewalDigestEmail({
      storeName: "متجر",
      items: [
        { customerName: "سارة", productName: "Shahid", endDate: "2026-09-20", daysLeft: -4 },
        { customerName: "خالد", productName: "Spotify", endDate: "2026-09-30", daysLeft: 6 },
      ],
    });
    expect(email.subject).toContain("منتهية");
    expect(email.html).toContain("منتهي من 4 يوم");
    expect(email.html).toContain("باقي 6 يوم");
  });

  it("says 'ينتهي اليوم' rather than 'باقي 0 يوم'", () => {
    const email = renewalDigestEmail({
      storeName: "متجر",
      items: [{ customerName: "سارة", productName: "OSN", endDate: "2026-09-24", daysLeft: 0 }],
    });
    expect(email.html).toContain("ينتهي اليوم");
    expect(email.html).not.toContain("باقي 0");
  });

  it("caps the listed rows and says how many were left out", () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      customerName: `عميل ${i}`,
      productName: "Netflix",
      endDate: "2026-10-01",
      daysLeft: 3,
    }));
    const email = renewalDigestEmail({ storeName: "متجر", items });
    expect(email.html).toContain("وفيه 3 غيرهم");
    expect(email.html).not.toContain("عميل 12");
  });

  it("uses Arabic plural forms instead of a bare count", () => {
    const one = renewalDigestEmail({
      storeName: "م",
      items: [{ customerName: "أ", productName: "ب", endDate: "2026-10-01", daysLeft: 2 }],
    });
    expect(one.html).toContain("اشتراك واحد");

    const two = renewalDigestEmail({
      storeName: "م",
      items: Array.from({ length: 2 }, () => ({
        customerName: "أ",
        productName: "ب",
        endDate: "2026-10-01",
        daysLeft: 2,
      })),
    });
    expect(two.html).toContain("اشتراكين");
  });
});

describe("formatters", () => {
  it("renders dates in Gregorian with Latin digits", () => {
    expect(formatDate("2026-10-15T12:00:00Z")).toBe("15 أكتوبر 2026");
  });

  it("does not crash on an invalid date", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("formats SAR amounts", () => {
    expect(formatMoney(1250)).toBe("1,250 ر.س");
    expect(formatMoney(49, "USD")).toBe("49 USD");
  });
});

describe("optional fields", () => {
  it("omits the account number row when there is none", () => {
    const withNumber = activationSubmittedEmail({ orgName: "م", accountNumber: 7 });
    const without = activationSubmittedEmail({ orgName: "م", accountNumber: null });
    expect(withNumber.html).toContain("رقم الحساب");
    expect(without.html).not.toContain("رقم الحساب");
  });

  it("changes the rejection wording when no note was given", () => {
    const withNote = activationRejectedEmail({ orgName: "م", note: "ناقص مستند" });
    const without = activationRejectedEmail({ orgName: "م", note: null });
    expect(withNote.html).toContain("ناقص مستند");
    expect(without.html).toContain("تواصل معنا");
    expect(without.html).not.toContain("الملاحظة");
  });

  it("drops the greeting name when it is blank", () => {
    expect(welcomeEmail({ storeName: "م", name: "   " }).html).toContain("هلا وغلا فيك");
    expect(welcomeEmail({ storeName: "م", name: "عصام" }).html).toContain("يا عصام");
  });
});

describe("template registry", () => {
  it("matches the names the outbox and the SQL enqueue calls use", () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(
      [
        "activation_approved",
        "activation_rejected",
        "activation_submitted",
        "password_changed",
        "renewal_digest",
        "welcome",
        "confirm_signup",
        "reset_password",
        "email_change_confirm",
        "email_change_notice",
      ].sort(),
    );
  });
});

describe("SQL ↔ TypeScript template names", () => {
  it("every template the migration enqueues is implemented here", async () => {
    // The enqueue calls live in SQL and the renderers live in TS, so
    // nothing but a test stops the two drifting apart — a typo there
    // would only surface as a dead outbox row in production.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../../../supabase/migrations");
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql"));

    const used = new Set<string>();
    for (const file of files) {
      const sql = await fs.readFile(path.join(dir, file), "utf8");
      for (const m of sql.matchAll(/enqueue_email\(\s*[^,]+,\s*'([a-z_]+)'/g)) {
        used.add(m[1]);
      }
    }

    expect(used.size).toBeGreaterThan(0);
    for (const name of used) {
      expect(Object.keys(TEMPLATES)).toContain(name);
    }
  });
});

describe("store-name phrasing", () => {
  it("never doubles the word متجر when the name already starts with it", () => {
    // Merchants really do name stores "متجر النور", and a hardcoded
    // "متجر ${storeName}" prefix rendered "متجر متجر النور" in the inbox
    // preview line.
    const welcome = welcomeEmail({ storeName: "متجر النور" });
    const digest = renewalDigestEmail({
      storeName: "متجر النور",
      items: [{ customerName: "أ", productName: "ب", endDate: "2026-10-01", daysLeft: 3 }],
    });
    for (const email of [welcome, digest]) {
      expect(email.html).not.toContain("متجر متجر");
      expect(email.text).not.toContain("متجر متجر");
    }
  });
});


describe("auth emails the app sends instead of Supabase", () => {
  // These exist because Supabase's own confirmation and recovery
  // templates live only in its dashboard — unreachable from the repo —
  // so merchants were getting a stock English message.
  it("are Arabic and carry the brand, unlike the stock template", () => {
    for (const email of [
      confirmSignupEmail({ actionLink: "https://x.test/a" }),
      resetPasswordEmail({ actionLink: "https://x.test/b" }),
    ]) {
      expect(email.html).toContain('dir="rtl"');
      expect(email.html).toContain("jaddid-email-logo.png");
      expect(email.subject).toMatch(/[\u0600-\u06FF]/); // Arabic subject
      expect(email.html).not.toContain("Confirm your email address");
      expect(email.html).not.toContain("Reset your password");
    }
  });

  it("put the generated link on the button", () => {
    const link = "https://j-addid.com/auth/callback?code=abc123";
    expect(confirmSignupEmail({ actionLink: link }).html).toContain(link);
    expect(resetPasswordEmail({ actionLink: link }).html).toContain(link);
  });

  it("show the one-time code when there is one", () => {
    // A link is single-use and cannot cross devices; the code can do both.
    const withCode = confirmSignupEmail({ actionLink: "https://x.test/a", code: "482915" });
    expect(withCode.html).toContain("482915");
    expect(withCode.html).toContain("أو استخدم هذا الرمز");
  });

  it("omit the code row entirely when none was issued", () => {
    const without = confirmSignupEmail({ actionLink: "https://x.test/a", code: null });
    expect(without.html).not.toContain("أو استخدم هذا الرمز");
  });
});

describe("email change", () => {
  const link = "https://j-addid.com/auth/callback?code=abc";

  it("asks the new address to confirm, in Arabic, with the logo", () => {
    const mail = emailChangeConfirmEmail({
      name: "عصام",
      newEmail: "new@example.com",
      actionLink: link,
      code: "123456",
    });

    expect(mail.subject).toContain("أكّد بريدك الجديد");
    expect(mail.html).toContain("يا عصام");
    expect(mail.html).toContain(link);
    expect(mail.html).toContain("new@example.com");
    expect(mail.html).toContain("123456");
    // The logo comes from the shared layout; if it ever stops being
    // rendered these emails silently become plain text.
    expect(mail.html).toMatch(/<img[^>]+(logo|jaddid)/i);
    expect(mail.text).toContain(link);
  });

  it("tells the current address what was requested, and how to react", () => {
    const mail = emailChangeNoticeEmail({ name: null, newEmail: "new@example.com" });

    expect(mail.subject).toContain("طلب تغيير البريد");
    expect(mail.html).toContain("new@example.com");
    expect(mail.html).toContain("غيّر كلمة مرورك فورًا");
    // No link when Supabase does not require the old address to agree —
    // a button that does nothing is worse than no button.
    expect(mail.html).not.toContain("أوافق على التغيير");
  });

  it("gives the current address a button when its approval is required", () => {
    const mail = emailChangeNoticeEmail({
      name: "عصام",
      newEmail: "new@example.com",
      actionLink: link,
      code: "654321",
    });

    expect(mail.subject).toContain("وافق على تغيير بريدك");
    expect(mail.html).toContain("أوافق على التغيير");
    expect(mail.html).toContain(link);
    expect(mail.html).toContain("654321");
  });
});
