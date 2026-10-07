import { AsyncLocalStorage } from "node:async_hooks";
import type { IdentityContext } from "@/types/acting";

export type ActingOperation = { identity: IdentityContext; operation: string; notificationIds: string[] };
export const actingOperations = new AsyncLocalStorage<ActingOperation>();

// These names are assigned by route code, never accepted from the browser.
export const allowedActingOperations = new Set([
  "meal.records", "meal.pattern", "meal.update", "meal.correction",
  "bazar.trip", "bazar.notes", "bazar.expense", "bazar.correct",
  "bulk.item", "bulk.start", "bulk.correct", "bulk.finish",
  "maid.payment", "maid.correct", "fridge.bill", "fridge.payment", "fridge.correct-payment",
  "payment.create", "payment.received", "payment.respond", "payment.cancel", "payment.reverse",
  "request.respond", "request.cancel",
]);
