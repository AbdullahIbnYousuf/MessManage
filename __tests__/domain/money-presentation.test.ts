import { describe, expect, it } from "vitest";
import {
  closingPresentation,
  currentBalanceLabel,
} from "@/components/domain/money/presentation";

describe("Money overview presentation", () => {
  it("uses explicit current-month direction wording", () => {
    expect(currentBalanceLabel("owed")).toBe("You are currently owed");
    expect(currentBalanceLabel("owes")).toBe("You currently owe");
    expect(currentBalanceLabel("balanced")).toBe("Your current balance is even");
  });

  it("changes ready-to-close wording by role without changing status", () => {
    expect(closingPresentation("ready", true, 0)).toMatchObject({
      label: "Ready",
      title: "Previous month is ready to close",
    });
    expect(closingPresentation("ready", false, 0)).toMatchObject({
      label: "Ready",
      title: "Waiting for monthly closing",
    });
  });

  it("reports blocked issue counts accurately", () => {
    expect(closingPresentation("blocked", false, 1).description).toBe(
      "1 issue needs attention before the month can close."
    );
    expect(closingPresentation("blocked", true, 3).description).toBe(
      "3 issues need attention before the month can close."
    );
  });
});
