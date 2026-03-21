import React from 'react';

/* ─── Key events for each month of 2026 ───────────────────────────────────── */
const MONTHS_2026 = [
  {
    month: 'January',
    short: 'JAN',
    events: [
      { date: 'Jan 1',     label: 'New Year\'s Day' },
      { date: 'Jan 12',    label: 'Golden Globe Awards' },
      { date: 'Jan 19',    label: 'Australian Open begins' },
      { date: 'Jan 20',    label: 'MLK Day (US)' },
      { date: 'Jan 21–25', label: 'Davos WEF Summit' },
    ],
  },
  {
    month: 'February',
    short: 'FEB',
    events: [
      { date: 'Feb 1',     label: 'Super Bowl LX' },
      { date: 'Feb 6–22',  label: 'Winter Olympics — Milan-Cortina' },
      { date: 'Feb 14',    label: 'Valentine\'s Day' },
      { date: 'Feb 16',    label: 'Grammy Awards' },
      { date: 'Feb 17',    label: 'Presidents\' Day (US)' },
    ],
  },
  {
    month: 'March',
    short: 'MAR',
    events: [
      { date: 'Mar 1',     label: 'Academy Awards (Oscars)' },
      { date: 'Mar 8',     label: 'International Women\'s Day' },
      { date: 'Mar 15',    label: 'F1 Season Opener' },
      { date: 'Mar 17',    label: 'St. Patrick\'s Day' },
      { date: 'Mar 20',    label: 'Spring Equinox' },
    ],
  },
  {
    month: 'April',
    short: 'APR',
    events: [
      { date: 'Apr 2–6',   label: 'Masters Golf Tournament' },
      { date: 'Apr 5',     label: 'Easter Sunday' },
      { date: 'Apr 14',    label: 'Tax Day (US)' },
      { date: 'Apr 22',    label: 'Earth Day' },
      { date: 'Apr 23–25', label: 'NFL Draft' },
    ],
  },
  {
    month: 'May',
    short: 'MAY',
    events: [
      { date: 'May 4',     label: 'Star Wars Day' },
      { date: 'May 14',    label: 'Eurovision Song Contest Final' },
      { date: 'May 14',    label: 'Cannes Film Festival opens' },
      { date: 'May 25',    label: 'Indianapolis 500' },
      { date: 'May 31',    label: 'French Open begins' },
    ],
  },
  {
    month: 'June',
    short: 'JUN',
    events: [
      { date: 'Jun 7',     label: 'French Open Final' },
      { date: 'Jun 11',    label: 'FIFA World Cup 2026 kicks off' },
      { date: 'Jun 21',    label: 'Summer Solstice' },
      { date: 'Jun 22',    label: 'Wimbledon begins' },
      { date: 'Jun',       label: 'NBA Finals' },
    ],
  },
  {
    month: 'July',
    short: 'JUL',
    events: [
      { date: 'Jul 1',     label: 'Tour de France begins' },
      { date: 'Jul 4',     label: 'US Independence Day' },
      { date: 'Jul 6',     label: 'Wimbledon Final' },
      { date: 'Jul 19',    label: 'FIFA World Cup Final' },
      { date: 'Jul',       label: 'ESPY Awards' },
    ],
  },
  {
    month: 'August',
    short: 'AUG',
    events: [
      { date: 'Aug 6',     label: 'Hiroshima Memorial Day' },
      { date: 'Aug 13–16', label: 'PGA Championship' },
      { date: 'Aug 22',    label: 'US Open Golf begins' },
      { date: 'Aug 25',    label: 'Notting Hill Carnival' },
      { date: 'Aug',       label: 'Gamescom — Cologne' },
    ],
  },
  {
    month: 'September',
    short: 'SEP',
    events: [
      { date: 'Sep 7',     label: 'NFL Season Opener' },
      { date: 'Sep 8',     label: 'US Open Tennis begins' },
      { date: 'Sep 16',    label: 'Mexican Independence Day' },
      { date: 'Sep 19',    label: 'Emmy Awards' },
      { date: 'Sep 22',    label: 'Autumn Equinox' },
    ],
  },
  {
    month: 'October',
    short: 'OCT',
    events: [
      { date: 'Oct',       label: 'MLB Playoffs begin' },
      { date: 'Oct 5',     label: 'World Teachers\' Day' },
      { date: 'Oct 12',    label: 'Columbus / Indigenous Peoples Day' },
      { date: 'Oct 25',    label: 'World Series' },
      { date: 'Oct 31',    label: 'Halloween' },
    ],
  },
  {
    month: 'November',
    short: 'NOV',
    events: [
      { date: 'Nov 3',     label: 'US Midterm Elections' },
      { date: 'Nov 11',    label: 'Veterans Day / Remembrance Day' },
      { date: 'Nov',       label: 'F1 Season Finale' },
      { date: 'Nov 26',    label: 'Thanksgiving (US)' },
      { date: 'Nov 27',    label: 'Black Friday' },
    ],
  },
  {
    month: 'December',
    short: 'DEC',
    events: [
      { date: 'Dec 7',     label: 'Pearl Harbor Remembrance Day' },
      { date: 'Dec 21',    label: 'Winter Solstice' },
      { date: 'Dec 25',    label: 'Christmas Day' },
      { date: 'Dec 26',    label: 'Boxing Day' },
      { date: 'Dec 31',    label: 'New Year\'s Eve' },
    ],
  },
];

/* ─── Component — compact single-line watermark ticker ─────────────────────── */
export default function MonthlyFiguresMarquee() {
  const currentMonth = new Date().getMonth(); // 0-indexed

  // Flatten all events into a single ordered list, prefixed with month short name
  const allItems = MONTHS_2026.flatMap(m =>
    m.events.map(ev => ({ month: m.short, date: ev.date, label: ev.label, isCurrent: MONTHS_2026.indexOf(m) === currentMonth }))
  );
  const items = [...allItems, ...allItems]; // duplicate for seamless loop

  return (
    <div style={{
      width:           '100%',
      overflow:        'hidden',
      position:        'relative',
      opacity:         0.30,
      maskImage:       'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
    }}>
      <div
        style={{
          display:   'flex',
          alignItems: 'center',
          width:     'max-content',
          animation: 'quarryMonthScroll 120s linear infinite',
          gap:       0,
        }}
        onMouseEnter={e => { e.currentTarget.style.animationPlayState = 'paused'; }}
        onMouseLeave={e => { e.currentTarget.style.animationPlayState = 'running'; }}
      >
        {items.map((item, idx) => (
          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{
              fontFamily:    'var(--font-mono, monospace)',
              fontSize:      '0.52rem',
              fontWeight:    600,
              letterSpacing: '0.06em',
              color:         item.isCurrent ? 'var(--accent, #f97316)' : 'var(--fg-dim, #9a8570)',
              whiteSpace:    'nowrap',
            }}>
              {item.month} {item.date}
            </span>
            <span style={{
              fontFamily:  'var(--font-family, sans-serif)',
              fontSize:    '0.52rem',
              fontWeight:  400,
              color:       'var(--fg-dim, #9a8570)',
              whiteSpace:  'nowrap',
            }}>
              {item.label}
            </span>
            <span style={{
              color:   'var(--fg-dim, #9a8570)',
              fontSize: '0.4rem',
              opacity: 0.4,
              margin:  '0 10px',
            }}>
              ◆
            </span>
          </span>
        ))}
      </div>

      <style>{`
        @keyframes quarryMonthScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
