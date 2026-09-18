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

      // One family's 3 reads were already parallel, but the families
      // THEMSELVES were fetched one at a time (a `for` loop with `await`
      // inside) — so total load time grew linearly with family count. With
      // every family (real or test) added, the dashboard got slower. Now
      // every family's reads run concurrently, so total time is bounded by
      // the single slowest family, not the sum of all of them.
      const perFamily = await Promise.all(familiesSnap.docs.map(async (f) => {
        const data = f.data();
        const [evCount, logCount, logSnap] = await Promise.all([
          f.ref.collection('events').count().get(),
          f.ref.collection('accessLog').count().get(),
          f.ref.collection('accessLog').orderBy('timestamp', 'desc').limit(6).get(),
        ]);
        const events = evCount.data().count;
        const activity = logCount.data().count;
        const recentEntries = logSnap.docs.map(l => {
          const log = l.data();
          return {
            family: data.name || f.id,
            username: log.username,
            action: log.action,
            details: log.details,
            ts: iso(log.timestamp),
          };
        });
        return {
          family: {
            id: f.id,
            name: data.name || '(unnamed)',
            members: (data.memberUids || []).length,
            events,
            activity,
            locked: !!data.locked,
            createdAt: iso(data.createdAt),
          },
          events, activity, recentEntries,
        };
      }));

      const families = perFamily.map(p => p.family);
      const totalEvents = perFamily.reduce((sum, p) => sum + p.events, 0);
      const totalActivity = perFamily.reduce((sum, p) => sum + p.activity, 0);
      const recent = perFamily.flatMap(p => p.recentEntries);

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
