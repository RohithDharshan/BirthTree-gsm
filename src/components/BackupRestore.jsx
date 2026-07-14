import React, { useState, useRef } from 'react';
import { Download, Upload, Check } from 'lucide-react';
import { exportFamilyData, importFamilyData } from '../firebase/db';
import { useAuth } from '../contexts/AuthContext';

export default function BackupRestore() {
  const { userProfile, currentUser } = useAuth();
  const [exporting,  setExporting]  = useState(false);
  const [restoring,  setRestoring]  = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const fileRef = useRef();

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportFamilyData(userProfile.familyId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), {
        href: url,
        download: `kinbloom-backup-${new Date().toISOString().split('T')[0]}.json`,
      }).click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    let backup;
    try { backup = JSON.parse(await file.text()); }
    catch { alert('Could not read file — make sure it is a KinBloom .json backup.'); return; }

    if (!backup.version || !backup.events || !backup.tree) {
      alert('Invalid backup file.'); return;
    }

    const date = new Date(backup.exportDate).toLocaleString();
    if (!window.confirm(
      `Restore backup from ${date}?\n\n` +
      `This will REPLACE all current events and tree data.\n` +
      `This cannot be undone — download a fresh backup first if needed.`
    )) return;

    setRestoring(true);
    try {
      await importFamilyData(userProfile.familyId, backup, currentUser.uid, userProfile.username);
      alert('✅ Backup restored successfully!');
    } catch (err) {
      alert('Restore failed: ' + err.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: '6px' }}>
        💾 Local Backup
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '10px', lineHeight: 1.5 }}>
        Download all events &amp; tree data as a JSON file.<br />
        Upload it later to fully restore everything.
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={handleExport} disabled={exporting} className="btn-outline"
          style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {exportDone ? <><Check size={13} color="#22c55e" /> Downloaded!</>
            : exporting ? 'Exporting…'
            : <><Download size={13} /> Download Backup</>}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={restoring} className="btn-outline"
          style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#f59e0b', color: '#f59e0b' }}>
          <Upload size={13} /> {restoring ? 'Restoring…' : 'Restore Backup'}
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
