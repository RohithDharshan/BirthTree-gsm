import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Calendar, Network, LogOut, Users, Activity, Copy, Check, X, Lock, Unlock, MessageCircle, Send, Smartphone, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser, updateUserNotificationSettings } from '../firebase/auth';
import { toggleFamilyLock } from '../firebase/db';
import { testTelegramNotification, testNtfyNotification, testWhatsAppNotification } from '../utils/reminders';
import { Mail } from 'lucide-react';
import AccessLog from './AccessLog';
import BackupRestore from './BackupRestore';

const navStyle = (isActive, color) => ({
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '10px 20px', borderRadius: '8px', textDecoration: 'none',
  color: isActive ? '#fff' : 'var(--text-muted)',
  background: isActive ? `rgba(${color === 'cyan' ? '230,179,79' : '201,111,133'}, 0.1)` : 'transparent',
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
  const { currentUser, userProfile, isAdmin, isLocked, refreshProfile } = useAuth();
  const [showInfo,    setShowInfo]    = useState(false);
  const [showLog,     setShowLog]     = useState(false);
  const [copied,      setCopied]      = useState(false);

  // Active settings tab ('telegram', 'ntfy')
  const [activeTab,    setActiveTab]    = useState('telegram');

  // Input states
  const [tgToken,      setTgToken]      = useState(userProfile?.telegramBotToken || '');
  const [tgChatId,     setTgChatId]     = useState(userProfile?.telegramChatId || '');
  const [ntfyTopic,    setNtfyTopic]    = useState(userProfile?.ntfyTopic || '');
  const [waPhone,      setWaPhone]      = useState(userProfile?.phone || '');
  const [waKey,        setWaKey]        = useState(userProfile?.callmebotKey || '');
  const [notifyEmail,  setNotifyEmail]  = useState(userProfile?.notifyEmail || '');
  const [emailOptIn,   setEmailOptIn]   = useState(userProfile?.emailOptIn ?? true);

  // Status indicators for testing / saving
  const [tgStatus,     setTgStatus]     = useState('');
  const [ntfyStatus,   setNtfyStatus]   = useState('');
  const [waStatus,     setWaStatus]     = useState('');
  const [emailStatus,  setEmailStatus]  = useState('');

  // Keep state inputs synced if database changes
  useEffect(() => {
    if (userProfile) {
      setTgToken(userProfile.telegramBotToken || '');
      setTgChatId(userProfile.telegramChatId || '');
      setNtfyTopic(userProfile.ntfyTopic || '');
      setWaPhone(userProfile.phone || '');
      setWaKey(userProfile.callmebotKey || '');
      setNotifyEmail(userProfile.notifyEmail || '');
      setEmailOptIn(userProfile.emailOptIn ?? true);
    }
  }, [userProfile]);

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

  const handleTgSaveAndTest = async () => {
    if (!tgToken.trim() || !tgChatId.trim()) {
      alert('Please enter both your Telegram Bot Token and Chat ID.');
      return;
    }
    setTgStatus('testing');
    try {
      await updateUserNotificationSettings(currentUser.uid, {
        telegramBotToken: tgToken.trim(),
        telegramChatId: tgChatId.trim()
      });
      await refreshProfile();
      await testTelegramNotification(tgToken.trim(), tgChatId.trim());
      setTgStatus('tested');
      setTimeout(() => setTgStatus(''), 3000);
    } catch (err) {
      console.error(err);
      
      let isChatNotFound = false;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.description && parsed.description.toLowerCase().includes('chat not found')) {
          isChatNotFound = true;
        }
      } catch (e) {
        if (err.message && err.message.toLowerCase().includes('chat not found')) {
          isChatNotFound = true;
        }
      }

      if (isChatNotFound) {
        alert(
          "⚠️ Telegram Setup Error: Chat Not Found!\n\n" +
          "It looks like you have not started a conversation with your bot in Telegram yet.\n\n" +
          "How to fix this in 10 seconds:\n" +
          "1. Open your Telegram app.\n" +
          "2. Search for your bot's username (the bot you created with @BotFather).\n" +
          "3. Open the chat with your bot and click the big \"START\" button at the bottom.\n" +
          "4. Once started, click the \"Save & Test Channel\" button here again!"
        );
      } else {
        alert(`Failed to save or send Telegram test: ${err.message}`);
      }
      
      setTgStatus('error');
      setTimeout(() => setTgStatus(''), 3000);
    }
  };

  const handleNtfySaveAndTest = async () => {
    if (!ntfyTopic.trim()) {
      alert('Please enter your unique ntfy.sh Topic Name.');
      return;
    }
    setNtfyStatus('testing');
    try {
      await updateUserNotificationSettings(currentUser.uid, {
        ntfyTopic: ntfyTopic.trim()
      });
      await refreshProfile();
      await testNtfyNotification(ntfyTopic.trim());
      setNtfyStatus('tested');
      setTimeout(() => setNtfyStatus(''), 3000);
    } catch (err) {
      console.error(err);
      alert(`Failed to save or send ntfy.sh test: ${err.message}`);
      setNtfyStatus('error');
      setTimeout(() => setNtfyStatus(''), 3000);
    }
  };

  const handleWaSaveAndTest = async () => {
    if (!waPhone.trim() || !waKey.trim()) {
      alert('Please enter both your WhatsApp phone number (with country code, e.g. +91...) and your CallMeBot API key.');
      return;
    }
    setWaStatus('testing');
    try {
      await updateUserNotificationSettings(currentUser.uid, {
        phone: waPhone.trim(),
        callmebotKey: waKey.trim(),
      });
      await refreshProfile();
      await testWhatsAppNotification(waPhone.trim(), waKey.trim());
      setWaStatus('tested');
      setTimeout(() => setWaStatus(''), 3000);
    } catch (err) {
      console.error(err);
      alert(`Failed to save or send WhatsApp test: ${err.message}`);
      setWaStatus('error');
      setTimeout(() => setWaStatus(''), 3000);
    }
  };

  const handleEmailSave = async () => {
    const email = notifyEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }
    setEmailStatus('testing');
    try {
      await updateUserNotificationSettings(currentUser.uid, {
        notifyEmail: email,
        emailOptIn: emailOptIn,
      });
      await refreshProfile();
      setEmailStatus('tested');
      setTimeout(() => setEmailStatus(''), 3000);
    } catch (err) {
      console.error(err);
      alert(`Failed to save email preferences: ${err.message}`);
      setEmailStatus('error');
      setTimeout(() => setEmailStatus(''), 3000);
    }
  };

  return (
    <div>
      <nav className="main-nav">
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

        {/* Desktop links */}
        <div className="nav-desktop-links">
          <NavLink to="/"     style={({ isActive }) => navStyle(isActive, 'cyan')}>
            <Calendar size={18} /> Calendar
          </NavLink>
          <NavLink to="/tree" style={({ isActive }) => navStyle(isActive, 'violet')}>
            <Network size={18} /> Family Tree
          </NavLink>
        </div>

        {/* Desktop actions */}
        <div className="nav-desktop-actions">
          {/* Lock toggle — admin only */}
          {isAdmin && (
            <button onClick={handleLockToggle}
              title={isLocked ? 'Unlock family (allow edits)' : 'Lock family (restrict edits to admin)'}
              style={{ ...iconBtn, color: isLocked ? '#f59e0b' : 'var(--text-muted)' }}>
              {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            </button>
          )}
          <button onClick={() => { setShowInfo(false); setShowLog(v => !v); }}
            style={{ ...iconBtn, color: showLog ? 'var(--accent-cyan)' : 'var(--text-muted)' }}
            title="Activity Log">
            <Activity size={18} />
          </button>
          <button onClick={() => { setShowLog(false); setShowInfo(v => !v); }}
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

      {/* Floating Bottom Tab Bar for Mobile */}
      <div className="mobile-bottom-nav">
        <NavLink to="/" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <Calendar size={20} />
          <span>Calendar</span>
        </NavLink>
        <NavLink to="/tree" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active-violet' : ''}`}>
          <Network size={20} />
          <span>Tree</span>
        </NavLink>
        <button onClick={() => { setShowLog(false); setShowInfo(v => !v); }}
          className={`mobile-nav-item ${showInfo ? 'active-violet' : ''}`}>
          <Users size={20} />
          <span>Settings</span>
        </button>
        <button onClick={() => { setShowInfo(false); setShowLog(v => !v); }}
          className={`mobile-nav-item ${showLog ? 'active' : ''}`}>
          <Activity size={20} />
          <span>Log</span>
        </button>
        <button onClick={logoutUser} className="mobile-nav-item">
          <LogOut size={20} />
          <span>Exit</span>
        </button>
      </div>

      {/* Info & Settings drawer */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', background: 'rgba(14,12,9,0.97)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="settings-drawer-content">

              {/* Family ID */}
              <div style={{ minWidth: '240px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '6px' }}>Share this ID to invite members</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code style={{ color: 'var(--accent-cyan)', fontSize: '0.82rem', background: 'rgba(230,179,79,0.08)', padding: '4px 12px', borderRadius: '6px' }}>
                    {userProfile?.familyId}
                  </code>
                  <button onClick={copyFamilyId} style={iconBtn}>
                    {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Notification Preferences tabbed panel */}
              <div style={{ minWidth: '320px', maxWidth: '520px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Bell size={16} color="var(--accent-cyan)" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>Notification Preferences</span>
                </div>
                
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.25)', padding: '3px', borderRadius: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'telegram', label: 'Telegram', icon: <Send size={12} />,       rgb: '217, 160, 74',  hex: '#d9a04a' },
                    { id: 'ntfy',     label: 'Push',     icon: <Smartphone size={12} />, rgb: '245, 158, 11', hex: '#f59e0b' },
                    { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={12} />, rgb: '37, 211, 102', hex: '#25D366' },
                    { id: 'email',    label: 'Email',    icon: <Mail size={12} />,       rgb: '201, 111, 133', hex: '#c96f85' },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      style={{
                        flex: 1, minWidth: '90px', padding: '6px 8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', borderRadius: '6px',
                        background: activeTab === tab.id ? `rgba(${tab.rgb}, 0.15)` : 'transparent',
                        color: activeTab === tab.id ? tab.hex : 'var(--text-muted)',
                        border: activeTab === tab.id ? `1px solid rgba(${tab.rgb}, 0.3)` : '1px solid transparent',
                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}>
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Contents — keyed remount gives the entrance animation;
                    no AnimatePresence so a slow/blocked exit can never wedge the tabs */}
                <div>
                  {activeTab === 'telegram' && (
                    <motion.div key="telegram" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginBottom: '12px', lineHeight: 1.5 }}>
                        <strong style={{ color: '#d9a04a' }}>100% Free & Super Stable Telegram Setup:</strong><br />
                        1. Open Telegram, search for <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" style={{ color: '#e6b34f', textDecoration: 'underline' }}>@BotFather</a>. Send <code>/newbot</code> to create a bot and copy the <strong>HTTP API Bot Token</strong>.<br />
                        2. Search for <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" style={{ color: '#e6b34f', textDecoration: 'underline' }}>@userinfobot</a>. Start the bot to find your <strong>Chat ID</strong>.<br />
                        <strong style={{ color: '#ff4444' }}>⚠️ IMPORTANT STEP 3:</strong> Search for your new bot's username on Telegram and click the <strong style={{ color: 'white' }}>\"Start\"</strong> button inside its chat window. (Bots cannot message you until you click Start!).<br />
                        4. Paste the credentials below:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input type="text" value={tgToken} onChange={e => setTgToken(e.target.value)}
                          placeholder="Bot Token (e.g. 8917381444:AAFueN6R...)"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }} />
                        <input type="text" value={tgChatId} onChange={e => setTgChatId(e.target.value)}
                          placeholder="Your Chat ID (e.g. 1308454672)"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }} />
                        <button onClick={handleTgSaveAndTest} className="btn-outline" disabled={tgStatus === 'testing'}
                          style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: '#d9a04a', color: '#d9a04a', width: '100%', justifyContent: 'center', background: 'rgba(217, 160, 74, 0.05)' }}>
                          {tgStatus === 'testing' ? 'Testing...' : tgStatus === 'tested' ? <><Check size={13} color="#22c55e" /> Saved & Tested!</> : 'Save & Test Channel'}
                        </button>
                      </div>
                      {userProfile?.telegramBotToken && (
                        <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ✓ Telegram active — your bot will notify you when events are tomorrow or today
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'ntfy' && (
                    <motion.div key="ntfy" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginBottom: '12px', lineHeight: 1.5 }}>
                        <strong style={{ color: '#f59e0b' }}>Free Mobile Push Alerts (Zero Accounts/Setup):</strong><br />
                        1. Install the <strong>ntfy</strong> app on your iOS/Android phone (completely free, open-source).<br />
                        2. Click "Subscribe to topic" and choose a completely unique, secret name (e.g., <code>birthtree-alerts-yourname</code>).<br />
                        3. Enter that exact topic name below to receive native push notifications instantly:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input type="text" value={ntfyTopic} onChange={e => setNtfyTopic(e.target.value)}
                          placeholder="Unique Topic Name (e.g. birthtree-alerts-john)"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }} />
                        <button onClick={handleNtfySaveAndTest} className="btn-outline" disabled={ntfyStatus === 'testing'}
                          style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: '#f59e0b', color: '#f59e0b', width: '100%', justifyContent: 'center', background: 'rgba(245, 158, 11, 0.05)' }}>
                          {ntfyStatus === 'testing' ? 'Testing...' : ntfyStatus === 'tested' ? <><Check size={13} color="#22c55e" /> Saved & Tested!</> : 'Save & Test Channel'}
                        </button>
                      </div>
                      {userProfile?.ntfyTopic && (
                        <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ✓ ntfy.sh active — you will receive a push alert for upcoming family events
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'whatsapp' && (
                    <motion.div key="whatsapp" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginBottom: '12px', lineHeight: 1.5 }}>
                        <strong style={{ color: '#25D366' }}>Free WhatsApp Reminders (CallMeBot):</strong><br />
                        1. Save <strong>+34 644 66 32 62</strong> in your phone contacts (any name, e.g. "CallMeBot").<br />
                        2. Send this exact WhatsApp message to that contact: <code>I allow callmebot to send me messages</code><br />
                        3. The bot replies with your personal <strong>API key</strong>.<br />
                        4. Enter your WhatsApp number (with country code) and the key below:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input type="text" value={waPhone} onChange={e => setWaPhone(e.target.value)}
                          placeholder="Phone with country code (e.g. +919876543210)"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }} />
                        <input type="text" value={waKey} onChange={e => setWaKey(e.target.value)}
                          placeholder="CallMeBot API key (e.g. 123456)"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }} />
                        <button onClick={handleWaSaveAndTest} className="btn-outline" disabled={waStatus === 'testing'}
                          style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: '#25D366', color: '#25D366', width: '100%', justifyContent: 'center', background: 'rgba(37, 211, 102, 0.05)' }}>
                          {waStatus === 'testing' ? 'Testing...' : waStatus === 'tested' ? <><Check size={13} color="#22c55e" /> Saved & Test Sent!</> : 'Save & Test Channel'}
                        </button>
                      </div>
                      {userProfile?.phone && userProfile?.callmebotKey && (
                        <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ✓ WhatsApp active — you'll get a WhatsApp message when events are tomorrow or today
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'email' && (
                    <motion.div key="email" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginBottom: '12px', lineHeight: 1.5 }}>
                        <strong style={{ color: '#c96f85' }}>Daily Email Reminders:</strong><br />
                        Enter your email and opt in — every morning (8:00 AM IST) BirthTree checks your
                        family's events and emails you from <code>rojitenterprise@gmail.com</code> when
                        an occasion is <strong>today or tomorrow</strong>.
                        <em> Check spam on the first email and mark it "Not spam".</em>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input type="email" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)}
                          placeholder="you@example.com"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={emailOptIn} onChange={e => setEmailOptIn(e.target.checked)}
                            style={{ width: 'auto', accentColor: '#c96f85', cursor: 'pointer' }} />
                          I opt in to receive event reminder emails
                        </label>
                        <button onClick={handleEmailSave} className="btn-outline" disabled={emailStatus === 'testing'}
                          style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: '#c96f85', color: '#d98ba0', width: '100%', justifyContent: 'center', background: 'rgba(201, 111, 133, 0.05)' }}>
                          {emailStatus === 'testing' ? 'Saving...' : emailStatus === 'tested' ? <><Check size={13} color="#22c55e" /> Saved!</> : 'Save Email Preferences'}
                        </button>
                      </div>
                      {userProfile?.notifyEmail && userProfile?.emailOptIn && (
                        <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ✓ Opted in — daily reminders go to {userProfile.notifyEmail}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
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
            className="activity-log-flyout"
            style={{
              position: 'fixed', top: '88px', right: '16px', zIndex: 200,
              width: '480px', maxHeight: '60vh', overflowY: 'auto',
              background: 'rgba(14,12,9,0.97)', border: '1px solid rgba(255,255,255,0.1)',
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
