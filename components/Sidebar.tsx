"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import type { SessionUser } from "@/types";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/members",
    label: "Members",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: "/meals",
    label: "Meals",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: "/bazar",
    label: "Bazar",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    href: "/bulk-items",
    label: "Bulk Items",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: "/maid",
    label: "Maid",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/fridge",
    label: "Fridge Bill",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: "/settlement",
    label: "Settlement",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const adminItems = [
  {
    href: "/admin",
    label: "Admin Panel",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const bottomNavItems = [navItems[0], navItems[1], navItems[2]];

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="layout-sidebar">
        {/* Logo */}
        <div style={{ padding: "0 0.375rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                background: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <Image src="/logo.png" alt="MealSync Logo" width={38} height={38} style={{ objectFit: "cover" }} />
            </div>
            <span
              style={{
                fontWeight: 800,
                fontSize: "1.0625rem",
                letterSpacing: "-0.03em",
                color: "var(--color-primary-light)",
              }}
            >
              MealSync
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} />
          ))}

          {user.role === "admin" && (
            <>
              <div
                style={{
                  margin: "0.875rem 0.5rem 0.375rem",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--color-text-muted)",
                }}
              >
                Admin
              </div>
              {adminItems.map((item) => (
                <NavLink key={item.href} {...item} active={isActive(item.href)} />
              ))}
            </>
          )}
        </nav>

        {/* User Footer */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: "0.875rem",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <Link
            href="/profile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.625rem 0.5rem",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              transition: "background 0.18s",
            }}
            className="hover:bg-bg-elevated"
          >
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.nickname || user.name}
                width={34}
                height={34}
                className="avatar"
                style={{ width: 34, height: 34, border: "2px solid var(--color-border)" }}
              />
            ) : (
              <div className="avatar-fallback" style={{ width: 34, height: 34, fontSize: "0.8125rem" }}>
                {(user.nickname || user.name).charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.nickname || user.name}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "capitalize" }}>
                {user.role}
              </div>
            </div>
          </Link>
        </div>
      </aside>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="layout-mobile-nav">
        {bottomNavItems.map((item) => item && (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav-link ${isActive(item.href) ? "active" : ""}`}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive(item.href) ? "var(--color-primary)" : "var(--color-bg-elevated)",
                border: `1px solid ${isActive(item.href) ? "var(--color-primary)" : "var(--color-border)"}`,
                transition: "all 0.2s ease",
              }}
            >
              {item.icon}
            </div>
            <span style={{ fontSize: "0.6rem", marginTop: "2px" }}>{item.label}</span>
          </Link>
        ))}

        {/* More button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="mobile-nav-link"
          style={{ background: "transparent", border: "none" }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
            }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <span style={{ fontSize: "0.6rem", marginTop: "2px" }}>More</span>
        </button>
      </nav>

      {/* ── FULL-SCREEN MOBILE MENU OVERLAY ── */}
      {mobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-bg-base)",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            animation: "slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "10px",
                  background: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <Image src="/logo.png" alt="MealSync Logo" width={38} height={38} style={{ objectFit: "cover" }} />
              </div>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "1.125rem",
                  color: "var(--color-primary-light)",
                }}
              >
                MealSync
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "50%",
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-text-secondary)",
                cursor: "pointer",
              }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Nav list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "0.5rem",
                  paddingLeft: "0.5rem",
                }}
              >
                Main Menu
              </div>
              {navItems.map((item) => (
                <NavLink key={item.href} {...item} active={isActive(item.href)} />
              ))}

              {user.role === "admin" && (
                <>
                  <div
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      color: "var(--color-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginTop: "1rem",
                      marginBottom: "0.5rem",
                      paddingLeft: "0.5rem",
                    }}
                  >
                    Admin
                  </div>
                  {adminItems.map((item) => (
                    <NavLink key={item.href} {...item} active={isActive(item.href)} />
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Profile footer */}
          <div
            style={{
              padding: "1.25rem 1.5rem",
              borderTop: "1px solid var(--color-border)",
              background: "var(--color-bg-surface)",
            }}
          >
            <Link href="/profile" style={{ display: "flex", alignItems: "center", gap: "1rem", textDecoration: "none" }}>
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.nickname || user.name}
                  width={44}
                  height={44}
                  className="avatar"
                  style={{ width: 44, height: 44, border: "2px solid var(--color-primary)" }}
                />
              ) : (
                <div className="avatar-fallback" style={{ width: 44, height: 44, fontSize: "1.0625rem" }}>
                  {(user.nickname || user.name).charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {user.nickname || user.name}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", textTransform: "capitalize" }}>
                  {user.role}
                </div>
              </div>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--color-text-muted)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.5rem 0.625rem",
        borderRadius: "var(--radius-md)",
        textDecoration: "none",
        fontSize: "0.9rem",
        fontWeight: active ? 700 : 500,
        color: active ? "var(--color-primary-light)" : "var(--color-text-secondary)",
        background: active ? "var(--color-primary-subtle)" : "transparent",
        transition: "all 0.18s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-bg-elevated)";
          (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
          (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-text-secondary)";
        }
      }}
    >
      {/* Circular icon container — YumQuick style */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: active
            ? "var(--color-primary)"
            : "var(--color-bg-elevated)",
          border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
          transition: "all 0.18s ease",
          color: active ? "#fff" : "var(--color-text-secondary)",
        }}
      >
        {icon}
      </div>
      {label}
    </Link>
  );
}
