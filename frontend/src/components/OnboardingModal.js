import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Search, Layers, AlertTriangle, FileQuestion, Quote, Pen, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  {
    icon: Search,
    color: '#F97316',
    title: 'Search with epistemic depth',
    body: 'Type any question into the search bar. Quarry searches the live web, cross-references multiple sources, and shows you not just what sources say — but where they agree, disagree, and what is missing.',
    tip: 'Try: "IMF climate finance pledges vs actual disbursements"',
  },
  {
    icon: Layers,
    color: '#3b82f6',
    title: 'Read the source intelligence panel',
    body: 'On the left side of every result you\'ll see a Source Map — a credibility × lean grid showing where each source sits. Tier 1 sources are high-credibility. State-backed sources are flagged red.',
    tip: 'Click any source card to open its full dossier.',
  },
  {
    icon: AlertTriangle,
    color: '#ef4444',
    title: 'Spot contradictions instantly',
    body: 'The Contradictions tab shows you genuine factual conflicts between sources — not just differences in framing. Every contradiction is severity-rated: High / Medium / Low.',
    tip: 'Red dots on the tab mean contradictions were found.',
  },
  {
    icon: FileQuestion,
    color: '#8b5cf6',
    title: 'Find what\'s missing with Gaps',
    body: 'The Gaps tab identifies questions that aren\'t answered by any of the sources retrieved — helping you know what to look for next.',
    tip: 'Use gaps as follow-up search queries.',
  },
  {
    icon: Quote,
    color: '#10b981',
    title: 'Build a quote bank',
    body: 'The Quotes tab extracts verbatim quotes attributed to named sources. Click "Insert" to drop any quote directly into your notes workspace.',
    tip: 'Great for quickly building sourced notes.',
  },
  {
    icon: Pen,
    color: '#F97316',
    title: 'Work in Notes with your sources',
    body: 'Use the Notes page to draft your analysis. Sources you\'ve gathered automatically appear in your sidebar. Insert claims and quotes with one click.',
    tip: 'Click "Notes" in the nav bar to get started.',
  },
];

export default function OnboardingModal({ onDone }) {
  const [step, setStep] = useState(0);
  const { updateProfile } = useAuth();
  const navigate = useNavigate();

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const handleNext = async () => {
    if (isLast) {
      // Mark user as onboarded
      await updateProfile({ onboarded: true });
      if (onDone) onDone();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = async () => {
    await updateProfile({ onboarded: true });
    if (onDone) onDone();
  };

  const handleSetupProfile = async () => {
    await updateProfile({ onboarded: true });
    if (onDone) onDone();
    navigate('/profile');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(6px)',
      zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        boxShadow: '0 28px 72px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Skip button */}
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--fg-dim)', display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-family)', fontSize: '0.75rem',
          }}
        >
          <X size={13} /> Skip tour
        </button>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--border)', width: '100%' }}>
          <div style={{
            height: '100%',
            background: 'var(--accent)',
            width: `${((step + 1) / STEPS.length) * 100}%`,
            transition: 'width 0.3s ease',
            borderRadius: '0 999px 999px 0',
          }} />
        </div>

        <div style={{ padding: '36px 36px 28px' }}>
          {/* Step indicator */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
            color: 'var(--fg-dim)', letterSpacing: '0.1em',
            textTransform: 'uppercase', marginBottom: 20,
          }}>
            Step {step + 1} of {STEPS.length}
          </div>

          {/* Icon */}
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: `${current.color}18`,
            border: `1.5px solid ${current.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <Icon size={22} color={current.color} />
          </div>

          {/* Title */}
          <Typography sx={{
            fontFamily: 'var(--font-serif)', fontSize: '1.35rem', fontWeight: 600,
            color: 'var(--fg-primary)', lineHeight: 1.3, mb: 1.5,
          }}>
            {current.title}
          </Typography>

          {/* Body */}
          <Typography sx={{
            fontFamily: 'var(--font-family)', fontSize: '0.9rem', fontWeight: 300,
            color: 'var(--fg-secondary)', lineHeight: 1.75, mb: 2.5,
          }}>
            {current.body}
          </Typography>

          {/* Tip */}
          <div style={{
            background: 'rgba(249,115,22,0.07)',
            border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: 10, padding: '10px 14px',
            fontFamily: 'var(--font-family)', fontSize: '0.78rem',
            color: 'var(--fg-secondary)', lineHeight: 1.55,
          }}>
            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Tip: </span>
            {current.tip}
          </div>

          {/* Step dots */}
          <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center', mt: 3 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 18 : 6,
                height: 6, borderRadius: 999,
                background: i === step ? 'var(--accent)' : 'var(--border)',
                transition: 'all 0.25s',
              }} />
            ))}
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1.5, mt: 3, justifyContent: 'flex-end', alignItems: 'center' }}>
            {isLast && (
              <button
                onClick={handleSetupProfile}
                style={{
                  padding: '10px 18px', borderRadius: 12, cursor: 'pointer',
                  background: 'var(--gbtn-bg)', border: '1px solid var(--border)',
                  fontFamily: 'var(--font-family)', fontSize: '0.85rem',
                  color: 'var(--fg-secondary)', fontWeight: 500,
                }}
              >
                Set up my profile →
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 22px', borderRadius: 12, cursor: 'pointer',
                background: 'var(--accent)', border: 'none', color: '#fff',
                fontFamily: 'var(--font-family)', fontSize: '0.87rem', fontWeight: 600,
              }}
            >
              {isLast ? "Let's explore!" : 'Next'} <ChevronRight size={15} />
            </button>
          </Box>
        </div>
      </div>
    </div>
  );
}
