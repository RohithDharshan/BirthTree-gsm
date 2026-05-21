import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { subscribeToAccessLog } from '../firebase/db';
import { useAuth } from '../contexts/AuthContext';

const ICONS = {
  created_family: '🏠',
  joined_family:  '👋',
  added_member:   '➕',
  added_event:    '🎂',
  deleted_event:  '🗑️',
  updated_tree:   '🌳',
};

export default function AccessLog() {
  const { userProfile } = useAuth();
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!userProfile?.familyId) return;
    return subscribeToAccessLog(userProfile.familyId, setLogs);
  }, [userProfile?.familyId]);

  return (
    <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {logs.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No activity yet.</p>
      )}
      {logs.map(log => (
        <motion.div key={log.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
            borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{ICONS[log.action] || '•'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>{log.username}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '0.85rem' }}>{log.details}</span>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
            {log.timestamp?.toDate
              ? log.timestamp.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
