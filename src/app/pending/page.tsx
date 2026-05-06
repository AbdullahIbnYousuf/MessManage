'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function PendingPage() {
  const { membershipRequest, signOut } = useAuth();

  const isRejected = membershipRequest?.status === 'rejected';

  return (
    <div className="pending-page">
      <div className="pending-card">
        <h1 className="pending-title">
          {isRejected ? 'Access Denied' : 'Waiting for Approval'}
        </h1>
        <p className="pending-text mb-20">
          {isRejected 
            ? 'Your request to join this household has been rejected by the admin.'
            : 'Your request to join has been sent. An admin must approve your account before you can access the system.'}
        </p>
        <button onClick={signOut} className="btn btn-secondary">
          Sign Out
        </button>
      </div>
    </div>
  );
}
