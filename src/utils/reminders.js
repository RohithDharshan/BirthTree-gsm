// Free reminders — no backend, no paid service.
// 1. Browser notifications  — OS popup when app is open
// 2. Telegram Bot API       — 100% free, highly stable message delivery to your Telegram chat
// 3. ntfy.sh Push           — 100% free, instant native mobile push notifications, zero signups
// 4. WhatsApp (CallMeBot)   — free personal WhatsApp messages via api.callmebot.com
// 5. Email (ntfy gateway)   — free email delivery through ntfy.sh's Email header

const STORAGE_KEY    = 'bt_notified_date';
const TG_SENT_KEY    = 'bt_tg_sent_date';
const NTFY_SENT_KEY  = 'bt_ntfy_sent_date';
const WA_SENT_KEY    = 'bt_wa_sent_date';
const EMAIL_SENT_KEY = 'bt_email_sent_date';

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
    'Title': 'BirthTree Reminder',
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

// Send WhatsApp message via CallMeBot (free personal API)
// Setup: user adds +34 644 66 32 62 to contacts, sends "I allow callmebot to send me messages"
// on WhatsApp, and receives their personal apikey back.
export const sendWhatsAppNotification = async (text, phone, apikey) => {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
  // CallMeBot has no CORS headers — fire-and-forget with no-cors.
  // We can't read the response, but delivery works if credentials are valid.
  await fetch(url, { method: 'GET', mode: 'no-cors' });
};

// Send Email via ntfy.sh's email gateway (free, ~limited per day — fine for reminders)
export const sendEmailNotification = async (text, email, topic) => {
  const response = await fetch(`https://ntfy.sh/${topic || 'birthtree-email-relay'}`, {
    method: 'POST',
    headers: {
      'Title': 'BirthTree Reminder',
      'Email': email,
      'Tags': 'birthday',
    },
    body: text,
  });
  if (!response.ok) {
    throw new Error(`Email relay error: ${response.statusText}`);
  }
};

// ─── Test Senders ──────────────────────────────────────────────────────────

export const testTelegramNotification = async (botToken, chatId) => {
  const text = `🌳 <b>BirthTree Connected!</b>\n\nThis is a test notification confirming your Telegram Bot reminders are set up correctly. 🎉`;
  return sendTelegramNotification(text, botToken, chatId);
};

export const testNtfyNotification = async (topic) => {
  const text = `🌳 BirthTree Connected!\n\nThis is a test notification confirming your ntfy.sh push notifications are set up correctly. 🎉`;
  const mockEvent = [{ type: 'birthday' }];
  return sendNtfyNotification(text, topic, mockEvent);
};

export const testWhatsAppNotification = async (phone, apikey) => {
  const text = `🌳 BirthTree Connected! This is a test message confirming your WhatsApp reminders are set up correctly. 🎉`;
  return sendWhatsAppNotification(text, phone, apikey);
};

export const testEmailNotification = async (email, topic) => {
  const text = `🌳 BirthTree Connected!\n\nThis is a test email confirming your email reminders are set up correctly. 🎉`;
  return sendEmailNotification(text, email, topic);
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
      const text = `🌳 <b>BirthTree Reminder</b>\n${lines.join('\n')}`;
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
      const text = `🌳 BirthTree Reminder\n${lines.join('\n')}`;
      try {
        await sendNtfyNotification(text, userProfile.ntfyTopic, soon);
        localStorage.setItem(NTFY_SENT_KEY, today);
        console.log('ntfy.sh reminder sent successfully');
      } catch (err) {
        console.warn('ntfy.sh reminder failed:', err);
      }
    }
  }

  // Plain-text message shared by WhatsApp + Email channels
  const plainLines = soon.map(evt => {
    const when = daysUntil(evt) === 0 ? 'TODAY 🎉' : 'TOMORROW';
    const typeEmoji = evt.type === 'birthday' ? '🎂' : '💍';
    return `${typeEmoji} ${evt.name}'s ${evt.type} is ${when}`;
  });
  const plainText = `🌳 BirthTree Reminder\n${plainLines.join('\n')}`;

  // 3. WhatsApp via CallMeBot
  if (userProfile?.phone && userProfile?.callmebotKey) {
    if (localStorage.getItem(WA_SENT_KEY) !== today) {
      try {
        await sendWhatsAppNotification(plainText, userProfile.phone, userProfile.callmebotKey);
        localStorage.setItem(WA_SENT_KEY, today);
        console.log('WhatsApp reminder sent');
      } catch (err) {
        console.warn('WhatsApp reminder failed:', err);
      }
    }
  }

  // 4. Email via ntfy gateway
  if (userProfile?.notifyEmail) {
    if (localStorage.getItem(EMAIL_SENT_KEY) !== today) {
      try {
        await sendEmailNotification(plainText, userProfile.notifyEmail, userProfile.ntfyTopic);
        localStorage.setItem(EMAIL_SENT_KEY, today);
        console.log('Email reminder sent');
      } catch (err) {
        console.warn('Email reminder failed:', err);
      }
    }
  }
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
    new Notification(`${emoji} BirthTree Reminder`, {
      body: `${evt.name}'s ${evt.type} ${when}`,
      icon: '/favicon.ico',
      tag:  `bt-${evt.id}`,    // prevents duplicate toasts for same event
    });
  });
};
