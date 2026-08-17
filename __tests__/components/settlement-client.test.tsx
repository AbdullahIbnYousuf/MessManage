import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SettlementClient from "@/components/domain/settlement/SettlementClient";

describe("SettlementClient", () => {
  it("renders safely before the selected month has loaded", () => {
    expect(() =>
      renderToStaticMarkup(
        <SettlementClient
          isAdmin
          monthName="August 2026"
        />
      )
    ).not.toThrow();
  });
});
