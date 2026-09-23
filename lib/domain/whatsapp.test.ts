import { describe, it, expect } from "vitest";
import { renderTemplate, normalizePhoneForWhatsApp, buildWhatsAppLink } from "./whatsapp";

describe("renderTemplate", () => {
  const vars = {
    customer_name: "أحمد",
    product_name: "Netflix",
    remaining_days: 3,
    end_date: "2026-10-01",
    renewal_url: "https://example.com/renew",
    store_name: "متجري",
  };

  it("substitutes every known token", () => {
    const result = renderTemplate(
      "{{customer_name}} - {{product_name}} - {{remaining_days}} - {{end_date}} - {{renewal_url}} - {{store_name}}",
      vars,
    );
    expect(result).toBe("أحمد - Netflix - 3 - 2026-10-01 - https://example.com/renew - متجري");
  });

  it("leaves an unrecognized token untouched instead of dropping it", () => {
    const result = renderTemplate("Hello {{customer_name}}, {{some_typo}}", vars);
    expect(result).toBe("Hello أحمد, {{some_typo}}");
  });

  it("handles a template with no tokens at all", () => {
    expect(renderTemplate("plain text", vars)).toBe("plain text");
  });

  it("substitutes the same token repeated multiple times", () => {
    expect(renderTemplate("{{customer_name}} {{customer_name}}", vars)).toBe("أحمد أحمد");
  });

  it("renders a negative remaining_days for an overdue subscription rather than hiding it", () => {
    const result = renderTemplate("{{remaining_days}}", { ...vars, remaining_days: -5 });
    expect(result).toBe("-5");
  });
});

describe("normalizePhoneForWhatsApp", () => {
  it("converts a local 0-prefixed Saudi number", () => {
    expect(normalizePhoneForWhatsApp("0500000000")).toBe("966500000000");
  });

  it("strips a leading + and formatting characters", () => {
    expect(normalizePhoneForWhatsApp("+966 50 000 0000")).toBe("966500000000");
  });

  it("handles the 00 international prefix", () => {
    expect(normalizePhoneForWhatsApp("00966500000000")).toBe("966500000000");
  });

  it("prefixes a bare 9-digit number with the Saudi country code", () => {
    expect(normalizePhoneForWhatsApp("500000000")).toBe("966500000000");
  });

  it("strips dashes and parentheses", () => {
    expect(normalizePhoneForWhatsApp("(050) 000-0000")).toBe("966500000000");
  });
});

describe("buildWhatsAppLink", () => {
  it("builds a wa.me link with the phone normalized and the message URL-encoded", () => {
    const link = buildWhatsAppLink("0500000000", "hello world");
    expect(link).toBe("https://wa.me/966500000000?text=hello%20world");
  });

  it("percent-encodes Arabic text and special characters correctly", () => {
    const link = buildWhatsAppLink("0500000000", "مرحبا! 100% off?");
    const url = new URL(link);
    expect(url.searchParams.get("text")).toBe("مرحبا! 100% off?");
  });
});
