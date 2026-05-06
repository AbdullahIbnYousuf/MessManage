'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dash', href: '/dashboard', icon: '' },
    { label: 'Meals', href: '/meals', icon: '' },
    { label: 'Bazar', href: '/bazar', icon: '' },
    { label: 'Settlements', href: '/settlements', icon: '' },
  ];

  return (
    <div className="mobile-nav">
      {navItems.map((item) => (
        <Link href={item.href} key={item.href} className={`mobile-nav-item ${pathname === item.href ? 'active' : ''}`}>
          <span className="mobile-nav-item-icon">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  );
}
