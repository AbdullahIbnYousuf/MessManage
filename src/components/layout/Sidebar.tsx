'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export function Sidebar() {
  const pathname = usePathname();
  const { appUser, signOut } = useAuth();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: '' },
    { label: 'Meal Calendar', href: '/meals', icon: '' },
    { label: 'Bazar & Shopping', href: '/bazar', icon: '' },
    { label: 'Bulk Items', href: '/bulk', icon: '' },
    { label: 'Settlements', href: '/settlements', icon: '' },
  ];

  if (appUser?.role === 'admin') {
    navItems.push({ label: 'Admin Panel', href: '/admin', icon: '' });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">M</div>
        <div>
          <div className="sidebar-logo-text">MealSync</div>
          <div className="sidebar-logo-sub">Household Manager</div>
        </div>
      </div>

      <div className="sidebar-nav">
        <div className="nav-section-title">Menu</div>
        {navItems.map((item) => (
          <Link href={item.href} key={item.href} className={`nav-item ${pathname === item.href ? 'active' : ''}`}>
            <span className="nav-item-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="sidebar-user">
        <div className="sidebar-avatar">
          {appUser?.avatar_url ? (
            <img src={appUser.avatar_url} alt={appUser.name} />
          ) : (
            appUser?.name?.charAt(0) || 'U'
          )}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{appUser?.name}</div>
          <div className="sidebar-user-role">{appUser?.role}</div>
        </div>
        <button onClick={signOut} className="btn btn-ghost btn-sm" title="Sign Out">
          Sign Out
        </button>
      </div>
    </aside>
  );
}
