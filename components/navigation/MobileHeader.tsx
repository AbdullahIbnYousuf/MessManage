import Image from "next/image";
import NotificationBell from "@/components/navigation/NotificationBell";

export default function MobileHeader({ unreadCount, notificationsEnabled, notificationsActive }: { unreadCount: number; notificationsEnabled: boolean; notificationsActive: boolean }) {
  return (
    <header className="layout-mobile-header">
      <div className="mobile-brand">
        <Image src="/logo.png" alt="MessManage logo" width={32} height={32} />
        <span>MessManage</span>
      </div>
      {notificationsEnabled && <NotificationBell unreadCount={unreadCount} active={notificationsActive} />}
    </header>
  );
}

