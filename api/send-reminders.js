// Vercel serverless function — daily event-reminder emails.
//
// Runs on the cron schedule in vercel.json. For every family it finds
// events happening today or tomorrow and emails every member who saved
// an email address AND opted in (users.emailOptIn === true).
//
// Required Vercel environment variables:
//   GMAIL_USER               e.g. rojitenterprise@gmail.com
//   GMAIL_APP_PASSWORD       Gmail App Password (not the account password)
//   FIREBASE_SERVICE_ACCOUNT full JSON of a Firebase service-account key
//   CRON_SECRET              any random string; Vercel Cron sends it automatically

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = getFirestore();

const daysUntil = (dateStr) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - today) / 86400000);
};

export default async function handler(req, res) {
  // Vercel Cron authenticates with `Authorization: Bearer ${CRON_SECRET}`
  if (process.env.CRON_SECRET &&
      req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  // All opted-in users with an email + family
  const usersSnap = await db.collection('users').where('emailOptIn', '==', true).get();
  const recipients = usersSnap.docs
    .map(d => d.data())
    .filter(u => u.notifyEmail && u.familyId);

  // Group recipients by family so each family's events are read once
  const byFamily = new Map();
  recipients.forEach(u => {
    if (!byFamily.has(u.familyId)) byFamily.set(u.familyId, []);
    byFamily.get(u.familyId).push(u.notifyEmail);
  });

  let sent = 0;
  const results = [];

  for (const [familyId, emails] of byFamily) {
    const eventsSnap = await db.collection('families').doc(familyId).collection('events').get();
    const soon = eventsSnap.docs
      .map(d => d.data())
      .filter(e => e.date && daysUntil(e.date) <= 1);
    if (!soon.length) continue;

    const lines = soon.map(evt => {
      const when = daysUntil(evt.date) === 0 ? 'TODAY 🎉' : 'TOMORROW';
      const emoji = evt.type === 'birthday' ? '🎂' : '💍';
      return `${emoji} ${evt.name}'s ${evt.type} is ${when}`;
    });

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;
                  background:#0e0c09;color:#f4f7fb;border-radius:16px">
        <h2 style="margin:0 0 4px;background:linear-gradient(90deg,#e6b34f,#9257f0);
                   -webkit-background-clip:text;color:#e6b34f">🌸 KinBloom Reminder</h2>
        <p style="color:#9aa5b5;margin:0 0 16px">Upcoming special occasions in your family</p>
        ${lines.map(l => `<p style="font-size:16px;margin:8px 0;padding:10px 14px;
          background:rgba(255,255,255,0.06);border-radius:10px">${l}</p>`).join('')}
        <p style="color:#9aa5b5;font-size:12px;margin-top:20px">
          Sent by KinBloom · you opted in to email reminders.
        </p>
      </div>`;

    try {
      await transporter.sendMail({
        from: `"KinBloom" <${process.env.GMAIL_USER}>`,
        bcc: emails,
        subject: `🌸 KinBloom: ${soon.length} occasion${soon.length > 1 ? 's' : ''} coming up!`,
        text: lines.join('\n'),
        html,
      });
      sent += emails.length;
      results.push({ familyId, events: soon.length, recipients: emails.length });
    } catch (err) {
      console.error(`Family ${familyId} email failed:`, err.message);
      results.push({ familyId, error: err.message });
    }
  }

  return res.status(200).json({ ok: true, sent, results });
}
