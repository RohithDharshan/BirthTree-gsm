import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { registerUser, loginUser } from '../firebase/auth';
import { User, Lock, LogIn, UserPlus } from 'lucide-react';

export default function AuthScreen() {
  const [tab,      setTab]      = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'register') await registerUser(username, password);
      else                    await loginUser(username, password);
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
        style={{ width: '100%', maxWidth: '420px', padding: '40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-violet))',
            width: '56px', height: '56px', borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: '1.5rem',
            margin: '0 auto 16px', boxShadow: 'var(--glow-cyan)',
          }}>BT</div>
          <h1 className="text-gradient" style={{ fontSize: '2rem', fontWeight: 700 }}>BirthTree</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Family calendar & tree builder</p>
        </div>

        <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '4px' }}>
          {['login', 'register'].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.95rem', transition: 'all 0.2s',
                background: tab === t ? 'linear-gradient(135deg,rgba(0,243,255,0.2),rgba(131,56,236,0.2))' : 'transparent',
                color: tab === t ? 'white' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              }}>
              {t === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input required type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Username" autoComplete="username"
              style={{ paddingLeft: '40px' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
              style={{ paddingLeft: '40px' }} />
          </div>

          {error && (
            <div style={{ color: '#ff4d4d', fontSize: '0.85rem', padding: '10px 14px', background: 'rgba(255,77,77,0.1)', borderRadius: '8px', border: '1px solid rgba(255,77,77,0.3)' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}
            style={{ justifyContent: 'center', opacity: loading ? 0.7 : 1, marginTop: '8px' }}>
            {loading ? 'Please wait…'
              : tab === 'login' ? <><LogIn size={18} /> Sign In</>
              : <><UserPlus size={18} /> Create Account</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
