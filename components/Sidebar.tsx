"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/types";
import {
  activeNavigationId,
  navigationItems,
  navigationSections,
  navigationVisibleTo,
} from "@/components/navigation/config";
import NavIcon from "@/components/navigation/NavIcon";
import NavigationGroup from "@/components/navigation/NavigationGroup";
import NotificationBell from "@/components/navigation/NotificationBell";
import MobileHeader from "@/components/navigation/MobileHeader";

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const mobileMenuPanelRef = useRef<HTMLDivElement>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);
  const debtSyncEnabled = process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED === "true";
  const activeId = activeNavigationId(pathname, user.id);
  const notificationsActive = pathname === "/notifications" || pathname.startsWith("/notifications/");

  const visibleItems = useMemo(
    () => navigationItems.filter((item) => navigationVisibleTo(item, user.role, debtSyncEnabled)),
    [debtSyncEnabled, user.role]
  );
  const bottomItems = visibleItems.filter((item) => item.mobile === "bottom");
  const moreItems = visibleItems.filter((item) => item.mobile === "more");
  const moreHouseholdItems = moreItems.filter((item) => item.section !== "admin");
  const moreAdminItems = moreItems.filter((item) => item.section === "admin");
  const moreActive = pathname === "/profile"
    || pathname.startsWith("/profile/")
    || moreItems.some((item) => item.id === activeId);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!debtSyncEnabled) return;
    void fetch("/api/notifications/inbox?unreadOnly=true&limit=1")
      .then((response) => response.json())
      .then((json: { data?: { unreadCount: number } }) => setUnreadCount(json.data?.unreadCount ?? 0))
      .catch(() => undefined);
  }, [debtSyncEnabled, pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileMenuCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
      if (event.key !== "Tab" || !mobileMenuPanelRef.current) return;
      const focusable = Array.from(
        mobileMenuPanelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <aside className="layout-sidebar">
        <div className="desktop-brand-row">
          <Link href="/dashboard" className="desktop-brand" aria-label="MessManage home">
            <Image src="/logo.png" alt="MessManage logo" width={38} height={38} />
            <span>MessManage</span>
          </Link>
          {debtSyncEnabled && <NotificationBell unreadCount={unreadCount} active={notificationsActive} />}
        </div>

        <nav className="desktop-navigation" aria-label="Primary navigation">
          {navigationSections.map((section) => (
            <NavigationGroup
              key={section.id}
              label={section.label}
              items={visibleItems.filter((item) => item.section === section.id)}
              activeId={activeId}
            />
          ))}
        </nav>

        <ProfileLink user={user} active={pathname === "/profile" || pathname.startsWith("/profile/")} />
      </aside>

      <MobileHeader
        unreadCount={unreadCount}
        notificationsEnabled={debtSyncEnabled}
        notificationsActive={notificationsActive}
      />

      <nav className="layout-mobile-nav" aria-label="Mobile navigation">
        {bottomItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`mobile-nav-link ${activeId === item.id ? "active" : ""}`}
            aria-current={activeId === item.id ? "page" : undefined}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`mobile-nav-link ${moreActive ? "active" : ""}`}
          aria-label="Open more navigation"
          aria-expanded={mobileMenuOpen}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>More</span>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          <div className="mobile-menu__backdrop" onMouseDown={() => setMobileMenuOpen(false)} aria-hidden="true" />
          <div ref={mobileMenuPanelRef} className="mobile-menu__panel" role="dialog" aria-modal="true" aria-label="More navigation">
            <div className="mobile-menu__header">
              <div className="mobile-brand">
                <Image src="/logo.png" alt="MessManage logo" width={38} height={38} />
                <span>More</span>
              </div>
              <button ref={mobileMenuCloseRef} type="button" className="mobile-menu__close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="mobile-menu__links" aria-label="More destinations">
              {moreHouseholdItems.map((item) => {
                const active = item.id === activeId;
                return (
                  <Link key={item.id} href={item.href} className={`mobile-menu-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                    <span className="navigation-link__icon"><NavIcon name={item.icon} /></span>
                    <span>{item.label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                );
              })}
              <Link href="/profile" className={`mobile-menu-link ${pathname.startsWith("/profile") ? "active" : ""}`}>
                <span className="navigation-link__icon"><NavIcon name="profile" /></span>
                <span>Profile</span>
                <span aria-hidden="true">→</span>
              </Link>
              {moreAdminItems.map((item) => {
                const active = item.id === activeId;
                return (
                  <Link key={item.id} href={item.href} className={`mobile-menu-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                    <span className="navigation-link__icon"><NavIcon name={item.icon} /></span>
                    <span>{item.label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mobile-menu__user">
              <UserIdentity user={user} size={44} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProfileLink({ user, active }: { user: SessionUser; active: boolean }) {
  return (
    <div className="sidebar-profile">
      <Link href="/profile" className={`sidebar-profile__link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
        <UserIdentity user={user} size={34} />
      </Link>
    </div>
  );
}

function UserIdentity({ user, size }: { user: SessionUser; size: number }) {
  const displayName = user.nickname || user.name;
  return (
    <>
      {user.avatarUrl ? (
        <Image src={user.avatarUrl} alt={displayName} width={size} height={size} className="avatar" style={{ width: size, height: size }} />
      ) : (
        <span className="avatar-fallback" style={{ width: size, height: size, fontSize: size >= 40 ? "1rem" : "0.8125rem" }}>
          {displayName.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="user-identity__copy">
        <strong>{displayName}</strong>
        <span>{user.role}</span>
      </span>
    </>
  );
}
