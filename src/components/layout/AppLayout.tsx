'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, appUser, membershipRequest, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    const isAuthRoute = pathname === '/login' || pathname === '/pending';

    if (!firebaseUser && !isAuthRoute) {
      router.push('/login');
    } else if (firebaseUser) {
      if (appUser && appUser.status === 'active') {
        if (isAuthRoute || pathname === '/') {
          router.push('/dashboard');
        }
      } else if (membershipRequest) {
        if (membershipRequest.status === 'pending' || membershipRequest.status === 'rejected') {
          if (pathname !== '/pending') {
            router.push('/pending');
          }
        } else if (membershipRequest.status === 'approved' && (!appUser || appUser.status !== 'active')) {
           // still loading or user created but not fetched, let it load
        }
      } else if (!appUser && !membershipRequest) {
        // waiting for them to load
      }
    }
  }, [firebaseUser, appUser, membershipRequest, loading, router, pathname]);

  if (loading) {
    return (
      <div className="login-page">
        <div className="spinner"></div>
      </div>
    );
  }

  // If still loading or waiting for redirect, don't render protected pages
  const isAuthRoute = pathname === '/login' || pathname === '/pending';
  if (!appUser || appUser.status !== 'active') {
    if (isAuthRoute) {
      return <>{children}</>;
    }
    return (
      <div className="page-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Header />
        <div className="page-content">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
