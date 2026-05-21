// Free reminders — no backend, no paid service.
// 1. Browser notifications  — OS popup when app is open
// 2. WhatsApp via CallMeBot — real WhatsApp message, completely free
//    Setup: save +34 644 597 418 in WhatsApp → send "I allow callmebot to send me messages"
//    → receive your API key → paste it in Settings inside the app.

const STORAGE_KEY    = 'bt_notified_date';
const WA_SENT_KEY    = 'bt_wa_sent_date';

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

// ─── WhatsApp via CallMeBot ───────────────────────────────────────────────────
export const sendWhatsAppReminder = async (events, userProfile) => {
  if (!userProfile?.phone || !userProfile?.callmebotKey) return;

  const today = new Date().toDateString();
  if (localStorage.getItem(WA_SENT_KEY) === today) return; // already sent today

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const soon = events.filter(e => e.date && daysUntil(e) <= 1);
  if (!soon.length) return;

  const lines = soon.map(evt => {
    const when = daysUntil(evt) === 0 ? 'TODAY 🎉' : 'TOMORROW';
    return `${evt.type === 'birthday' ? '🎂' : '💍'} ${evt.name}'s ${evt.type} is ${when}`;
  });
  const text = `🌳 *BirthTree Reminder*\n${lines.join('\n')}`;

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(userProfile.phone)}&text=${encodeURIComponent(text)}&apikey=${userProfile.callmebotKey}`;

  try {
    await fetch(url, { mode: 'no-cors' });
    localStorage.setItem(WA_SENT_KEY, today);
    console.log('WhatsApp reminder sent via CallMeBot');
  } catch (err) {
    console.warn('WhatsApp reminder failed:', err);
  }
};

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
