import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Briefcase, Building2, BookOpen, Star, Tags, Layers, LogOut, ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDarkMode } from '../DarkModeContext';
import GlassCard from '../components/GlassCard';
import NavControls from '../components/NavControls';

const ROLES = ['Investigative Journalist', 'Policy Analyst', 'Academic Researcher', 'Student', 'Editor', 'Other'];
const EXPERTISE = ['Beginner', 'Intermediate', 'Expert'];
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

function Chip({ active, onClick, children }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '5px 13px', borderRadius: 999, cursor: 'pointer',
        fontFamily: 'var(--font-family)', fontSize: '0.78rem', fontWeight: active ? 500 : 400,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent)' : 'var(--bg-tertiary)',
        color: active ? '#fff' : 'var(--fg-secondary)',
        transition: 'all 0.14s',
        userSelect: 'none',
      }}
    >
      {children}
    </span>
  );
}

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const [dark] = useDarkMode();
  const navigate = useNavigate();
  const p = user?.profile || {};

  const [form, setForm] = useState({
    role:                   p.role || '',
    organization:           p.organization || '',
    beat:                   p.beat || '',
    expertise_level:        p.expertise_level || '',
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

  return (
    <div style={{
      minHeight: '100vh',
      background: dark
        ? 'linear-gradient(158deg, #0d1117 0%, #131920 50%, #1c2333 100%)'
        : 'linear-gradient(158deg, #EDE8DF 0%, #E5DDD0 40%, #DDD5C0 75%, #E8E2D5 100%)',
      backgroundAttachment: 'fixed',
    }}>

      {/* ── Topbar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 24px', height: 48,
        background: dark ? 'rgba(13,17,23,0.88)' : 'rgba(237,232,223,0.88)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 8px', borderRadius: 8,
            fontFamily: 'var(--font-family)', fontSize: '0.78rem',
            color: 'var(--fg-secondary)', transition: 'color 0.14s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--fg-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-secondary)'}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{
          fontFamily: 'var(--font-family)', fontSize: '0.88rem', fontWeight: 600,
          color: 'var(--fg-primary)', flex: 1,
        }}>
          Profile
        </span>
        <NavControls />
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Account card */}
          <GlassCard style={{ padding: '24px 28px', borderRadius: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Avatar */}
                <div style={{
                  width: 54, height: 54, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(249,115,22,0.30)',
                }}>
                  <User size={24} color="#fff" />
                </div>
                <div>
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
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '8px 14px', borderRadius: 9, cursor: 'pointer',
                  background: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.25)',
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
                    <Chip key={r} active={form.role === r} onClick={() => set('role', r)}>{r}</Chip>
                  ))}
                </div>
              </FieldGroup>

              <div style={divider} />

              {/* Organisation */}
              <FieldGroup>
                <SectionLabel icon={Building2}>Organisation</SectionLabel>
                <input
                  style={inputStyle}
                  placeholder="e.g. Reuters, Oxford University, Ministry of Finance"
                  value={form.organization}
                  onChange={e => set('organization', e.target.value)}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
              </FieldGroup>

              <div style={divider} />

              {/* Beat */}
              <FieldGroup>
                <SectionLabel icon={BookOpen}>Journalism beat / area of focus</SectionLabel>
                <input
                  style={inputStyle}
                  placeholder="e.g. Climate Policy, Defence, Health, Tech Regulation"
                  value={form.beat}
                  onChange={e => set('beat', e.target.value)}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
              </FieldGroup>

              <div style={divider} />

              {/* Expertise */}
              <FieldGroup>
                <SectionLabel icon={Star}>Expertise level</SectionLabel>
                <div style={{ display: 'flex', gap: 8 }}>
                  {EXPERTISE.map(e => (
                    <Chip key={e} active={form.expertise_level === e} onClick={() => set('expertise_level', e)}>{e}</Chip>
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
                      <span
                        key={t}
                        onClick={() => setForm(f => ({ ...f, topics_of_focus: f.topics_of_focus.filter(x => x !== t) }))}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px 5px 13px', borderRadius: 999, cursor: 'pointer',
                          background: 'var(--accent)', color: '#fff',
                          border: '1px solid var(--accent)',
                          fontFamily: 'var(--font-family)', fontSize: '0.78rem', fontWeight: 500,
                          userSelect: 'none',
                        }}
                      >
                        {t}
                        <span style={{ opacity: 0.75, fontSize: '0.85em' }}>×</span>
                      </span>
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
                    <Chip
                      key={s}
                      active={form.preferred_source_types.includes(s)}
                      onClick={() => toggleArr('preferred_source_types', s)}
                    >
                      {s}
                    </Chip>
                  ))}
                </div>
              </FieldGroup>

              {/* Save */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                <button
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
      </div>
    </div>
  );
}
