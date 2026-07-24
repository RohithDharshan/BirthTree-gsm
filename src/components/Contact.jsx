import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Send, ArrowLeft, MessageSquare, CheckCircle2, Mail, Clock } from 'lucide-react';

const GOLD = '#e6b34f';
const spring = { type: 'spring', stiffness: 80, damping: 18 };

export default function Contact() {
  const auth = useAuth();
  const loggedIn = !!auth?.currentUser;

  const [form, setForm] = useState({ subject: '', fromEmail: '', description: '', website: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errMsg, setErrMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setStatus('sending'); setErrMsg('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setStatus('sent');
      setForm({ subject: '', fromEmail: '', description: '', website: '' });
    } catch (err) {
      setStatus('error');
      setErrMsg(err.message);
    }
  };

  const label = { display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontSize: '0.88rem' };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 80px' }}>
      {/* Standalone header when opened before signing in */}
      {!loggedIn && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 28px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
            <ArrowLeft size={16} /> Home
          </Link>
          <Link to="/auth" className="btn-outline" style={{ textDecoration: 'none', padding: '8px 20px', fontSize: '0.88rem' }}>
            Sign in
          </Link>
        </div>
      )}

      <motion.header initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={spring}
        style={{ textAlign: 'center', margin: '12px 0 36px' }}>
        <span style={{
          width: 56, height: 56, borderRadius: 16, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', background: 'rgba(230,179,79,0.1)',
          border: '1px solid rgba(230,179,79,0.3)', color: GOLD, marginBottom: 16,
        }}>
          <MessageSquare size={26} />
        </span>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 600, color: 'var(--text-main)' }}>
          Contact us
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.7, maxWidth: '46ch', marginInline: 'auto' }}>
          Stuck, found a problem, or have an idea for KinBloom?
          Write to us and we will reply to your email.
        </p>
      </motion.header>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}
        className="glass-panel" style={{ padding: 'clamp(24px, 5vw, 40px)' }}>
        {status === 'sent' ? (
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <CheckCircle2 size={44} color="#22c55e" style={{ marginBottom: 14 }} />
            <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: 8 }}>Message sent</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '40ch', margin: '0 auto' }}>
              Thanks for writing in. We reply to the email address you gave,
              usually within a day or two.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
              <button className="btn-outline" onClick={() => setStatus('idle')}>
                Send another message
              </button>
              <Link to={loggedIn ? '/' : '/guide'} className="btn-primary" style={{ textDecoration: 'none' }}>
                {loggedIn ? 'Back to calendar' : 'Read the guide'}
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={label} htmlFor="c-subject">Subject</label>
              <input id="c-subject" required maxLength={150} type="text" value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="What is this about?" />
            </div>
            <div>
              <label style={label} htmlFor="c-email">Your email</label>
              <input id="c-email" required type="email" value={form.fromEmail}
                onChange={e => setForm(f => ({ ...f, fromEmail: e.target.value }))}
                placeholder="you@example.com" />
            </div>
            <div>
              <label style={label} htmlFor="c-desc">Description</label>
              <textarea id="c-desc" required maxLength={4000} rows={6} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Tell us what you need help with, or what you'd like to see in KinBloom."
                style={{ resize: 'vertical', minHeight: 140, fontFamily: 'inherit' }} />
            </div>
            {/* Honeypot: hidden from people, tempting to bots */}
            <input type="text" value={form.website} tabIndex={-1} autoComplete="off"
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              aria-hidden="true" />
            {status === 'error' && (
              <div style={{ color: '#ff4d4d', fontSize: '0.88rem', padding: '10px 14px', background: 'rgba(255,77,77,0.1)', borderRadius: 8, border: '1px solid rgba(255,77,77,0.3)' }}>
                {errMsg}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={status === 'sending'}
              style={{ justifyContent: 'center', padding: '13px 24px', opacity: status === 'sending' ? 0.7 : 1 }}>
              {status === 'sending' ? 'Sending…' : <><Send size={16} /> Send message</>}
            </button>
          </form>
        )}
      </motion.div>

      <div style={{
        display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap',
        marginTop: 28, color: 'var(--text-muted)', fontSize: '0.85rem',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={14} color={GOLD} /> Replies come by email
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={14} color={GOLD} /> Usually within 1–2 days
        </span>
      </div>

    </div>
  );
}
