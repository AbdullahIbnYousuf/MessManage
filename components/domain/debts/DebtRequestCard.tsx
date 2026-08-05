import Link from "next/link";
import type { DebtRequestItem } from "@/types/debts";
import { formatTaka } from "@/lib/utils/decimal";
import { DebtStatusBadge } from "@/components/domain/debts/DebtLedgerEntryCard";

export default function DebtRequestCard({ request, currentUserId }: { request: DebtRequestItem; currentUserId: string }) {
  const needsYourAction = request.status === "pending" && request.debtor.id === currentUserId;
  return <Link href={`/debts/requests/${request.id}`} className="debt-ledger-row">
    <div className="debt-ledger-row__top">
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{request.debtor.name} owes {request.requester.name}</div>
        <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: 3 }}>{needsYourAction ? "Your confirmation is required" : request.requester.id === currentUserId ? "Requested by you" : "Sent to you"}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontWeight: 800 }}>{formatTaka(request.amount)}</div><DebtStatusBadge status={request.status} /></div>
    </div>
    <div className="text-secondary" style={{ fontSize: "0.8125rem", marginTop: "0.5rem" }}>{request.description}</div>
  </Link>;
}
