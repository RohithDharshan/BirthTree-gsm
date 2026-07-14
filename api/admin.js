// Vercel serverless function — super-admin dashboard API.
// Auth: caller sends their Firebase ID token; we verify it server-side and
// require the account's username to be in ADMIN_USERNAMES. Uses the same
// FIREBASE_SERVICE_ACCOUNT env var as /api/send-reminders.

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const ADMIN_USERNAMES = ['rojitadmin'];

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = getFirestore();
const adminAuth = getAuth();

const iso = (ts) => ts?.toDate?.()?.toISOString?.() || null;

export default async function handler(req, res) {
  try {
    const idToken = (req.headers.authorization || '').replace('Bearer ', '');
    if (!idToken) return res.status(401).json({ error: 'Missing auth token' });

    const decoded = await adminAuth.verifyIdToken(idToken);
    const callerDoc = await db.collection('users').doc(decoded.uid).get();
    const callerName = (callerDoc.data()?.username || '').toLowerCase();
    if (!ADMIN_USERNAMES.includes(callerName)) {
      return res.status(403).json({ error: 'Not an admin account' });
    }

    // ── GET: full analytics snapshot ─────────────────────────────────────
    if (req.method === 'GET') {
      const [usersSnap, familiesSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('families').get(),
      ]);

      const users = usersSnap.docs.map(d => {
        const u = d.data();
        return {
          uid: d.id,
          username: u.username || '(unknown)',
          familyId: u.familyId || null,
          email: u.notifyEmail || null,
          emailOptIn: !!u.emailOptIn,
          telegram: !!u.telegramBotToken,
          push: !!u.ntfyTopic,
          createdAt: iso(u.createdAt),
        };
      });

      let totalEvents = 0;
      let totalActivity = 0;
      const families = [];
      const recent = [];

      for (const f of familiesSnap.docs) {
        const data = f.data();
        const [evCount, logCount, logSnap] = await Promise.all([
          f.ref.collection('events').count().get(),
          f.ref.collection('accessLog').count().get(),
          f.ref.collection('accessLog').orderBy('timestamp', 'desc').limit(6).get(),
        ]);
        const events = evCount.data().count;
        const activity = logCount.data().count;
        totalEvents += events;
        totalActivity += activity;
        families.push({
          id: f.id,
          name: data.name || '(unnamed)',
          members: (data.memberUids || []).length,
          events,
          activity,
          locked: !!data.locked,
          createdAt: iso(data.createdAt),
        });
        logSnap.docs.forEach(l => {
          const log = l.data();
          recent.push({
            family: data.name || f.id,
            username: log.username,
            action: log.action,
            details: log.details,
            ts: iso(log.timestamp),
          });
        });
      }

      recent.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));

      return res.status(200).json({
        totals: {
          users: users.length,
          families: families.length,
          events: totalEvents,
          activity: totalActivity,
          emailOptIns: users.filter(u => u.emailOptIn && u.email).length,
        },
        users,
        families,
        recent: recent.slice(0, 25),
      });
    }

    // ── POST: management actions ─────────────────────────────────────────
    if (req.method === 'POST') {
      const { action, uid } = req.body || {};

      if (action === 'deleteUser' && uid) {
        const uDoc = await db.collection('users').doc(uid).get();
        const uname = (uDoc.data()?.username || '').toLowerCase();
        if (ADMIN_USERNAMES.includes(uname)) {
          return res.status(400).json({ error: 'Cannot delete an admin account' });
        }
        await adminAuth.deleteUser(uid).catch(() => {});      // auth account
        await db.collection('users').doc(uid).delete();       // profile
        if (uname) await db.collection('usernames').doc(uname).delete().catch(() => {});
        return res.status(200).json({ ok: true });
      }

      if (action === 'detachUser' && uid) {
        await db.collection('users').doc(uid).set({ familyId: null }, { merge: true });
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin api error:', err);
    return res.status(500).json({ error: err.message });
  }
}
