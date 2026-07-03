import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToEvents, addEvent, removeEvent } from '../firebase/db';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/imageUtils';
import { requestNotificationPermission, checkAndNotify, sendWhatsAppReminder } from '../utils/reminders';
import { getDaysInMonth } from 'date-fns';
import { Download, Plus, X, Calendar as CalendarIcon, Heart, Trash2, Bell, MessageCircle, Lock } from 'lucide-react';
import { toBlob } from 'html-to-image';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const photoFill = (evt, onClick, style = {}) => (
  <div
    onClick={onClick}
    style={{ width: '100%', height: '100%', cursor: 'pointer', overflow: 'hidden', ...style }}
    title={evt.name}
  >
    {evt.photo ? (
      <img
        src={evt.photo}
        alt={evt.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    ) : (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: evt.type === 'birthday' ? 'rgba(239,68,68,0.35)' : 'rgba(107,114,128,0.35)',
        fontSize: '0.8rem', fontWeight: 'bold', color: 'white',
      }}>
        {evt.name.charAt(0)}
      </div>
    )}
  </div>
);

const renderDayEvents = (dayEvents, setSelectedEvent) => {
  const count = dayEvents.length;
  if (count === 0) return null;

  const borderColor = dayEvents[0].type === 'birthday' ? '#ef4444' : '#6b7280';

  // All layouts are absolutely positioned to fill the entire cell
  const base = { position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: '4px' };

  if (count === 1) {
    return (
      <div style={{ ...base, outline: `2px solid ${borderColor}` }}>
        {photoFill(dayEvents[0], (e) => { e.stopPropagation(); setSelectedEvent(dayEvents[0]); })}
      </div>
    );
  }

  if (count === 2) {
    return (
      <div style={{ ...base, display: 'flex' }}>
        {photoFill(dayEvents[0], (e) => { e.stopPropagation(); setSelectedEvent(dayEvents[0]); }, { borderRight: '1px solid rgba(255,255,255,0.25)' })}
        {photoFill(dayEvents[1], (e) => { e.stopPropagation(); setSelectedEvent(dayEvents[1]); })}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div style={{ ...base, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
        <div style={{ gridColumn: '1 / 3', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.25)' }}>
          {photoFill(dayEvents[0], (e) => { e.stopPropagation(); setSelectedEvent(dayEvents[0]); })}
        </div>
        <div style={{ overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.25)' }}>
          {photoFill(dayEvents[1], (e) => { e.stopPropagation(); setSelectedEvent(dayEvents[1]); })}
        </div>
        <div style={{ overflow: 'hidden' }}>
          {photoFill(dayEvents[2], (e) => { e.stopPropagation(); setSelectedEvent(dayEvents[2]); })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...base, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
      {dayEvents.slice(0, 4).map((evt, idx) => (
        <div key={idx} style={{
          overflow: 'hidden',
          borderRight: idx % 2 === 0 ? '1px solid rgba(255,255,255,0.25)' : 'none',
          borderBottom: idx < 2 ? '1px solid rgba(255,255,255,0.25)' : 'none',
        }}>
          {photoFill(evt, (e) => { e.stopPropagation(); setSelectedEvent(evt); })}
        </div>
      ))}
    </div>
  );
};

export default function CalendarView() {
  const { userProfile, currentUser, canEdit, isLocked } = useAuth();
  const [events,          setEvents]          = useState([]);
  const [isAddModalOpen,  setIsAddModalOpen]  = useState(false);
  const [selectedEvent,   setSelectedEvent]   = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [selectedMonth,   setSelectedMonth]   = useState('all');
  const [notifPerm,       setNotifPerm]       = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  const calendarRef = useRef(null);

  // Ask for notification permission once on first load
  useEffect(() => {
    requestNotificationPermission().then(p => { if (p) setNotifPerm(p); });
  }, []);

  useEffect(() => {
    if (!userProfile?.familyId) return;
    return subscribeToEvents(userProfile.familyId, (evts) => {
      setEvents(evts);
      checkAndNotify(evts);                          // browser notification
      sendWhatsAppReminder(evts, userProfile);        // WhatsApp via CallMeBot
    });
  }, [userProfile?.familyId]);

  const handleDownload = async () => {
    if (!calendarRef.current) return;
    try {
      const blob = await toBlob(calendarRef.current, {
        backgroundColor: '#0a0f1a',
        pixelRatio: 2,
        useCORS: true,
        allowTaint: true,
      });
      
      if (!blob) {
        alert("Failed to generate image. Please try again.");
        return;
      }

      // Create a proper download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `birthtree-calendar-${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to generate image. " + err.message);
    }
  };

  // Upcoming events in the next 7 days
  const upcomingEvents = events.filter(e => {
    if (!e.date) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const eDate = new Date(e.date);
    let next = new Date(today.getFullYear(), eDate.getMonth(), eDate.getDate());
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    const diff = Math.round((next - today) / 86400000);
    return diff >= 0 && diff <= 7;
  }).sort((a, b) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysUntil = e => {
      const d = new Date(e.date);
      let n = new Date(today.getFullYear(), d.getMonth(), d.getDate());
      if (n < today) n.setFullYear(today.getFullYear() + 1);
      return Math.round((n - today) / 86400000);
    };
    return daysUntil(a) - daysUntil(b);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="container"
      style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}
    >
      {/* Upcoming reminders banner */}
      {upcomingEvents.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: '24px', padding: '14px 20px',
            background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(239,68,68,0.08))',
            border: '1px solid rgba(245,158,11,0.35)', borderRadius: '12px',
            display: 'flex', gap: '12px', alignItems: 'flex-start',
          }}>
          <Bell size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: '#f59e0b', fontSize: '0.9rem' }}>Upcoming in the next 7 days</span>
              {notifPerm === 'default' && (
                <button onClick={() => requestNotificationPermission().then(p => setNotifPerm(p))}
                  style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: '6px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: 'pointer' }}>
                  🔔 Enable notifications
                </button>
              )}
              {notifPerm === 'granted' && (
                <span style={{ fontSize: '0.75rem', color: '#22c55e' }}>🔔 Notifications on</span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {upcomingEvents.map(evt => {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const d = new Date(evt.date);
                let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
                if (next < today) next.setFullYear(today.getFullYear() + 1);
                const diff = Math.round((next - today) / 86400000);
                const label = diff === 0 ? 'Today!' : diff === 1 ? 'Tomorrow' : `in ${diff} days`;
                const waText = encodeURIComponent(`${evt.type === 'birthday' ? '🎂' : '💍'} Reminder: ${evt.name}'s ${evt.type} is ${label}! 🎉`);
                return (
                  <div key={evt.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '6px 12px',
                  }}>
                    <span style={{ fontSize: '0.85rem' }}>
                      {evt.type === 'birthday' ? '🎂' : '💍'} <strong>{evt.name}</strong>
                      <span style={{ color: diff === 0 ? '#ef4444' : '#f59e0b', marginLeft: 6 }}>{label}</span>
                    </span>
                    <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer"
                      title="Share on WhatsApp"
                      style={{ color: '#25D366', display: 'flex', alignItems: 'center' }}>
                      <MessageCircle size={15} />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Locked notice for non-admin */}
      {isLocked && !canEdit && (
        <div style={{
          marginBottom: '16px', padding: '10px 16px',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px',
          color: '#f59e0b', fontSize: '0.85rem',
        }}>
          <Lock size={14} /> This family group is locked. Only the admin can make changes.
        </div>
      )}

      <div className="calendar-header">
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Special Occasions</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track birthdays and anniversaries of your loved ones</p>
        </div>
        <div className="controls-group">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="all">All Months</option>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <button className="btn-outline" onClick={handleDownload}>
            <Download size={18} /> Download
          </button>
          {canEdit && (
            <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={18} /> Add Date
            </button>
          )}
        </div>
      </div>

      <div ref={calendarRef} className="calendar-grid">
        {MONTHS.map((month, monthIndex) => {
          if (selectedMonth !== 'all' && Number(selectedMonth) !== monthIndex) return null;

          const year = new Date().getFullYear();
          const daysCount = getDaysInMonth(new Date(year, monthIndex));
          const days = Array.from({ length: daysCount }, (_, i) => i + 1);
          const firstWeekday = new Date(year, monthIndex, 1).getDay();
          const today = new Date();

          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: monthIndex * 0.05 }}
              key={month}
              className="glass-panel month-card"
            >
              <h3 className="month-title">{month}</h3>
              <div className="days-grid">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <div key={d} className="day-header">{d}</div>
                ))}
                {Array.from({ length: firstWeekday }, (_, i) => (
                  <div key={`pad-${i}`} className="day-cell empty" />
                ))}
                {days.map(day => {
                  const dayEvents = events.filter(e => {
                    if (!e.date) return false;
                    const eDate = new Date(e.date);
                    // Match month and day regardless of year for repeating events
                    return eDate.getMonth() === monthIndex && eDate.getDate() === day;
                  });

                  const hasEvent = dayEvents.length > 0;
                  const isToday = today.getMonth() === monthIndex && today.getDate() === day;

                  return (
                    <div
                      key={day}
                      className={`day-cell ${hasEvent ? 'has-event' : ''} ${isToday ? 'is-today' : ''}`}
                      onClick={() => hasEvent && setSelectedDayEvents({ day, month, dayEvents })}
                      style={hasEvent ? {
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'stretch', justifyContent: 'flex-start', padding: 0,
                      } : {}}
                    >
                      {hasEvent ? (
                        <>
                          <div style={{
                            flexShrink: 0, padding: '2px 4px 1px',
                            fontSize: '0.6rem', fontWeight: 'bold', lineHeight: 1,
                            color: 'white', background: 'rgba(0,0,0,0.6)',
                          }}>
                            {day}
                          </div>
                          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                            {renderDayEvents(dayEvents, setSelectedEvent)}
                          </div>
                        </>
                      ) : day}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Event List Section */}
      {(() => {
        const filtered = events
          .filter(e => {
            if (selectedMonth === 'all') return true;
            if (!e.date) return false;
            return new Date(e.date).getMonth() === Number(selectedMonth);
          })
          .sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA.getMonth() !== dateB.getMonth()) return dateA.getMonth() - dateB.getMonth();
            return dateA.getDate() - dateB.getDate();
          });

        return (
          <div className="glass-panel" style={{ marginTop: '48px', padding: '28px' }}>
            <div className="section-heading">
              <h2 className="text-gradient">
                {selectedMonth === 'all' ? 'All Events' : `${MONTHS[selectedMonth]} Events`}
              </h2>
              <span className="badge-count">{filtered.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
              {filtered.map(evt => (
                <div key={evt.id} className="event-card" onClick={() => setSelectedEvent(evt)}>
                  {evt.photo ? (
                    <img src={evt.photo} alt={evt.name} style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${evt.type === 'birthday' ? '#ef4444' : '#6b7280'}` }} />
                  ) : (
                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0, background: evt.type === 'birthday' ? 'rgba(239,68,68,0.2)' : 'rgba(107,114,128,0.2)', border: `2px solid ${evt.type === 'birthday' ? '#ef4444' : '#6b7280'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700 }}>
                      {evt.name.charAt(0)}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{evt.name}</h4>
                    <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {evt.type === 'birthday' ? '🎂' : '💍'}
                      {new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      <span style={{ textTransform: 'capitalize' }}>• {evt.type}</span>
                    </p>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '24px 0' }}>
                  No events yet — click “Add Date” to create your first one.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      <AnimatePresence>
        {isAddModalOpen && (
          <AddDateModal
            familyId={userProfile?.familyId}
            uid={currentUser?.uid}
            username={userProfile?.username}
            onClose={() => setIsAddModalOpen(false)}
            onAdded={() => setIsAddModalOpen(false)}
          />
        )}
        {selectedDayEvents && !selectedEvent && (
          <DayEventsModal
            day={selectedDayEvents.day}
            month={selectedDayEvents.month}
            dayEvents={selectedDayEvents.dayEvents}
            onClose={() => setSelectedDayEvents(null)}
            onSelectEvent={(evt) => setSelectedEvent(evt)}
          />
        )}
        {selectedEvent && (
          <EventDetailsModal
            event={selectedEvent}
            canEdit={canEdit}
            onClose={() => setSelectedEvent(null)}
            onDelete={async () => {
              await removeEvent(userProfile.familyId, selectedEvent.id, selectedEvent.name, currentUser.uid, userProfile.username);
              setSelectedEvent(null);
              setSelectedDayEvents(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DayEventsModal({ day, month, dayEvents, onClose, onSelectEvent }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="glass-panel modal-content"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--accent-cyan)', margin: 0 }}>
            {MONTHS[month]} {day}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X />
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
          {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''} on this day
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {dayEvents.map(evt => (
            <div
              key={evt.id}
              onClick={() => onSelectEvent(evt)}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: '12px',
                border: `1px solid ${evt.type === 'birthday' ? 'rgba(239,68,68,0.4)' : 'rgba(107,114,128,0.4)'}`,
                cursor: 'pointer', transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            >
              {evt.photo ? (
                <img src={evt.photo} alt={evt.name} style={{
                  width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                  border: `2px solid ${evt.type === 'birthday' ? '#ef4444' : '#6b7280'}`,
                }} />
              ) : (
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
                  background: evt.type === 'birthday' ? 'rgba(239,68,68,0.25)' : 'rgba(107,114,128,0.25)',
                  border: `2px solid ${evt.type === 'birthday' ? '#ef4444' : '#6b7280'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 'bold',
                }}>
                  {evt.name.charAt(0)}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '1.05rem', marginBottom: '4px' }}>{evt.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {evt.type === 'birthday'
                    ? <CalendarIcon size={14} color="var(--accent-cyan)" />
                    : <Heart size={14} color="var(--accent-violet)" />}
                  <span style={{ textTransform: 'capitalize' }}>{evt.type}</span>
                </div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>View →</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function AddDateModal({ familyId, uid, username, onClose, onAdded }) {
  const [formData, setFormData] = useState({ name: '', type: 'birthday', date: '', photo: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFormData(f => ({ ...f, photo: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const photo = formData.photo ? await compressImage(formData.photo) : null;
      await addEvent(familyId, { ...formData, photo }, uid, username);
      onAdded();
    } catch (err) {
      console.error('Failed to save event:', err);
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass-panel modal-content"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ color: 'var(--accent-cyan)' }}>Add Special Date</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Name</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Person's name" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Occasion Type</label>
            <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="birthday">Birthday</option>
              <option value="anniversary">Anniversary</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Date</label>
            <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Photo</label>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} />
          </div>
          {error && (
            <div style={{ color: '#ff4d4d', fontSize: '0.85rem', padding: '10px 14px', background: 'rgba(255,77,77,0.1)', borderRadius: '8px', border: '1px solid rgba(255,77,77,0.3)' }}>
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: '16px', justifyContent: 'center', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save Event'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function EventDetailsModal({ event, onClose, onDelete, canEdit }) {
  const dateStr = new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const emoji   = event.type === 'birthday' ? '🎂' : '💍';
  const waText  = encodeURIComponent(`${emoji} Reminder: ${event.name}'s ${event.type} is on ${dateStr}! 🎉`);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="glass-panel modal-content"
        style={{ textAlign: 'center' }}
      >
        {event.photo ? (
          <img src={event.photo} alt={event.name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 20px', border: `4px solid ${event.type === 'birthday' ? '#ef4444' : '#6b7280'}` }} />
        ) : (
          <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'var(--bg-card)', border: `4px solid ${event.type === 'birthday' ? '#ef4444' : '#6b7280'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '2rem' }}>
            {event.name.charAt(0)}
          </div>
        )}
        <h2 style={{ fontSize: '2rem', marginBottom: '8px' }} className="text-gradient">{event.name}</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '16px', fontSize: '1.2rem' }}>
          {event.type === 'birthday' ? <CalendarIcon size={20} color="var(--accent-cyan)" /> : <Heart size={20} color="var(--accent-violet)" />}
          <span style={{ textTransform: 'capitalize' }}>{event.type}</span>
        </div>
        <p style={{ fontSize: '1.2rem', marginBottom: '24px' }}>{dateStr}</p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-outline" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Close</button>
          {/* WhatsApp share */}
          <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer"
            className="btn-outline"
            style={{ flex: 1, justifyContent: 'center', color: '#25D366', borderColor: '#25D366', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '10px 16px', borderRadius: '8px' }}>
            <MessageCircle size={18} /> WhatsApp
          </a>
          {canEdit && (
            <button className="btn-outline" onClick={onDelete}
              style={{ flex: 1, justifyContent: 'center', color: '#ff4d4d', borderColor: '#ff4d4d' }}>
              <Trash2 size={18} /> Delete
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
