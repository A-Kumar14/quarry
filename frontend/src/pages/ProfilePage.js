import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Briefcase, Tags, Layers, LogOut, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDarkMode } from '../DarkModeContext';
import GlassCard from '../components/GlassCard';
import PageShell from '../components/PageShell';

const ROLES = ['News Researcher', 'Policy Analyst', 'Academic Researcher', 'Student', 'Independent Analyst', 'Other'];
const INTEREST_TOPICS = [
  'Climate & Environment', 'Defence & Security', 'Health & Pandemic',
  'Technology & AI', 'Trade & Economics', 'Human Rights', 'Energy & Resources',
  'Elections & Democracy', 'Migration & Refugees', 'Geopolitics',
  'Disinformation', 'Legal & Regulation', 'Education', 'Finance & Markets',
];
const SOURCE_TYPES = [
  'Academic / peer-reviewed', 'Mainstream quality news', 'Wire services (Reuters, AP, AFP)',
  'Government / official', 'NGO / think tanks', 'Alternative / independent media',
];

const LABEL = {
  display: 'flex', alignItems: 'center', gap: 5,
  fontFamily: 'var(--font-family)', fontSize: '0.68rem', fontWeight: 700,
  color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.11em',
  marginBottom: 8,
};

function SectionLabel({ icon: Icon, children }) {
  return (
    <div style={LABEL}>
      <Icon size={11} style={{ opacity: 0.7 }} />
      {children}
    </div>
  );
}

function FieldGroup({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>{children}</div>;
}

const CHIP_FONT = {
  fontFamily: 'var(--font-family)',
  fontSize: '0.78rem',
  cursor: 'pointer',
  transition: 'all 0.14s',
  userSelect: 'none',
  WebkitAppearance: 'none',
  appearance: 'none',
  margin: 0,
};

/** Single-select (role): active = filled outline — orange ring + tint, not solid pill. */
function ChipSingle({ active, onClick, children }) {
  return (
    <button
      type="button"
      className="profile-chip-single"
      aria-pressed={active}
      onClick={onClick}
      style={{
        ...CHIP_FONT,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: active ? '4px 12px' : '5px 13px',
        borderRadius: 999,
        fontWeight: active ? 600 : 400,
        border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
        background: active ? 'rgba(249, 115, 22, 0.13)' : 'var(--bg-tertiary)',
        color: active ? 'var(--accent)' : 'var(--fg-secondary)',
        boxShadow: active ? 'inset 0 0 0 1px rgba(249, 115, 22, 0.12)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

/** Multi-select: checkmark when on; dashed border when off to read as “toggle set”. */
function ChipMulti({ active, onClick, children }) {
  return (
    <button
      type="button"
      className="profile-chip-multi"
      aria-pressed={active}
      onClick={onClick}
      style={{
        ...CHIP_FONT,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 13px',
        borderRadius: 999,
        fontWeight: active ? 500 : 400,
        border: `1px ${active ? 'solid' : 'dashed'} ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'rgba(249, 115, 22, 0.09)' : 'var(--bg-tertiary)',
        color: active ? 'var(--fg-primary)' : 'var(--fg-secondary)',
      }}
    >
      {active ? <Check size={12} strokeWidth={3} aria-hidden style={{ flexShrink: 0, color: 'var(--accent)' }} /> : null}
      {children}
    </button>
  );
}

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const [dark] = useDarkMode();
  const navigate = useNavigate();
  const p = user?.profile || {};

  const [form, setForm] = useState({
    role:                   p.role || '',
    interests:              p.interests || [],
    topics_of_focus:        p.topics_of_focus || [],
    preferred_source_types: p.preferred_source_types || [],
  });
  const [topicInput, setTopicInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleArr = (k, val) => {
    setForm(f => {
      const arr = f[k] || [];
      return { ...f, [k]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
    });
  };

  const addTopic = () => {
    const t = topicInput.trim();
    if (t && !form.topics_of_focus.includes(t)) {
      setForm(f => ({ ...f, topics_of_focus: [...f.topics_of_focus, t] }));
    }
    setTopicInput('');
  };

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({ ...form, onboarded: true });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : '';

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.60)',
    border: '1px solid var(--border)',
    fontFamily: 'var(--font-family)', fontSize: '0.87rem',
    color: 'var(--fg-primary)',
    outline: 'none', transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  };

  const divider = {
    height: 1,
    background: 'var(--border)',
    margin: '4px 0',
  };

  const accountCardExtra = dark
    ? '0 0 0 1px rgba(249, 115, 22, 0.14), 0 16px 48px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
    : '0 0 0 1px rgba(249, 115, 22, 0.16), 0 14px 42px rgba(55, 44, 32, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.5)';

  return (
    <div style={{
      minHeight: '100vh',
      background: dark
        ? 'linear-gradient(158deg, #0d1117 0%, #131920 50%, #1c2333 100%)'
        : 'linear-gradient(158deg, #EDE8DF 0%, #E5DDD0 40%, #DDD5C0 75%, #E8E2D5 100%)',
      backgroundAttachment: 'fixed',
    }}>
      <style>{`
        .profile-chip-single:focus-visible,
        .profile-chip-multi:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .profile-topic-remove:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.45);
        }
        .profile-topic-remove:hover {
          filter: brightness(1.06);
        }
        .profile-topic-remove:active {
          filter: brightness(0.95);
        }
      `}</style>

      {/* ── Content ── */}
      <PageShell maxWidth={680} paddingTop={92} paddingBottom={80} paddingX={24}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Account card */}
          <GlassCard
            style={{
              padding: '26px 32px',
              borderRadius: 18,
              boxShadow: `${accountCardExtra}, var(--glass-card-shadow)`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
                {/* Avatar */}
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(145deg, #fb923c 0%, var(--accent) 55%, #ea580c 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(249,115,22,0.32), 0 0 0 2px rgba(255,255,255,0.22) inset',
                }}>
                  <User size={24} color="#fff" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-serif)', fontSize: '1.30rem', fontWeight: 600,
                    color: 'var(--fg-primary)', lineHeight: 1.2, marginBottom: 3,
                  }}>
                    {user?.username}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-family)', fontSize: '0.80rem',
                    color: 'var(--fg-secondary)', marginBottom: 2,
                  }}>
                    {user?.email}
                  </div>
                  {memberSince && (
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.64rem',
                      color: 'var(--fg-dim)', opacity: 0.8,
                    }}>
                      Member since {memberSince}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
                  background: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.28)',
                  fontFamily: 'var(--font-family)', fontSize: '0.78rem',
                  color: dark ? '#f87171' : '#dc2626', fontWeight: 500,
                  transition: 'background 0.14s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.10)'}
              >
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </GlassCard>

          {/* Research profile card */}
          <GlassCard style={{ padding: '28px 28px', borderRadius: 18 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '1.12rem', fontWeight: 600,
                color: 'var(--fg-primary)', marginBottom: 5,
              }}>
                Research Profile
              </div>
              <div style={{
                fontFamily: 'var(--font-family)', fontSize: '0.78rem',
                color: 'var(--fg-dim)', lineHeight: 1.5,
              }}>
                This profile is sent to the AI on every search to personalise results.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Role */}
              <FieldGroup>
                <SectionLabel icon={Briefcase}>Role</SectionLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {ROLES.map(r => (
                    <ChipSingle key={r} active={form.role === r} onClick={() => set('role', r)}>{r}</ChipSingle>
                  ))}
                </div>
              </FieldGroup>

              <div style={divider} />

              {/* Interests */}
              <FieldGroup>
                <SectionLabel icon={Tags}>Interests</SectionLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {INTEREST_TOPICS.map(t => (
                    <ChipMulti
                      key={t}
                      active={form.interests.includes(t)}
                      onClick={() => toggleArr('interests', t)}
                    >
                      {t}
                    </ChipMulti>
                  ))}
                </div>
              </FieldGroup>

              <div style={divider} />

              {/* Topics of focus */}
              <FieldGroup>
                <SectionLabel icon={Tags}>Topics of focus</SectionLabel>
                {form.topics_of_focus.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
                    {form.topics_of_focus.map(t => (
                      <button
                        key={t}
                        type="button"
                        className="profile-topic-remove"
                        aria-label={`Remove topic: ${t}`}
                        onClick={() => setForm(f => ({ ...f, topics_of_focus: f.topics_of_focus.filter(x => x !== t) }))}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px 5px 13px', borderRadius: 999, cursor: 'pointer',
                          background: 'var(--accent)', color: '#fff',
                          border: '1px solid var(--accent)',
                          fontFamily: 'var(--font-family)', fontSize: '0.78rem', fontWeight: 500,
                          userSelect: 'none',
                          margin: 0,
                          font: 'inherit',
                          WebkitAppearance: 'none',
                          appearance: 'none',
                          transition: 'filter 0.14s ease',
                        }}
                      >
                        <span style={{ textAlign: 'left' }}>{t}</span>
                        <span style={{ opacity: 0.85, fontSize: '0.95em', fontWeight: 600 }} aria-hidden>×</span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Add a topic and press Enter"
                    value={topicInput}
                    onChange={e => setTopicInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  />
                  <button
                    onClick={addTopic}
                    style={{
                      padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
                      background: 'var(--accent)', border: 'none', color: '#fff',
                      fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 600,
                      flexShrink: 0, whiteSpace: 'nowrap',
                    }}
                  >
                    Add
                  </button>
                </div>
              </FieldGroup>

              <div style={divider} />

              {/* Preferred source types */}
              <FieldGroup>
                <SectionLabel icon={Layers}>Preferred source types</SectionLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {SOURCE_TYPES.map(s => (
                    <ChipMulti
                      key={s}
                      active={form.preferred_source_types.includes(s)}
                      onClick={() => toggleArr('preferred_source_types', s)}
                    >
                      {s}
                    </ChipMulti>
                  ))}
                </div>
              </FieldGroup>

              {/* Save */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '11px 28px', borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer',
                    background: saved ? '#22c55e' : 'var(--accent)',
                    border: 'none', color: '#fff',
                    fontFamily: 'var(--font-family)', fontSize: '0.88rem', fontWeight: 600,
                    boxShadow: saved
                      ? '0 4px 12px rgba(34,197,94,0.28)'
                      : '0 4px 12px rgba(249,115,22,0.28)',
                    transition: 'background 0.2s, box-shadow 0.2s',
                    opacity: saving ? 0.75 : 1,
                  }}
                >
                  {saved ? <><Check size={15} /> Saved!</> : saving ? 'Saving…' : 'Save profile'}
                </button>
              </div>

            </div>
          </GlassCard>

        </div>
      </PageShell>
    </div>
  );
}
