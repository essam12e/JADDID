import { describe, it, expect } from "vitest";
import { whatsappActivationUrl, SUPPORT_WHATSAPP_E164 } from "./contact";

describe("whatsappActivationUrl", () => {
  it("points at the support number in wa.me form", () => {
    const url = whatsappActivationUrl({});
    // wa.me wants E.164 digits with no '+' and no separators.
    expect(url.startsWith(`https://wa.me/${SUPPORT_WHATSAPP_E164}?text=`)).toBe(true);
    expect(SUPPORT_WHATSAPP_E164).toMatch(/^\d+$/);
  });

  it("pre-fills the account name and number so support can act on it", () => {
    const url = whatsappActivationUrl({ organizationName: "متجر النور", accountNumber: 23 });
    const text = decodeURIComponent(new URL(url).searchParams.get("text") ?? "");
    expect(text).toContain("متجر النور");
    expect(text).toContain("رقم الحساب: 23");
  });

  it("omits the lines it has no value for", () => {
    const text = decodeURIComponent(
      new URL(whatsappActivationUrl({ organizationName: null, accountNumber: null }))
        .searchParams.get("text") ?? "",
    );
    expect(text).not.toContain("اسم الحساب");
    expect(text).not.toContain("رقم الحساب");
    expect(text).toContain("أبغى أفعّل حسابي");
  });

  it("encodes Arabic and newlines so the link is not broken", () => {
    const url = whatsappActivationUrl({ organizationName: "متجر & شركاه" });
    expect(url).not.toContain(" ");
    expect(url).not.toContain("\n");
    expect(() => new URL(url)).not.toThrow();
  });
});
