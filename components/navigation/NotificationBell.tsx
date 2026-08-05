import Link from "next/link";
import NavIcon from "@/components/navigation/NavIcon";

export default function NotificationBell({ unreadCount, active = false }: { unreadCount: number; active?: boolean }) {
  return (
    <Link
      href="/notifications"
      className={`notification-bell ${active ? "active" : ""}`}
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      aria-current={active ? "page" : undefined}
    >
      <NavIcon name="notifications" size={20} />
      {unreadCount > 0 && (
        <span className="notification-bell__badge" aria-hidden="true">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

