import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { createFamily, joinFamily } from '../firebase/db';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../firebase/auth';
import { Plus, LogIn, LogOut } from 'lucide-react';

export default function FamilySetup() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [tab,        setTab]        = useState('create');
  const [familyName, setFamilyName] = useState('');
  const [familyId,   setFamilyId]   = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const username = userProfile?.username || currentUser?.displayName || '';

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

  const handleJoin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await joinFamily(familyId.trim(), currentUser.uid, username);
      await refreshProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-dark)', padding: '24px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel"
        style={{ width: '100%', maxWidth: '460px', padding: '40px' }}
      >
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

        <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '4px' }}>
          {[['create', 'Create Family'], ['join', 'Join Family']].map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s',
                background: tab === t ? 'linear-gradient(135deg,rgba(0,243,255,0.2),rgba(131,56,236,0.2))' : 'transparent',
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
              Create a new family group. Share the Family ID with others so they can join.
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
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Enter the Family ID shared by another member to join their group.
            </p>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Family ID</label>
              <input required type="text" value={familyId} onChange={e => setFamilyId(e.target.value)} placeholder="Paste the family ID here" />
            </div>
            {error && <div style={{ color: '#ff4d4d', fontSize: '0.85rem', padding: '10px 14px', background: 'rgba(255,77,77,0.1)', borderRadius: '8px' }}>{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: 'center', marginTop: '8px' }}>
              {loading ? 'Joining…' : <><LogIn size={18} /> Join Family</>}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
