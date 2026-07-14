// Free reminders — no backend, no paid service.
// 1. Browser notifications  — OS popup when app is open
// 2. Telegram Bot API       — 100% free, highly stable message delivery to your Telegram chat
// 3. ntfy.sh Push           — 100% free, instant native mobile push notifications, zero signups

// 4. Email — sent server-side by /api/send-reminders from Gmail (daily cron)

const STORAGE_KEY    = 'bt_notified_date';
const TG_SENT_KEY    = 'bt_tg_sent_date';
const NTFY_SENT_KEY  = 'bt_ntfy_sent_date';

const daysUntil = (event) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(event.date);
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - today) / 86400000);
};

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
};

// ─── Individual Notification Senders ─────────────────────────────────────────

// Send Telegram Message
export const sendTelegramNotification = async (text, botToken, chatId) => {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }
  return response.json();
};

// Send ntfy.sh Mobile Push Notification
export const sendNtfyNotification = async (text, topic, events = []) => {
  const tags = [];
  if (events.some(e => e.type === 'birthday')) tags.push('balloon');
  if (events.some(e => e.type === 'anniversary')) tags.push('ring');
  if (tags.length === 0) tags.push('calendar');

  const headers = {
    'Title': 'KinBloom Reminder',
    'Priority': 'high',
    'Tags': tags.join(',')
  };

  const response = await fetch(`https://ntfy.sh/${topic}`, {
    method: 'POST',
    headers: headers,
    body: text
  });
  if (!response.ok) {
    throw new Error(`ntfy.sh API Error: ${response.statusText}`);
  }
};

// ─── Test Senders ──────────────────────────────────────────────────────────

export const testTelegramNotification = async (botToken, chatId) => {
  const text = `🌳 <b>KinBloom Connected!</b>\n\nThis is a test notification confirming your Telegram Bot reminders are set up correctly. 🎉`;
  return sendTelegramNotification(text, botToken, chatId);
};

export const testNtfyNotification = async (topic) => {
  const text = `🌳 KinBloom Connected!\n\nThis is a test notification confirming your ntfy.sh push notifications are set up correctly. 🎉`;
  const mockEvent = [{ type: 'birthday' }];
  return sendNtfyNotification(text, topic, mockEvent);
};

// ─── Core Reminder Runner ───────────────────────────────────────────────────

export const sendExternalReminders = async (events, userProfile) => {
  const soon = events.filter(e => e.date && daysUntil(e) <= 1);
  if (!soon.length) return;

  const today = new Date().toDateString();

  // 1. Telegram Notifications
  if (userProfile?.telegramBotToken && userProfile?.telegramChatId) {
    if (localStorage.getItem(TG_SENT_KEY) !== today) {
      const lines = soon.map(evt => {
        const when = daysUntil(evt) === 0 ? '<b>TODAY</b> 🎉' : '<b>TOMORROW</b>';
        const typeEmoji = evt.type === 'birthday' ? '🎂' : '💍';
        return `${typeEmoji} <b>${evt.name}</b>'s ${evt.type} is ${when}`;
      });
      const text = `🌳 <b>KinBloom Reminder</b>\n${lines.join('\n')}`;
      try {
        await sendTelegramNotification(text, userProfile.telegramBotToken, userProfile.telegramChatId);
        localStorage.setItem(TG_SENT_KEY, today);
        console.log('Telegram reminder sent successfully');
      } catch (err) {
        console.warn('Telegram reminder failed:', err);
      }
    }
  }

  // 2. ntfy.sh Notifications
  if (userProfile?.ntfyTopic) {
    if (localStorage.getItem(NTFY_SENT_KEY) !== today) {
      const lines = soon.map(evt => {
        const when = daysUntil(evt) === 0 ? 'TODAY 🎉' : 'TOMORROW';
        const typeEmoji = evt.type === 'birthday' ? '🎂' : '💍';
        return `${typeEmoji} ${evt.name}'s ${evt.type} is ${when}`;
      });
      const text = `🌳 KinBloom Reminder\n${lines.join('\n')}`;
      try {
        await sendNtfyNotification(text, userProfile.ntfyTopic, soon);
        localStorage.setItem(NTFY_SENT_KEY, today);
        console.log('ntfy.sh reminder sent successfully');
      } catch (err) {
        console.warn('ntfy.sh reminder failed:', err);
      }
    }
  }

  // Email reminders are sent server-side by /api/send-reminders (daily
  // Vercel cron) from the configured Gmail account to all opted-in members.
};

// Backward compatibility alias for Calendar.jsx
export const sendWhatsAppReminder = sendExternalReminders;

// ─── Browser push notifications ───────────────────────────────────────────────
export const checkAndNotify = (events) => {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Only run once per calendar day
  const today = new Date().toDateString();
  if (localStorage.getItem(STORAGE_KEY) === today) return;
  localStorage.setItem(STORAGE_KEY, today);

  const soon = events.filter(e => e.date && daysUntil(e) <= 1);
  soon.forEach(evt => {
    const diff  = daysUntil(evt);
    const when  = diff === 0 ? 'is TODAY 🎉' : 'is TOMORROW';
    const emoji = evt.type === 'birthday' ? '🎂' : '💍';
    new Notification(`${emoji} KinBloom Reminder`, {
      body: `${evt.name}'s ${evt.type} ${when}`,
      icon: '/favicon.ico',
      tag:  `bt-${evt.id}`,    // prevents duplicate toasts for same event
    });
  });
};
