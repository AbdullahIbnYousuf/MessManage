'use client';

import React, { useEffect, useState } from 'react';
import { getMembershipRequests, updateMembershipRequest, createUser } from '@/lib/firestore';
import type { MembershipRequest } from '@/types';

export default function AdminPage() {
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const pending = await getMembershipRequests('pending');
      setRequests(pending);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(req: MembershipRequest) {
    try {
      const newUserId = crypto.randomUUID();
      await createUser(newUserId, {
        email: req.email,
        name: req.name,
        avatar_url: req.avatar_url,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
        deactivated_at: null,
        phone_number: null,
        phone_number_2: null,
        bkash_number: null,
        bank_name: null,
        bank_account_number: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        emergency_contact_relation: null,
      });

      await updateMembershipRequest(req.id, {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        user_id: newUserId,
      });

      setRequests(requests.filter(r => r.id !== req.id));
    } catch (e) {
      console.error('Failed to approve', e);
    }
  }

  async function handleReject(req: MembershipRequest) {
    try {
      await updateMembershipRequest(req.id, {
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
      });
      setRequests(requests.filter(r => r.id !== req.id));
    } catch (e) {
      console.error('Failed to reject', e);
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="grid gap-20">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Pending Membership Requests</h3>
          <span className="badge badge-warning">{requests.length} Pending</span>
        </div>
        
        {requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-text">No pending requests.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Requested At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <div className="flex items-center gap-12">
                        <div className="sidebar-avatar">
                          {req.avatar_url ? <img src={req.avatar_url} alt="" /> : req.name.charAt(0)}
                        </div>
                        {req.name}
                      </div>
                    </td>
                    <td className="text-muted">{req.email}</td>
                    <td className="text-muted">{new Date(req.requested_at).toLocaleDateString()}</td>
                    <td>
                      <div className="flex gap-8">
                        <button onClick={() => handleApprove(req)} className="btn btn-sm btn-success">Approve</button>
                        <button onClick={() => handleReject(req)} className="btn btn-sm btn-danger">Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
