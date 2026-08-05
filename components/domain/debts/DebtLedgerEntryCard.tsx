import Link from "next/link";
import type { DebtLedgerEntry } from "@/types/debts";
import { formatTaka } from "@/lib/utils/decimal";

function formatWhen(value: string): string {
  return new Date(value).toLocaleString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });
}

export function DebtStatusBadge({ status }: { status: string }) {
  const badge = status === "accepted"
    ? "badge-success"
    : status === "pending"
      ? "badge-warning"
      : status === "rejected"
        ? "badge-danger"
        : "badge-muted";
  return <span className={`badge ${badge}`}>{status.replaceAll("_", " ")}</span>;
}

export default function DebtLedgerEntryCard({ entry, currentUserId }: { entry: DebtLedgerEntry; currentUserId?: string }) {
  if (entry.type === "payment") {
    return (
      <Link href={`/debts/payments/${entry.id}`} className="debt-ledger-row">
        <div className="debt-ledger-row__top">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>
              {entry.sender.name} paid {entry.receiver.name}
            </div>
            <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: 3 }}>
              {entry.source === "reversal" ? "Return payment" : "Payment"} · {formatWhen(entry.createdAt)}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatTaka(entry.amount)}</div>
            <DebtStatusBadge status={entry.status} />
          </div>
        </div>
        {entry.description && <div className="text-secondary" style={{ fontSize: "0.8125rem" }}>{entry.description}</div>}
      </Link>
    );
  }

  const content = (
    <>
      <div className="debt-ledger-row__top">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>
            {entry.debtor.name} owes {entry.creditor.name}
          </div>
          <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: 3 }}>
            {entry.source === "member_request" ? "Accepted member debt request" : `Settlement obligation · ${entry.month}`}
          </div>
        </div>
        <div style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {formatTaka(entry.amount)}
        </div>
      </div>
    </>
  );
  const canOpenRequest = entry.source === "member_request"
    && entry.debtRequestId
    && (entry.debtor.id === currentUserId || entry.creditor.id === currentUserId);
  return canOpenRequest
    ? <Link href={`/debts/requests/${entry.debtRequestId}`} className="debt-ledger-row">{content}</Link>
    : <div className="debt-ledger-row">{content}</div>;
}
