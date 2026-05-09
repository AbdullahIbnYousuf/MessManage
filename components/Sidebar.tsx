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
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/meals",
    label: "Meals",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: "/bazar",
    label: "Bazar",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    href: "/bulk-items",
    label: "Bulk Items",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: "/maid",
    label: "Maid",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/settlement",
    label: "Settlement",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

// The core 3 items for the mobile bottom nav
const bottomNavItems = [navItems[0], navItems[1], navItems[2]];

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // Close mobile menu when navigating
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── DESKTOP SIDEBAR ───────────────────────────────────── */}
      <aside className="layout-sidebar">
        {/* Logo */}
        <div style={{ padding: "0 0.5rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
                <path d="M12 3C6.48 3 2 6.58 2 11c0 2.42 1.28 4.59 3.34 6.06L4 21l4.35-2.17C9.39 19.27 10.66 19.5 12 19.5c5.52 0 10-3.58 10-8.5S17.52 3 12 3z" />
              </svg>
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, var(--color-primary-light), var(--color-accent))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              MealSync
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} />
          ))}

          {user.role === "admin" && (
            <>
              <div
                style={{
                  margin: "0.75rem 0.5rem 0.25rem",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
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
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <Link
            href="/profile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.5rem",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
            className="hover:bg-[var(--color-bg-elevated)]"
          >
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="avatar avatar-sm" />
            ) : (
              <div className="avatar-fallback" style={{ width: 32, height: 32, fontSize: "0.75rem" }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.name}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "capitalize" }}>
                {user.role}
              </div>
            </div>
          </Link>
        </div>
      </aside>

      {/* ── MOBILE BOTTOM NAV ──────────────────────────────────── */}
      <nav className="layout-mobile-nav">
        {bottomNavItems.map((item) => item && (
          <Link key={item.href} href={item.href} className={`mobile-nav-link ${isActive(item.href) ? "active" : ""}`}>
            {item.icon}
            <span style={{ fontSize: "0.65rem", marginTop: "2px" }}>{item.label}</span>
          </Link>
        ))}

        {/* 'More' Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="mobile-nav-link"
          style={{ background: "transparent", border: "none" }}
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span style={{ fontSize: "0.65rem", marginTop: "2px" }}>More</span>
        </button>
      </nav>

      {/* ── FULL-SCREEN MOBILE MENU OVERLAY ────────────────────── */}
      {mobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-bg-base)",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div style={{ padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
                  <path d="M12 3C6.48 3 2 6.58 2 11c0 2.42 1.28 4.59 3.34 6.06L4 21l4.35-2.17C9.39 19.27 10.66 19.5 12 19.5c5.52 0 10-3.58 10-8.5S17.52 3 12 3z" />
                </svg>
              </div>
              <span className="gradient-text" style={{ fontWeight: 700, fontSize: "1.125rem" }}>MealSync</span>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} style={{ background: "transparent", border: "none", color: "var(--color-text-secondary)" }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                Main Menu
              </div>
              {navItems.map((item) => (
                <NavLink key={item.href} {...item} active={isActive(item.href)} />
              ))}

              {user.role === "admin" && (
                <>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", marginTop: "1rem", marginBottom: "0.5rem" }}>
                    Admin
                  </div>
                  {adminItems.map((item) => (
                    <NavLink key={item.href} {...item} active={isActive(item.href)} />
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Profile footer inside mobile menu */}
          <div style={{ padding: "1.5rem", borderTop: "1px solid var(--color-border)", background: "var(--color-bg-surface)" }}>
            <Link
              href="/profile"
              style={{ display: "flex", alignItems: "center", gap: "1rem", textDecoration: "none" }}
            >
              {user.avatarUrl ? (
                <Image src={user.avatarUrl} alt={user.name} width={40} height={40} className="avatar avatar-md" />
              ) : (
                <div className="avatar-fallback" style={{ width: 40, height: 40, fontSize: "1rem" }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>{user.name}</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", textTransform: "capitalize" }}>{user.role}</div>
              </div>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        borderRadius: "var(--radius-md)",
        textDecoration: "none",
        fontSize: "0.9375rem",
        fontWeight: active ? 600 : 500,
        color: active ? "var(--color-primary-light)" : "var(--color-text-secondary)",
        background: active ? "var(--color-primary-glow)" : "transparent",
        border: active ? "1px solid rgba(59,130,246,0.2)" : "1px solid transparent",
        transition: "all 0.15s ease",
      }}
    >
      <span style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>
      {label}
    </Link>
  );
}
