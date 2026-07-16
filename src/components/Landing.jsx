import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Bell, Send, Smartphone, Mail, ArrowRight, ChevronDown } from 'lucide-react';

const GOLD = '#e6b34f';
const ROSE = '#c96f85';

const spring = { type: 'spring', stiffness: 80, damping: 18 };
const clamp01 = v => Math.min(1, Math.max(0, v));

/* ── Mini month card: the product's calendar, miniature and alive ────────── */
function MiniMonth() {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const firstWeekday = 3; // July 2026 starts on a Wednesday
  return (
    <div className="glass-panel" style={{ padding: '22px 24px', width: 'min(360px, 88vw)' }}>
      <h3 className="month-title" style={{ marginBottom: 12 }}>July</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', paddingBottom: 4 }}>{d}</div>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`p${i}`} />)}
        {days.map(day => {
          const isToday = day === 3;
          const isBirthday = day === 15;
          const isAnniv = day === 22;
          return (
            <div key={day} style={{
              aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 7, fontSize: '0.72rem',
              color: isToday ? GOLD : isBirthday || isAnniv ? '#fff' : 'var(--text-muted)',
              fontWeight: isToday || isBirthday || isAnniv ? 700 : 400,
              background: isBirthday ? 'rgba(230,179,79,0.22)' : isAnniv ? 'rgba(201,111,133,0.22)' : 'rgba(255,255,255,0.025)',
              border: isToday ? `1.5px solid ${GOLD}` : isBirthday ? `1.5px solid ${GOLD}` : isAnniv ? `1.5px solid ${ROSE}` : '1px solid transparent',
              boxShadow: isBirthday ? '0 0 14px rgba(230,179,79,0.35)' : isAnniv ? '0 0 14px rgba(201,111,133,0.35)' : 'none',
            }}>
              {isBirthday ? '🎂' : isAnniv ? '💍' : day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Animated family tree scene: lines draw themselves on scroll ─────────── */
function TreeScene() {
  const node = (cx, cy, initial, name, color, delay) => (
    <motion.g
      initial={{ opacity: 0, scale: 0.6 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ ...spring, delay }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      <circle cx={cx} cy={cy} r="34" fill="rgba(26,22,17,0.9)" stroke={color} strokeWidth="2" />
      <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize="20" fontWeight="700" fontFamily="Fraunces, serif">{initial}</text>
      <text x={cx} y={cy + 54} textAnchor="middle" fill="#a89f93" fontSize="12" fontFamily="Outfit, sans-serif">{name}</text>
    </motion.g>
  );
  const line = (d, color, delay) => (
    <motion.path
      d={d} stroke={color} strokeWidth="2" fill="none"
      initial={{ pathLength: 0 }}
      whileInView={{ pathLength: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay }}
    />
  );
  return (
    <svg viewBox="0 0 560 400" style={{ width: 'min(560px, 92vw)', height: 'auto', overflow: 'visible' }} role="img"
      aria-label="A family tree: Amma and Appa joined by a heart, with two children linked below">
      {line('M 176 110 L 252 110', ROSE, 0.5)}
      {line('M 308 110 L 384 110', ROSE, 0.5)}
      {/* single drop from the heart, so no line crosses the parents' names */}
      {line('M 280 128 L 280 250', GOLD, 0.9)}
      {line('M 180 250 L 380 250', GOLD, 1.2)}
      {line('M 180 250 L 180 288', GOLD, 1.45)}
      {line('M 380 250 L 380 288', GOLD, 1.45)}
      {node(140, 110, 'A', 'Appa', GOLD, 0.1)}
      {node(420, 110, 'A', 'Amma', GOLD, 0.25)}
      <motion.text x="280" y="120" textAnchor="middle" fontSize="26" fill={ROSE}
        initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }} transition={{ ...spring, delay: 0.7 }}
        style={{ transformOrigin: '280px 112px', filter: 'drop-shadow(0 0 8px rgba(201,111,133,0.8))' }}>
        ♥
      </motion.text>
      {node(180, 324, 'T', 'Thangam', GOLD, 1.7)}
      {node(380, 324, 'R', 'Ravi', GOLD, 1.85)}
    </svg>
  );
}

/* ── Hero copy + CTAs (shared between animated and reduced-motion modes) ── */
function HeroContent() {
  return (
    <>
      <h1 style={{
        fontSize: 'clamp(2.6rem, 7vw, 5.4rem)', fontWeight: 600, lineHeight: 1.08,
        color: 'var(--text-main)', maxWidth: '14ch',
      }}>
        Every birthday, <span style={{ color: GOLD, fontStyle: 'italic' }}>remembered</span>.
      </h1>
      <p style={{
        marginTop: 22, fontSize: 'clamp(1rem, 1.6vw, 1.2rem)', color: '#c9c0b2',
        maxWidth: '46ch', lineHeight: 1.7,
      }}>
        One shared calendar for the whole family. Faces on the dates,
        a tree of everyone, and reminders that arrive before the day, not after.
      </p>
      <div style={{ marginTop: 36, display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/auth?mode=register" className="btn-primary" style={{ textDecoration: 'none', padding: '14px 30px', fontSize: '1rem' }}>
          Create your family <ArrowRight size={18} />
        </Link>
        <Link to="/auth" className="btn-outline" style={{ textDecoration: 'none', padding: '14px 30px', fontSize: '1rem' }}>
          Sign in
        </Link>
      </div>
    </>
  );
}

/* ── Landing page ─────────────────────────────────────────────────────────── */
export default function Landing() {
  const reduceMotion = useReducedMotion();
  const introRef = useRef(null);
  const calRef = useRef(null);

  // Scroll choreography without framer's useScroll (which fails silently in
  // some production environments). A plain scroll listener drives CSS custom
  // properties; elements read them directly, so the sequence always runs:
  //   1) name fades away slowly  2) logo zooms to full screen  3) hero rises.
  useEffect(() => {
    if (reduceMotion) return;
    const intro = introRef.current;
    const cal = calRef.current;

    const update = () => {
      if (intro) {
        const total = Math.max(1, intro.offsetHeight - window.innerHeight);
        const p = clamp01((window.scrollY - intro.offsetTop) / total);

        const word = 1 - clamp01((p - 0.02) / 0.24);            // gone by 0.26
        const zoom = clamp01((p - 0.3) / 0.45);                 // grows 0.30 → 0.75
        const scale = 1 + Math.pow(zoom, 1.5) * 13;
        const logoFade = 1 - clamp01((p - 0.58) / 0.17);        // dissolves at full zoom
        const hero = clamp01((p - 0.62) / 0.24);                // rises last

        intro.style.setProperty('--word-o', word.toFixed(3));
        intro.style.setProperty('--word-y', `${((1 - word) * 26).toFixed(1)}px`);
        intro.style.setProperty('--logo-s', scale.toFixed(3));
        intro.style.setProperty('--logo-o', logoFade.toFixed(3));
        intro.style.setProperty('--hint-o', (1 - clamp01(p / 0.08)).toFixed(3));
        intro.style.setProperty('--hero-o', hero.toFixed(3));
        intro.style.setProperty('--hero-y', `${((1 - hero) * 60).toFixed(1)}px`);
        intro.style.setProperty('--hero-pe', hero > 0.5 ? 'auto' : 'none');
      }
      if (cal) {
        const r = cal.getBoundingClientRect();
        const cp = clamp01((window.innerHeight - r.top) / (window.innerHeight + r.height));
        cal.style.setProperty('--cal-rx', `${(22 - cp * 30).toFixed(2)}deg`);
        cal.style.setProperty('--cal-y', `${(40 - cp * 80).toFixed(1)}px`);
      }
    };

    // Synchronous on purpose: rAF is paused in background/throttled tabs,
    // which is exactly how framer's useScroll died. The per-tick work here
    // is a handful of style property writes, safe to do inline.
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [reduceMotion]);

  const sectionPad = 'clamp(88px, 14vh, 160px) 24px';

  return (
    <div style={{ overflowX: 'clip' }}>
      {/* Minimal top bar */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px clamp(20px, 4vw, 44px)',
      }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)',
          padding: '6px 16px 6px 8px', borderRadius: 999, background: 'rgba(14,12,9,0.5)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        }}>
          <img src="/kinbloom-mark.png" alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} />
          <span>Kin<span style={{ color: GOLD }}>Bloom</span></span>
        </span>
        <span style={{ display: 'flex', gap: 10 }}>
          <Link to="/guide" style={{
            color: 'var(--text-main)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
            padding: '8px 18px', borderRadius: 10,
            background: 'rgba(14,12,9,0.5)', backdropFilter: 'blur(10px)',
          }}>
            How it works
          </Link>
          <Link to="/auth" style={{
            color: GOLD, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
            padding: '8px 18px', border: `1px solid rgba(230,179,79,0.4)`, borderRadius: 10,
            background: 'rgba(14,12,9,0.5)', backdropFilter: 'blur(10px)',
          }}>
            Sign in
          </Link>
        </span>
      </header>

      {/* ── Act 1: the logo, then straight through it ── */}
      <div ref={introRef} style={{ height: reduceMotion ? 'auto' : '260vh', position: 'relative' }}>
        <div style={{
          position: reduceMotion ? 'relative' : 'sticky', top: 0,
          height: '100dvh', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img src="/kinbloom-mark.png" alt="KinBloom emblem" style={{
            width: 'clamp(150px, 22vw, 220px)', height: 'clamp(150px, 22vw, 220px)',
            borderRadius: '50%', display: 'block',
            boxShadow: '0 0 70px rgba(230,179,79,0.4), 0 24px 80px rgba(0,0,0,0.5)',
            transform: reduceMotion ? 'none' : 'scale(var(--logo-s, 1))',
            opacity: reduceMotion ? 1 : 'var(--logo-o, 1)',
            willChange: 'transform, opacity',
          }} />

          <p style={{
            marginTop: 28, fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.9rem, 4.5vw, 3.2rem)', color: 'var(--text-main)', fontWeight: 500,
            textAlign: 'center',
            opacity: reduceMotion ? 1 : 'var(--word-o, 1)',
            transform: reduceMotion ? 'none' : 'translateY(var(--word-y, 0px))',
            willChange: 'opacity, transform',
          }}>
            Kin<span style={{ color: GOLD }}>Bloom</span>
            <span style={{
              display: 'block', fontFamily: 'Outfit, sans-serif', fontWeight: 400,
              fontSize: 'clamp(0.85rem, 1.4vw, 1rem)', color: '#c9c0b2', marginTop: 10,
            }}>
              Celebrate every moment. Preserve every generation.
            </span>
          </p>

          {!reduceMotion && (
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
              style={{
                position: 'absolute', bottom: 36, left: '50%', marginLeft: -13,
                color: 'var(--text-muted)', opacity: 'var(--hint-o, 1)',
              }}
            >
              <ChevronDown size={26} />
            </motion.div>
          )}

          {/* Hero rises after the logo passes by (animated mode only) */}
          {!reduceMotion && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              padding: '0 24px',
              opacity: 'var(--hero-o, 0)',
              transform: 'translateY(var(--hero-y, 60px))',
              pointerEvents: 'var(--hero-pe, none)',
              willChange: 'opacity, transform',
            }}>
              <HeroContent />
            </div>
          )}
        </div>
      </div>

      {/* Static hero for reduced-motion visitors */}
      {reduceMotion && (
        <section style={{
          padding: sectionPad, display: 'flex', flexDirection: 'column',
          alignItems: 'center', textAlign: 'center',
        }}>
          <HeroContent />
        </section>
      )}

      {/* ── Act 2: the calendar, floating in 3D ── */}
      <section ref={calRef} style={{
        padding: sectionPad, display: 'flex', flexWrap: 'wrap', gap: 'clamp(40px, 6vw, 90px)',
        alignItems: 'center', justifyContent: 'center', maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{ flex: '1 1 340px', maxWidth: 480 }}>
          <motion.h2
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }} transition={spring}
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 600, lineHeight: 1.15, color: 'var(--text-main)' }}
          >
            A whole year, on one page
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }} transition={{ ...spring, delay: 0.12 }}
            style={{ marginTop: 18, color: '#c9c0b2', lineHeight: 1.75, maxWidth: '52ch' }}
          >
            Twelve months at a glance, with the people you love sitting right on
            their dates. Add a name, a photo, and the occasion. Gold for birthdays,
            rose for anniversaries. Tap any day to see who it belongs to.
          </motion.p>
        </div>
        <div style={{ perspective: 1000 }}>
          <div style={{
            transform: reduceMotion ? 'none' : 'translateY(var(--cal-y, 0px)) rotateX(var(--cal-rx, 0deg))',
            transformStyle: 'preserve-3d', willChange: 'transform',
          }}>
            <MiniMonth />
          </div>
        </div>
      </section>

      {/* ── Act 3: the tree draws itself ── */}
      <section style={{ padding: sectionPad, textAlign: 'center', maxWidth: 900, margin: '0 auto' }}>
        <motion.h2
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={spring}
          style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 600, color: 'var(--text-main)' }}
        >
          Your family, drawn as it grows
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ ...spring, delay: 0.12 }}
          style={{ margin: '18px auto 48px', color: '#c9c0b2', lineHeight: 1.75, maxWidth: '54ch' }}
        >
          Say who someone is, a mother, a husband, a daughter, and KinBloom
          connects the generations by itself. Couples get a heart. Children hang
          from both parents. The tree rebuilds every time the family does.
        </motion.p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <TreeScene />
        </div>
      </section>

      {/* ── Act 4: reminders ── */}
      <section style={{ padding: sectionPad, maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }} transition={spring}
          style={{ display: 'inline-flex', marginBottom: 26 }}
        >
          <Bell size={34} color={GOLD} aria-hidden />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={spring}
          style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 600, color: 'var(--text-main)' }}
        >
          Reminders that find you
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ ...spring, delay: 0.12 }}
          style={{ margin: '18px auto 40px', color: '#c9c0b2', lineHeight: 1.75, maxWidth: '50ch' }}
        >
          A day early, so there is time for a call, a cake, a gift. Pick the
          channels you actually check; everyone in the family chooses their own.
        </motion.p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { icon: <Send size={16} />, label: 'Telegram' },
            { icon: <Smartphone size={16} />, label: 'Phone push' },
            { icon: <Mail size={16} />, label: 'Morning email' },
          ].map((c, i) => (
            <motion.div key={c.label}
              initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ ...spring, delay: 0.2 + i * 0.14 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 22px',
                borderRadius: 999, border: '1px solid rgba(230,179,79,0.35)',
                color: GOLD, background: 'rgba(230,179,79,0.06)', fontWeight: 600, fontSize: '0.92rem',
              }}
            >
              {c.icon} {c.label}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Final: gold-drenched close ── */}
      <section style={{
        margin: 'clamp(60px, 10vh, 120px) auto 0', padding: 'clamp(70px, 12vh, 130px) 24px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(ellipse 80% 90% at 50% 110%, rgba(230,179,79,0.22), rgba(201,111,133,0.08) 55%, transparent 80%)',
      }}>
        <motion.h2
          initial={{ opacity: 0, y: 34 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }} transition={spring}
          style={{ fontSize: 'clamp(2.4rem, 5.5vw, 4.2rem)', fontWeight: 600, color: 'var(--text-main)', maxWidth: '18ch', margin: '0 auto' }}
        >
          Start with one date.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ ...spring, delay: 0.15 }}
          style={{ margin: '18px auto 38px', color: '#c9c0b2', maxWidth: '44ch', lineHeight: 1.7 }}
        >
          Free for families. Create your group, share one code, and the
          calendar fills itself as everyone joins.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ ...spring, delay: 0.25 }}
        >
          <Link to="/auth?mode=register" className="btn-primary" style={{ textDecoration: 'none', padding: '16px 38px', fontSize: '1.05rem' }}>
            Create your family <ArrowRight size={18} />
          </Link>
        </motion.div>
        <footer style={{ marginTop: 'clamp(60px, 10vh, 110px)', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 2 }}>
          KinBloom · made for families ·{' '}
          <Link to="/guide" style={{ color: 'var(--text-muted)' }}>Step by step guide</Link> ·{' '}
          <Link to="/contact" style={{ color: 'var(--text-muted)' }}>Contact us</Link> ·{' '}
          <Link to="/auth" style={{ color: 'var(--text-muted)' }}>Sign in</Link>
          <span style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.14em', opacity: 0.75 }}>
            BY ROJIT ENTERPRISE
          </span>
        </footer>
      </section>
    </div>
  );
}
