'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

export function Header() {
  const { appUser } = useAuth();
  const pathname = usePathname();

  const getPageTitle = () => {
    switch (pathname) {
      case '/dashboard': return 'Dashboard';
      case '/meals': return 'Meal Calendar';
      case '/bazar': return 'Bazar & Shopping';
      case '/bulk': return 'Bulk Items';
      case '/settlements': return 'Settlements';
      case '/admin': return 'Admin Panel';
      default: return 'MealSync';
    }
  };

  const getPageSubtitle = () => {
    switch (pathname) {
      case '/dashboard': return 'Overview of your household expenses and meals';
      case '/meals': return 'Manage your daily meal schedule';
      case '/bazar': return 'Track bazar trips and expenses';
      case '/bulk': return 'Manage shared gas and rice purchases';
      case '/settlements': return 'Settle monthly balances with members';
      case '/admin': return 'System configuration and member approval';
      default: return '';
    }
  };

  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{getPageTitle()}</h1>
        <p className="page-subtitle">{getPageSubtitle()}</p>
      </div>
      <div className="flex items-center gap-12">
        <div className="badge badge-info">Current Month: {new Date().toLocaleString('default', { month: 'long' })}</div>
      </div>
    </header>
  );
}
