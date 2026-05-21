import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Calendar, Network, LogOut, Users, Activity, Copy, Check, X, Lock, Unlock, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser, updateUserCallMeBot } from '../firebase/auth';
import { toggleFamilyLock } from '../firebase/db';
import AccessLog from './AccessLog';
import BackupRestore from './BackupRestore';

const navStyle = (isActive, color) => ({
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '10px 20px', borderRadius: '8px', textDecoration: 'none',
  color: isActive ? '#fff' : 'var(--text-muted)',
  background: isActive ? `rgba(${color === 'cyan' ? '0,243,255' : '131,56,236'}, 0.1)` : 'transparent',
  border: isActive ? `1px solid var(--accent-${color})` : '1px solid transparent',
  transition: 'all 0.3s ease',
  boxShadow: isActive ? `var(--glow-${color})` : 'none',
});

const iconBtn = {
  background: 'transparent', border: 'none', color: 'var(--text-muted)',
  cursor: 'pointer', padding: '8px', borderRadius: '8px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export default function Layout() {
  const { currentUser, userProfile, isAdmin, isLocked } = useAuth();
  const [showInfo,    setShowInfo]    = useState(false);
  const [showLog,     setShowLog]     = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [phone,       setPhone]       = useState(userProfile?.phone || '');
  const [waKey,       setWaKey]       = useState(userProfile?.callmebotKey || '');
  const [waSaved,     setWaSaved]     = useState(false);

  const copyFamilyId = () => {
    navigator.clipboard.writeText(userProfile?.familyId || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLockToggle = async () => {
    const action = isLocked ? 'unlock' : 'lock';
    if (!window.confirm(`${action === 'lock' ? 'Lock' : 'Unlock'} the family group? ${action === 'lock' ? 'Only you (admin) will be able to make changes.' : 'All members will be able to edit again.'}`))
      return;
    await toggleFamilyLock(userProfile.familyId, !isLocked, currentUser.uid, userProfile.username);
  };

  const handleWaSave = async () => {
    await updateUserCallMeBot(currentUser.uid, phone.trim(), waKey.trim());
    setWaSaved(true);
    setTimeout(() => setWaSaved(false), 2000);
  };

  return (
    <div>
      <nav style={{
        background: 'rgba(10,15,26,0.8)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: '80px',
      }}>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg,var(--accent-cyan),var(--accent-violet))',
            width: '40px', height: '40px', borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: 'var(--glow-cyan)',
          }}>BT</div>
          <span className="text-gradient" style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '1px' }}>
            BirthTree
          </span>
          {/* Lock badge */}
          {isLocked && (
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b',
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: '6px', padding: '2px 8px', letterSpacing: '0.5px',
            }}>LOCKED</span>
          )}
        </motion.div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <NavLink to="/"     style={({ isActive }) => navStyle(isActive, 'cyan')}>
            <Calendar size={18} /> Calendar
          </NavLink>
          <NavLink to="/tree" style={({ isActive }) => navStyle(isActive, 'violet')}>
            <Network size={18} /> Family Tree
          </NavLink>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Lock toggle — admin only */}
          {isAdmin && (
            <button onClick={handleLockToggle}
              title={isLocked ? 'Unlock family (allow edits)' : 'Lock family (restrict edits to admin)'}
              style={{ ...iconBtn, color: isLocked ? '#f59e0b' : 'var(--text-muted)' }}>
              {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            </button>
          )}
          <button onClick={() => setShowLog(v => !v)}
            style={{ ...iconBtn, color: showLog ? 'var(--accent-cyan)' : 'var(--text-muted)' }}
            title="Activity Log">
            <Activity size={18} />
          </button>
          <button onClick={() => setShowInfo(v => !v)}
            style={{ ...iconBtn, color: showInfo ? 'var(--accent-violet)' : 'var(--text-muted)' }}
            title="Family Info & Settings">
            <Users size={18} />
          </button>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{userProfile?.username}</span>
          <button onClick={logoutUser} style={iconBtn} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Info & Settings drawer */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', background: 'rgba(10,15,26,0.97)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div style={{ padding: '16px 32px', display: 'flex', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

              {/* Family ID */}
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '6px' }}>Share this ID to invite members</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code style={{ color: 'var(--accent-cyan)', fontSize: '0.82rem', background: 'rgba(0,243,255,0.08)', padding: '4px 12px', borderRadius: '6px' }}>
                    {userProfile?.familyId}
                  </code>
                  <button onClick={copyFamilyId} style={iconBtn}>
                    {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* WhatsApp reminder setup via CallMeBot */}
              <div style={{ minWidth: '320px', maxWidth: '480px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <MessageCircle size={14} color="#25D366" />
                  <span style={{ color: '#25D366', fontSize: '0.82rem', fontWeight: 600 }}>WhatsApp Reminders — free via CallMeBot</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '10px', lineHeight: 1.6 }}>
                  <strong style={{ color: 'rgba(255,255,255,0.7)' }}>One-time setup:</strong><br />
                  1. Save <strong style={{ color: 'white' }}>+34 644 597 418</strong> in WhatsApp contacts as "CallMeBot"<br />
                  2. Send this exact message to them on WhatsApp:<br />
                  <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem' }}>
                    I allow callmebot to send me messages
                  </code><br />
                  3. You'll receive your API key — paste it below
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="Your number e.g. +919876543210"
                    style={{ flex: 1, minWidth: '160px', padding: '6px 12px', fontSize: '0.82rem' }} />
                  <input type="text" value={waKey} onChange={e => setWaKey(e.target.value)}
                    placeholder="CallMeBot API key"
                    style={{ flex: 1, minWidth: '130px', padding: '6px 12px', fontSize: '0.82rem' }} />
                  <button onClick={handleWaSave} className="btn-outline"
                    style={{ padding: '6px 14px', fontSize: '0.82rem', borderColor: '#25D366', color: '#25D366', whiteSpace: 'nowrap' }}>
                    {waSaved ? <><Check size={13} color="#25D366" /> Saved!</> : 'Save'}
                  </button>
                </div>
                {userProfile?.callmebotKey && (
                  <div style={{ marginTop: '6px', fontSize: '0.74rem', color: '#25D366' }}>
                    ✓ WhatsApp reminders active — you'll receive a message when a birthday or anniversary is tomorrow or today
                  </div>
                )}
              </div>

              {/* Backup & Restore */}
              <BackupRestore />

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity log flyout */}
      <AnimatePresence>
        {showLog && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              position: 'fixed', top: '88px', right: '16px', zIndex: 200,
              width: '480px', maxHeight: '60vh', overflowY: 'auto',
              background: 'rgba(10,15,26,0.97)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px', boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 0' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent-cyan)', fontSize: '1rem' }}>Activity Log</span>
              <button onClick={() => setShowLog(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <AccessLog />
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
