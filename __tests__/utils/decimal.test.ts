import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { add, sub, mul, div, sum, minDecimal, isZero, formatTaka, toApiString, fromApiString } from "@/lib/utils/decimal";

describe("add", () => {
  it("adds two decimals", () => {
    expect(add("100.50", "200.75").toFixed(2)).toBe("301.25");
  });

  it("avoids floating-point errors (0.1 + 0.2)", () => {
    expect(add("0.1", "0.2").toString()).toBe("0.3");
  });
});

describe("sub", () => {
  it("subtracts correctly", () => {
    expect(sub("500", "200.50").toFixed(2)).toBe("299.50");
  });

  it("handles negative results", () => {
    expect(sub("100", "250").toFixed(2)).toBe("-150.00");
  });
});

describe("mul", () => {
  it("multiplies correctly", () => {
    expect(mul("140.66", 25).toFixed(2)).toBe("3516.50");
  });
});

describe("div", () => {
  it("divides correctly", () => {
    expect(div("10000", 100).toFixed(2)).toBe("100.00");
  });

  it("throws on division by zero", () => {
    expect(() => div("1000", 0)).toThrow("Division by zero");
  });
});

describe("sum", () => {
  it("sums an array of values", () => {
    expect(sum(["100", "200", "300"]).toFixed(2)).toBe("600.00");
  });

  it("returns zero for empty array", () => {
    expect(sum([]).toFixed(2)).toBe("0.00");
  });

  it("handles mixed Decimal and string values", () => {
    expect(sum([new Decimal("100"), "200"]).toFixed(2)).toBe("300.00");
  });
});

describe("minDecimal", () => {
  it("returns the smaller value", () => {
    expect(minDecimal(new Decimal("100"), new Decimal("200")).toString()).toBe("100");
  });

  it("returns either when equal", () => {
    expect(minDecimal(new Decimal("100"), new Decimal("100")).toString()).toBe("100");
  });
});

describe("isZero", () => {
  it("returns true for zero", () => {
    expect(isZero(new Decimal(0))).toBe(true);
  });

  it("returns false for non-zero", () => {
    expect(isZero(new Decimal("0.01"))).toBe(false);
  });
});

describe("formatTaka", () => {
  it("formats positive amount", () => {
    expect(formatTaka("1234.50")).toBe("৳1,234.50");
  });

  it("formats negative amount", () => {
    expect(formatTaka("-1234.50")).toBe("-৳1,234.50");
  });

  it("formats zero", () => {
    expect(formatTaka(0)).toBe("৳0.00");
  });

  it("formats large amounts with commas", () => {
    expect(formatTaka("1234567.89")).toBe("৳1,234,567.89");
  });
});

describe("toApiString / fromApiString", () => {
  it("round-trips correctly", () => {
    const original = new Decimal("1234.56");
    const serialized = toApiString(original);
    const deserialized = fromApiString(serialized);
    expect(deserialized.toFixed(2)).toBe("1234.56");
  });
});
