import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "prisma/migrations/20260809000000_add_financial_concurrency_indexes/migration.sql"
);

describe("financial concurrency migration", () => {
  it("preflights incompatible rows before adding both indexes", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("HAVING COUNT(*) > 1");
    expect(sql).toContain('CREATE UNIQUE INDEX "BazarExpense_trip_id_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX "unique_active_bulk_cycle_per_item"');
    expect(sql).toContain('WHERE "status" = \'active\'');
  });

  it("contains no row mutation statements", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im);
  });
});
