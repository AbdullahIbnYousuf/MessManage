import { describe, expect, it } from "vitest";
import {
  activeNavigationId,
  navigationItems,
  navigationVisibleTo,
} from "@/components/navigation/config";

describe("MessManage navigation configuration", () => {
  it("defines six member desktop destinations and four bottom destinations", () => {
    const memberItems = navigationItems.filter((item) =>
      navigationVisibleTo(item, "member", false)
    );

    expect(memberItems).toHaveLength(6);
    expect(memberItems.map((item) => item.label)).toEqual([
      "Home",
      "Meals",
      "Bazar",
      "Expenses",
      "Money",
      "Members",
    ]);
    expect(memberItems.filter((item) => item.mobile === "bottom").map((item) => item.label)).toEqual([
      "Home",
      "Meals",
      "Bazar",
      "Money",
    ]);
    expect(memberItems.filter((item) => item.mobile === "more").map((item) => item.label)).toEqual([
      "Expenses",
      "Members",
    ]);
    expect(memberItems.find((item) => item.id === "money")).toBeDefined();
  });

  it("adds only the admin destination for admins", () => {
    const adminItems = navigationItems.filter((item) =>
      navigationVisibleTo(item, "admin", true)
    );

    expect(adminItems.map((item) => item.label)).toEqual([
      "Home",
      "Meals",
      "Bazar",
      "Expenses",
      "Money",
      "Members",
      "Admin Panel",
    ]);
  });

  it("maps expense child routes to Expenses", () => {
    expect(activeNavigationId("/expenses", "me")).toBe("expenses");
    expect(activeNavigationId("/bulk-items/item-1", "me")).toBe("expenses");
    expect(activeNavigationId("/maid", "me")).toBe("expenses");
    expect(activeNavigationId("/fridge", "me")).toBe("expenses");
  });

  it("maps money routes and the current member balance to Money", () => {
    expect(activeNavigationId("/money", "me")).toBe("money");
    expect(activeNavigationId("/debts/ledger", "me")).toBe("money");
    expect(activeNavigationId("/settlement/2026-07", "me")).toBe("money");
    expect(activeNavigationId("/members/me", "me")).toBe("money");
  });

  it("maps another member profile to Members and notifications to no primary destination", () => {
    expect(activeNavigationId("/members/someone-else", "me")).toBe("members");
    expect(activeNavigationId("/notifications", "me")).toBeNull();
  });
});
