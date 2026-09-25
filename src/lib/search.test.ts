import { describe, it, expect } from "vitest";
import { escapeSearchTerm } from "./search";

describe("escapeSearchTerm", () => {
  it("leaves an ordinary name or number alone", () => {
    expect(escapeSearchTerm("محمد العتيبي")).toBe("محمد العتيبي");
    expect(escapeSearchTerm("0500000000")).toBe("0500000000");
  });

  it("strips the punctuation PostgREST reads as filter syntax", () => {
    // Without this, the term adds a branch to the query's or() group.
    expect(escapeSearchTerm("x,is_archived.eq.true")).toBe("x is archived eq true");
    expect(escapeSearchTerm("a)or(b")).toBe("a or b");
    expect(escapeSearchTerm('quote"mark')).toBe("quote mark");
  });

  it("strips ILIKE wildcards", () => {
    expect(escapeSearchTerm("%%%")).toBe("");
    expect(escapeSearchTerm("a_b")).toBe("a b");
  });

  it("collapses whitespace and trims", () => {
    expect(escapeSearchTerm("  محمد   العتيبي  ")).toBe("محمد العتيبي");
  });

  it("caps the length so one term cannot build a huge expression", () => {
    expect(escapeSearchTerm("a".repeat(500))).toHaveLength(60);
  });
});
