import { assertCanInitializeFridge, parseInitialFridgeReading } from "@/lib/domain/fridge";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { currentMonthStart } from "@/lib/utils/dates";

/** Setup only: never creates a bill, allocation, payment or settlement. */
export async function saveInitialFridgeReading(adminId: string, value: unknown) {
  const reading = parseInitialFridgeReading(value);
  return withSerializableRetry(async (tx) => {
    const admin = await tx.user.findUnique({ where: { id: adminId }, select: { role: true, status: true } });
    if (admin?.role !== "admin" || admin.status !== "active") {
      throw Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const config = await tx.systemConfig.findFirst();
    if (!config) throw new Error("System settings are missing.");
    const bill = await tx.fridgeBill.findFirst({ select: { id: true } });
    assertCanInitializeFridge(bill !== null, config.fridgeInitialReading !== null || config.fridgeInitialMonth !== null);
    const updated = await tx.systemConfig.update({
      where: { id: config.id },
      data: { fridgeInitialReading: reading, fridgeInitialMonth: currentMonthStart(), updatedById: adminId },
    });
    return {
      reading: updated.fridgeInitialReading!.toFixed(2),
      month: updated.fridgeInitialMonth!.toISOString().slice(0, 7),
    };
  });
}
