// Vercel serverless function — "Contact us" form delivery.
// Sends the message to the Rojit Enterprise inbox using the same Gmail
// credentials as the reminder mailer; Reply-To is set to the sender's
// address so replying in Gmail goes straight back to them.

import nodemailer from 'nodemailer';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subject = '', description = '', fromEmail = '', website = '' } = req.body || {};

  // Honeypot field: real users never fill it
  if (website) return res.status(200).json({ ok: true });

  const sub = String(subject).trim().slice(0, 150);
  const desc = String(description).trim().slice(0, 4000);
  const from = String(fromEmail).trim().slice(0, 200);

  if (!sub || !desc) return res.status(400).json({ error: 'Subject and description are required' });
  if (!EMAIL_RE.test(from)) return res.status(400).json({ error: 'Please enter a valid email address' });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: `"KinBloom Contact" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: from,
      subject: `📮 KinBloom contact: ${sub}`,
      text: `From: ${from}\n\n${desc}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;
                    background:#0e0c09;color:#f5f1ea;border-radius:16px">
          <h2 style="margin:0 0 4px;color:#e6b34f">📮 New contact message</h2>
          <p style="color:#a89f93;margin:0 0 16px">via the KinBloom contact form</p>
          <p style="margin:6px 0"><strong style="color:#e6b34f">From:</strong> ${from}</p>
          <p style="margin:6px 0"><strong style="color:#e6b34f">Subject:</strong> ${sub}</p>
          <div style="margin-top:14px;padding:14px;background:rgba(255,255,255,0.06);
                      border-radius:10px;white-space:pre-wrap">${desc
                        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>`,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contact send failed:', err);
    return res.status(500).json({ error: 'Could not send your message. Please try again.' });
  }
}
