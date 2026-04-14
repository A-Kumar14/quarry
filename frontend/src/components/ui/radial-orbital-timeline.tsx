import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Link as LinkIcon, Zap, CalendarDays } from 'lucide-react';

export interface OrbitalTimelineItem {
  id: string;
  title: string;
  date: string;
  content: string;
  relatedIds: string[];
  status: 'completed' | 'in-progress' | 'pending';
  energy: number;
  sourceUrl?: string | null;
}

interface RadialOrbitalTimelineProps {
  timelineData: OrbitalTimelineItem[];
}

const STATUS_STYLE: Record<OrbitalTimelineItem['status'], { bg: string; fg: string; border: string }> = {
  completed: { bg: 'rgba(34,197,94,0.12)', fg: '#86efac', border: 'rgba(34,197,94,0.35)' },
  'in-progress': { bg: 'rgba(249,115,22,0.12)', fg: '#fdba74', border: 'rgba(249,115,22,0.35)' },
  pending: { bg: 'rgba(148,163,184,0.10)', fg: '#cbd5e1', border: 'rgba(148,163,184,0.30)' },
};

function clampEnergy(v: number): number {
  return Math.max(10, Math.min(100, Math.round(v)));
}

export default function RadialOrbitalTimeline({ timelineData }: RadialOrbitalTimelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    if (!autoRotate || timelineData.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setRotation((prev) => (prev + 0.25) % 360);
    }, 40);
    return () => window.clearInterval(timer);
  }, [autoRotate, timelineData.length]);

  const relatedSet = useMemo(() => {
    if (!activeId) return new Set<string>();
    const active = timelineData.find((t) => t.id === activeId);
    return new Set(active?.relatedIds ?? []);
  }, [activeId, timelineData]);

  const radius = 155;
  const center = { x: 190, y: 190 };

  if (!timelineData.length) return null;

  return (
    <div
      onClick={() => {
        setActiveId(null);
        setAutoRotate(true);
      }}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 410,
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'radial-gradient(circle at center, rgba(249,115,22,0.08) 0%, rgba(10,14,24,0.95) 52%, rgba(8,12,20,0.98) 100%)',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
        <CalendarDays size={12} color="var(--accent)" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--fg-dim)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
          Orbital timeline
        </span>
      </div>

      <div style={{ position: 'relative', width: '100%', height: 390 }}>
        <div
          style={{
            position: 'absolute',
            left: center.x - 18,
            top: center.y - 18,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
            boxShadow: '0 0 22px rgba(249,115,22,0.45)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: center.x - radius,
            top: center.y - radius,
            width: radius * 2,
            height: radius * 2,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.14)',
          }}
        />

        {timelineData.map((item, idx) => {
          const angle = ((idx / timelineData.length) * 360 + rotation) % 360;
          const rad = (angle * Math.PI) / 180;
          const x = center.x + radius * Math.cos(rad);
          const y = center.y + radius * Math.sin(rad);
          const isActive = item.id === activeId;
          const isRelated = !isActive && relatedSet.has(item.id);
          const glow = isActive ? '0 0 16px rgba(249,115,22,0.65)' : isRelated ? '0 0 10px rgba(255,255,255,0.35)' : 'none';

          return (
            <div
              key={item.id}
              style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', zIndex: isActive ? 40 : 20 }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveId((prev) => (prev === item.id ? null : item.id));
                setAutoRotate((prev) => (activeId === item.id ? true : false));
              }}
            >
              <div
                style={{
                  width: isActive ? 20 : 14,
                  height: isActive ? 20 : 14,
                  borderRadius: '50%',
                  border: isActive ? '2px solid #f97316' : '1.5px solid rgba(255,255,255,0.55)',
                  background: isActive ? '#fff' : isRelated ? 'rgba(255,255,255,0.7)' : 'rgba(10,14,24,0.9)',
                  cursor: 'pointer',
                  boxShadow: glow,
                  transition: 'all 0.18s ease',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 18,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontFamily: 'var(--font-family)',
                  fontSize: '0.62rem',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.75)',
                  whiteSpace: 'nowrap',
                  maxWidth: 130,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={item.title}
              >
                {item.title}
              </div>

              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 34,
                    transform: 'translateX(-50%)',
                    width: 280,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(8,12,20,0.95)',
                    boxShadow: '0 14px 40px rgba(0,0,0,0.45)',
                    padding: '10px 12px',
                    zIndex: 50,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.54rem',
                        borderRadius: 999,
                        padding: '2px 7px',
                        border: `1px solid ${STATUS_STYLE[item.status].border}`,
                        background: STATUS_STYLE[item.status].bg,
                        color: STATUS_STYLE[item.status].fg,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {item.status}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--fg-dim)' }}>{item.date}</span>
                  </div>

                  <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.74rem', fontWeight: 600, color: 'var(--fg-primary)', marginTop: 8 }}>
                    {item.title}
                  </div>
                  <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', color: 'var(--fg-secondary)', lineHeight: 1.5, marginTop: 4 }}>
                    {item.content}
                  </div>

                  <div style={{ marginTop: 8, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--fg-dim)' }}>
                        <Zap size={10} /> Energy
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--fg-dim)' }}>{clampEnergy(item.energy)}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
                      <div style={{ width: `${clampEnergy(item.energy)}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6 0%, #a855f7 100%)' }} />
                    </div>
                  </div>

                  {item.relatedIds.length > 0 && (
                    <div style={{ marginTop: 9, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: 'var(--fg-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        <LinkIcon size={9} /> Connected
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                        {item.relatedIds.map((rid) => {
                          const rel = timelineData.find((t) => t.id === rid);
                          if (!rel) return null;
                          return (
                            <button
                              key={rid}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                borderRadius: 7,
                                border: '1px solid rgba(255,255,255,0.22)',
                                background: 'transparent',
                                color: 'var(--fg-secondary)',
                                fontFamily: 'var(--font-family)',
                                fontSize: '0.63rem',
                                padding: '3px 7px',
                                cursor: 'pointer',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveId(rid);
                              }}
                            >
                              {rel.title} <ArrowRight size={9} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

