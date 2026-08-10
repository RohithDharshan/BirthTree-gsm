import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  createFamily, requestToJoinFamily, subscribeToMyJoinRequest,
  adoptApprovedFamily, cancelJoinRequest,
} from '../firebase/db';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../firebase/auth';
import { Plus, LogIn, LogOut, Clock, X, Check } from 'lucide-react';

export default function FamilySetup() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [tab,        setTab]        = useState('create');
  const [familyName, setFamilyName] = useState('');
  const [familyId,   setFamilyId]   = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  // A pending pointer on the profile means this user is waiting on an admin.
  const pendingFamilyId = userProfile?.pendingFamilyId || null;
  const [request, setRequest] = useState(undefined); // undefined = loading, null = none

  const username = userProfile?.username || currentUser?.displayName || '';

  // Watch our own join request while one is outstanding.
  useEffect(() => {
    if (!pendingFamilyId || !currentUser) { setRequest(null); return; }
    return subscribeToMyJoinRequest(pendingFamilyId, currentUser.uid, setRequest);
  }, [pendingFamilyId, currentUser]);

  // The moment an admin approves, claim the family on our own profile.
  useEffect(() => {
    if (request?.status === 'approved' && pendingFamilyId && currentUser) {
      (async () => {
        await adoptApprovedFamily(pendingFamilyId, currentUser.uid);
        await refreshProfile();
      })();
    }
  }, [request?.status, pendingFamilyId, currentUser, refreshProfile]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await createFamily(familyName, currentUser.uid, username);
      await refreshProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await requestToJoinFamily(familyId.trim(), currentUser.uid, username);
      await refreshProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!pendingFamilyId) return;
    setLoading(true);
    try {
      await cancelJoinRequest(pendingFamilyId, currentUser.uid);
      setFamilyId('');
      await refreshProfile();
    } finally {
      setLoading(false);
    }
  };

  const panelWrap = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-dark)', padding: '24px',
  };

  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
      <div>
        <h1 className="text-gradient" style={{ fontSize: '1.8rem', marginBottom: '6px' }}>Family Group</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Welcome, <strong style={{ color: 'white' }}>{username}</strong>
        </p>
      </div>
      <button onClick={logoutUser}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
        <LogOut size={16} /> Logout
      </button>
    </div>
  );

  // ── Waiting-for-approval view ────────────────────────────────────────────
  const isPending = pendingFamilyId && (request === undefined || request?.status === 'pending' || request?.status === 'approved');
  const isRejected = pendingFamilyId && request === null; // request doc gone = declined/withdrawn elsewhere

  if (isPending || isRejected) {
    return (
      <div style={panelWrap}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '40px' }}>
          {header}
          {isRejected ? (
            <div style={{ textAlign: 'center' }}>
              <span style={{ width: 56, height: 56, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.3)', color: '#ff4d4d', marginBottom: 16 }}>
                <X size={26} />
              </span>
              <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', marginBottom: 8 }}>Request not approved</h2>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 22 }}>
                Your request to join wasn’t approved, or it was withdrawn. You can create your
                own family or request to join a different one.
              </p>
              <button className="btn-primary" onClick={handleCancel} disabled={loading} style={{ justifyContent: 'center', width: '100%' }}>
                {loading ? 'Please wait…' : 'Back to start'}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <span style={{ width: 56, height: 56, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(230,179,79,0.1)', border: '1px solid rgba(230,179,79,0.3)', color: '#e6b34f', marginBottom: 16 }}>
                {request?.status === 'approved' ? <Check size={26} /> : <Clock size={26} />}
              </span>
              <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', marginBottom: 8 }}>
                {request?.status === 'approved' ? 'Approved — setting you up…' : 'Waiting for approval'}
              </h2>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 22 }}>
                {request?.status === 'approved'
                  ? 'The admin approved your request. Loading your family now…'
                  : 'Your request has been sent to the family admin. You’ll be let in as soon as they approve it — you can keep this page open or check back later.'}
              </p>
              {request?.status !== 'approved' && (
                <button className="btn-outline" onClick={handleCancel} disabled={loading} style={{ justifyContent: 'center', width: '100%' }}>
                  {loading ? 'Please wait…' : 'Cancel request'}
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Create / Request view ────────────────────────────────────────────────
  return (
    <div style={panelWrap}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel"
        style={{ width: '100%', maxWidth: '460px', padding: '40px' }}
      >
        {header}

        <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '4px' }}>
          {[['create', 'Create Family'], ['join', 'Join Family']].map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s',
                background: tab === t ? 'linear-gradient(135deg,rgba(230,179,79,0.2),rgba(201,111,133,0.2))' : 'transparent',
                color: tab === t ? 'white' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Create a new family group. Share the Family ID with others so they can request to join.
            </p>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Family Name</label>
              <input required type="text" value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="e.g. The Smiths" />
            </div>
            {error && <div style={{ color: '#ff4d4d', fontSize: '0.85rem', padding: '10px 14px', background: 'rgba(255,77,77,0.1)', borderRadius: '8px' }}>{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: 'center', marginTop: '8px' }}>
              {loading ? 'Creating…' : <><Plus size={18} /> Create Family</>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Enter the Family ID shared by an admin. They’ll get a request to approve before
              you can see the family’s calendar and tree.
            </p>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Family ID</label>
              <input required type="text" value={familyId} onChange={e => setFamilyId(e.target.value)} placeholder="Paste the family ID here" />
            </div>
            {error && <div style={{ color: '#ff4d4d', fontSize: '0.85rem', padding: '10px 14px', background: 'rgba(255,77,77,0.1)', borderRadius: '8px' }}>{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: 'center', marginTop: '8px' }}>
              {loading ? 'Sending…' : <><LogIn size={18} /> Request to Join</>}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
