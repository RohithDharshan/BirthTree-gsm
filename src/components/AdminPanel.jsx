import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Users, Home, CalendarDays, Activity, Mail, RefreshCw, Trash2, Unlink, ShieldCheck } from 'lucide-react';

const tile = {
  flex: '1 1 150px', padding: '20px 22px', borderRadius: '14px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
};

const th = {
  textAlign: 'left', padding: '10px 12px', fontSize: '0.72rem', fontWeight: 600,
  color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase',
  borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap',
};
const td = {
  padding: '10px 12px', fontSize: '0.85rem',
  borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap',
};

const dot = (on) => (
  <span style={{
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: on ? '#22c55e' : 'rgba(255,255,255,0.15)',
  }} />
);

export default function AdminPanel() {
  const { currentUser, isSuperAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin, load]);

  const act = async (action, uid, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(uid);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, uid }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setBusy(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        This page is only available to the site administrator.
      </div>
    );
  }

  const t = data?.totals;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.2rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldCheck size={30} color="#e6b34f" /> Admin Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>All users, families, and usage across KinBloom</p>
        </div>
        <button className="btn-outline" onClick={load} disabled={loading}>
          <RefreshCw size={16} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ color: '#ff4d4d', padding: '12px 16px', background: 'rgba(255,77,77,0.1)', borderRadius: '10px', border: '1px solid rgba(255,77,77,0.3)', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {loading && !data && <p style={{ color: 'var(--text-muted)' }}>Loading analytics…</p>}

      {data && (
        <>
          {/* Stat tiles */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '28px' }}>
            {[
              { icon: <Users size={16} />,        label: 'Users',          value: t.users },
              { icon: <Home size={16} />,         label: 'Families',       value: t.families },
              { icon: <CalendarDays size={16} />, label: 'Events',         value: t.events },
              { icon: <Activity size={16} />,     label: 'Total actions',  value: t.activity },
              { icon: <Mail size={16} />,         label: 'Email opt-ins',  value: t.emailOptIns },
            ].map(s => (
              <div key={s.label} style={tile}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '8px' }}>
                  {s.icon} {s.label}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#e6b34f' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Users table */}
          <div className="glass-panel" style={{ padding: '22px', marginBottom: '24px', overflowX: 'auto' }}>
            <div className="section-heading"><h2 className="text-gradient">Users</h2><span className="badge-count">{data.users.length}</span></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Username</th><th style={th}>Family</th><th style={th}>Email</th>
                <th style={th}>Opt-in</th><th style={th}>Telegram</th><th style={th}>Push</th>
                <th style={th}>Joined</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {data.users.map(u => {
                  const fam = data.families.find(f => f.id === u.familyId);
                  return (
                    <tr key={u.uid}>
                      <td style={{ ...td, fontWeight: 600 }}>{u.username}</td>
                      <td style={td}>{fam?.name || (u.familyId ? u.familyId.slice(0, 8) + '…' : <span style={{ color: 'var(--text-muted)' }}>none</span>)}</td>
                      <td style={td}>{u.email || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={td}>{dot(u.emailOptIn)}</td>
                      <td style={td}>{dot(u.telegram)}</td>
                      <td style={td}>{dot(u.push)}</td>
                      <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.78rem' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {u.familyId && (
                            <button title="Detach from family" disabled={busy === u.uid}
                              onClick={() => act('detachUser', u.uid, `Remove ${u.username} from their family? Their account stays.`)}
                              style={{ background: 'transparent', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                              <Unlink size={13} />
                            </button>
                          )}
                          <button title="Delete user permanently" disabled={busy === u.uid}
                            onClick={() => act('deleteUser', u.uid, `PERMANENTLY delete ${u.username}? This removes their login and profile. This cannot be undone.`)}
                            style={{ background: 'transparent', border: '1px solid rgba(255,77,77,0.4)', color: '#ff4d4d', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Families table */}
          <div className="glass-panel" style={{ padding: '22px', marginBottom: '24px', overflowX: 'auto' }}>
            <div className="section-heading"><h2 className="text-gradient">Families</h2><span className="badge-count">{data.families.length}</span></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Name</th><th style={th}>Members</th><th style={th}>Events</th>
                <th style={th}>Actions logged</th><th style={th}>Locked</th><th style={th}>Created</th>
              </tr></thead>
              <tbody>
                {data.families.map(f => (
                  <tr key={f.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{f.name}</td>
                    <td style={td}>{f.members}</td>
                    <td style={td}>{f.events}</td>
                    <td style={td}>{f.activity}</td>
                    <td style={td}>{f.locked ? '🔒' : '—'}</td>
                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.78rem' }}>{f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent activity */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <div className="section-heading"><h2 className="text-gradient">Recent activity</h2></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.recent.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No activity yet.</p>}
              {data.recent.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'baseline', fontSize: '0.85rem', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#e6b34f' }}>{r.username}</strong>
                  <span>{r.details}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 'auto' }}>
                    {r.family} · {r.ts ? new Date(r.ts).toLocaleString() : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
