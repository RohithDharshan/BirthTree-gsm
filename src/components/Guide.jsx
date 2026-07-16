import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  CalendarDays, Network, Bell, Send, Smartphone, Mail,
  UserPlus, KeyRound, ArrowLeft, MessageSquare, CheckCircle2,
} from 'lucide-react';

const GOLD = '#e6b34f';
const spring = { type: 'spring', stiffness: 80, damping: 18 };

/* One numbered step row: gold number, title, plain explanation */
function Step({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${GOLD}`, color: GOLD,
        fontWeight: 700, fontSize: '0.85rem', marginTop: 2,
        fontVariantNumeric: 'tabular-nums',
      }}>{n}</div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-main)' }}>{title}</div>
        <p style={{ color: '#c2b9ab', lineHeight: 1.7, fontSize: '0.92rem', maxWidth: '58ch' }}>{children}</p>
      </div>
    </div>
  );
}

/* A guide section: icon + heading + steps, in one glass panel */
function Section({ icon, title, intro, children }) {
  return (
    <motion.section
      initial={{ opacity: 1, y: 0 }} whileInView={{ opacity: 1, y: 0 }}
      className="glass-panel"
      style={{ padding: 'clamp(24px, 4vw, 36px)', marginBottom: 28 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{
          width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'rgba(230,179,79,0.1)',
          border: '1px solid rgba(230,179,79,0.3)', color: GOLD, flexShrink: 0,
        }}>{icon}</span>
        <h2 style={{ fontSize: 'clamp(1.4rem, 2.4vw, 1.8rem)', fontWeight: 600, color: 'var(--text-main)' }}>{title}</h2>
      </div>
      {intro && <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, margin: '4px 0 24px', maxWidth: '62ch' }}>{intro}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>{children}</div>
    </motion.section>
  );
}

function ContactForm() {
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

  if (status === 'sent') {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px' }}>
        <CheckCircle2 size={40} color="#22c55e" style={{ marginBottom: 14 }} />
        <h3 style={{ fontSize: '1.3rem', color: 'var(--text-main)', marginBottom: 8 }}>Message sent</h3>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Thanks for writing in. We reply to the email address you gave, usually within a day or two.
        </p>
        <button className="btn-outline" style={{ marginTop: 20 }} onClick={() => setStatus('idle')}>
          Send another message
        </button>
      </div>
    );
  }

  const label = { display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontSize: '0.88rem' };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
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
      </div>
      <div>
        <label style={label} htmlFor="c-desc">Description</label>
        <textarea id="c-desc" required maxLength={4000} rows={6} value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Tell us what you need help with, or what you'd like to see in KinBloom."
          style={{ resize: 'vertical', minHeight: 130, fontFamily: 'inherit' }} />
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
  );
}

export default function Guide() {
  const auth = useAuth();
  const loggedIn = !!auth?.currentUser;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px 80px' }}>
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
        style={{ textAlign: 'center', margin: '12px 0 44px' }}>
        <img src="/kinbloom-mark.png" alt="" style={{ width: 58, height: 58, borderRadius: '50%', marginBottom: 14 }} />
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 600, color: 'var(--text-main)' }}>
          Step by step information
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.7, maxWidth: '52ch', marginInline: 'auto' }}>
          Everything in KinBloom, explained in order: setting up your family,
          adding dates, growing the tree, and turning on reminders.
        </p>
      </motion.header>

      <Section icon={<KeyRound size={20} />} title="Getting started"
        intro="One person creates the family; everyone else joins it with a single code.">
        <Step n={1} title="Create your account">
          Tap Sign Up and choose a username and password. No email is needed to register.
        </Step>
        <Step n={2} title="Create a family group">
          Pick "Create Family" and give it a name, like "The Sharmas". You become the family admin.
        </Step>
        <Step n={3} title="Invite everyone with your Family ID">
          Open Settings (the 👥 icon in the top bar) and copy the Family ID. Send it to your
          family on WhatsApp or anywhere. They sign up, pick "Join Family", and paste the code.
        </Step>
      </Section>

      <Section icon={<CalendarDays size={20} />} title="Add a birthday or anniversary"
        intro="Dates you add appear on the shared calendar for the whole family, with the person's photo on their day.">
        <Step n={1} title="Open the Calendar and tap Add Date">
          The gold "Add Date" button sits at the top right of the calendar page.
        </Step>
        <Step n={2} title="Fill in the person's details">
          Enter their name, choose Birthday or Anniversary, pick the date, and upload a photo
          if you have one. Photos show up right on the calendar cell.
        </Step>
        <Step n={3} title="Save, and it appears for everyone">
          The date shows a gold ring for birthdays and a rose ring for anniversaries.
          Tap any marked day to see who it belongs to, share it on WhatsApp, or delete it.
        </Step>
      </Section>

      <Section icon={<Network size={20} />} title="Build your family tree"
        intro="You describe each person once; KinBloom connects the generations by itself.">
        <Step n={1} title="Add yourself first">
          On the Family Tree page tap "Add Member", enter your name, and write "Me" as the
          relationship. This is the root the tree grows from.
        </Step>
        <Step n={2} title="Add relatives one by one">
          For each new person, give their name, their relationship (Father, Mother, Wife,
          Son, Sister…), and answer "Whose relative?" by picking someone already on the tree.
        </Step>
        <Step n={3} title="Watch the connections draw themselves">
          Couples are joined with a heart. Children hang from both parents. Adding a second
          parent to someone automatically marries the two parents.
        </Step>
        <Step n={4} title="Tidy or export anytime">
          "Rebuild Tree" re-arranges everything neatly. "Download" saves the whole tree as a
          picture you can share or print.
        </Step>
      </Section>

      <Section icon={<Bell size={20} />} title="Turn on reminders"
        intro="Reminders arrive when an event is today or tomorrow. Each family member picks their own channels in Settings (👥 icon) → Notification Preferences.">
        <Step n={1} title="In the app">
          Allow notifications when the browser asks. Whenever you open KinBloom on the day
          of an event, a banner also lists everything coming up in the next 7 days.
        </Step>
        <Step n={2} title={<span><Send size={13} style={{ verticalAlign: -1 }} /> Telegram</span>}>
          In the Telegram tab, follow the three short steps: create a bot with @BotFather,
          get your Chat ID from @userinfobot, press Start inside your bot's chat, then paste
          both values and tap "Save &amp; Test Channel". A test message confirms it works.
        </Step>
        <Step n={3} title={<span><Mail size={13} style={{ verticalAlign: -1 }} /> Email</span>}>
          In the Email tab, type your address and tick "I opt in". Every morning at 8:00 AM
          KinBloom checks your family's events and emails you from rojitenterprise@gmail.com
          when something is near. Check spam the first time and mark it "Not spam".
        </Step>
        <Step n={4} title={<span><Smartphone size={13} style={{ verticalAlign: -1 }} /> Phone push</span>}>
          Install the free ntfy app, subscribe to a secret topic name you invent, and enter
          that same topic in the Push tab. You will get native phone notifications.
        </Step>
      </Section>

      <Section icon={<MessageSquare size={20} />} title="Contact us"
        intro="Stuck, found a problem, or have an idea? Write to us and we will get back to you by email.">
        <ContactForm />
      </Section>

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.12em', marginTop: 36 }}>
        KINBLOOM · BY ROJIT ENTERPRISE
      </p>
    </div>
  );
}
