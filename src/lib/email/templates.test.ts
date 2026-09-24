import { describe, it, expect } from "vitest";
import {
  welcomeEmail,
  activationSubmittedEmail,
  activationApprovedEmail,
  activationRejectedEmail,
  renewalDigestEmail,
  passwordChangedEmail,
  formatDate,
  formatMoney,
  TEMPLATES,
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
