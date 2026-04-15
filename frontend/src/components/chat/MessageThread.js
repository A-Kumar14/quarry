import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import ChainOfThought from './ChainOfThought';
import StreamingMarkdown from './StreamingMarkdown';

// ── Wave loader (replaces pulse dots) ────────────────────────────────────────
function WaveLoader({ label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 14 }}>
        {[0, 0.1, 0.2, 0.3, 0.4].map((delay, i) => (
          <Box key={i} sx={{
            width: 3,
            borderRadius: '2px',
            background: '#F97316',
            animation: 'wave 1s ease-in-out infinite',
            animationDelay: `${delay}s`,
            '@keyframes wave': {
              '0%,100%': { height: '4px', opacity: 0.35 },
              '50%':      { height: '13px', opacity: 1 },
            },
          }} />
        ))}
      </Box>
      <Typography sx={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.64rem',
        color: '#444',
        letterSpacing: '0.03em',
      }}>
        {label || 'thinking…'}
      </Typography>
    </Box>
  );
}

// ── Action buttons ────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return <ActionBtn onClick={copy}>{copied ? '✓' : '⎘ Copy'}</ActionBtn>;
}

function ActionBtn({ onClick, children, orange }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        fontSize: '0.62rem',
        color: orange ? '#F97316' : '#555',
        fontFamily: "'IBM Plex Mono', monospace",
        background: orange ? 'rgba(249,115,22,0.06)' : 'transparent',
        border: orange ? '1px solid rgba(249,115,22,0.25)' : '1px solid #1e1a14',
        borderRadius: '5px',
        px: 0.875,
        py: 0.375,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 0.4,
        '&:hover': {
          background: orange ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
        },
      }}
    >
      {children}
    </Box>
  );
}

// ── User bubble ───────────────────────────────────────────────────────────────
function UserMessage({ msg }) {
  return (
    <Box sx={{ alignSelf: 'flex-end', maxWidth: '62%' }}>
      <Box sx={{
        background: '#1a1612',
        border: '1px solid #2a2218',
        borderRadius: '12px 12px 3px 12px',
        px: 1.75,
        py: 1.25,
      }}>
        <Typography sx={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: '0.78rem',
          color: '#ccc',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}>
          {msg.content}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Assistant bubble ──────────────────────────────────────────────────────────
function AssistantMessage({ msg, onResearch, onFork }) {
  const isStreaming  = !!msg.streaming;
  const hasContent   = !!msg.content;
  const hasSteps     = msg.thinking_steps && msg.thinking_steps.length > 0;
  const activeStep   = hasSteps
    ? msg.thinking_steps.find(s => s.status === 'active')
    : null;

  return (
    <Box sx={{ maxWidth: '76%' }}>
      {/* Label */}
      <Typography sx={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.60rem',
        color: '#F97316',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        mb: 0.625,
        opacity: isStreaming ? 0.7 : 1,
        transition: 'opacity 0.3s',
      }}>
        {isStreaming ? 'Quarry · working…' : 'Quarry'}
      </Typography>

      {/* Chain of thought steps */}
      {hasSteps && (
        <ChainOfThought steps={msg.thinking_steps} />
      )}

      {/* Loading state — before any content arrives */}
      {isStreaming && !hasContent && (
        <WaveLoader label={activeStep ? activeStep.label.toLowerCase() + '…' : 'thinking…'} />
      )}

      {/* Response content */}
      {hasContent && (
        <Box sx={{
          background: '#151310',
          border: '1px solid #1e1a14',
          borderRadius: '3px 12px 12px 12px',
          px: 1.75,
          py: 1.5,
        }}>
          <StreamingMarkdown content={msg.content} messageId={msg.id} />
        </Box>
      )}

      {/* Action row */}
      {!isStreaming && hasContent && (
        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.875, flexWrap: 'wrap' }}>
          {msg.research_data && (
            <ActionBtn orange onClick={() => onResearch(msg.id)}>
              ⊞ Research
            </ActionBtn>
          )}
          <ActionBtn onClick={() => onFork(msg.id)}>⎋ Fork</ActionBtn>
          <CopyButton text={msg.content} />
        </Box>
      )}
    </Box>
  );
}

// ── Thread ────────────────────────────────────────────────────────────────────
export default function MessageThread({
  messages,
  streaming,
  activeBranchLabel,
  onResearch,
  onFork,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Branch label */}
      {activeBranchLabel && activeBranchLabel !== 'main' && (
        <Box sx={{
          px: 2.5, py: 0.875,
          borderBottom: '1px solid #1c1813',
          display: 'flex', alignItems: 'center', gap: 0.75,
          flexShrink: 0,
        }}>
          <Typography sx={{
            fontSize: '0.62rem',
            fontFamily: "'IBM Plex Mono', monospace",
            background: 'rgba(249,115,22,0.1)',
            border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: '4px',
            px: 0.75, py: 0.25,
            color: '#F97316',
          }}>
            ⎇ {activeBranchLabel}
          </Typography>
        </Box>
      )}

      {/* Empty state */}
      {messages.length === 0 && !streaming && (
        <Box sx={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 1, opacity: 0.3,
        }}>
          <Typography sx={{
            fontSize: '0.78rem', color: '#888',
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}>
            Ask anything. Quarry researches when needed.
          </Typography>
        </Box>
      )}

      {/* Message list */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {messages.map(msg => (
          <React.Fragment key={msg.id}>
            {msg.role === 'user' && <UserMessage msg={msg} />}
            {msg.role === 'assistant' && (
              <AssistantMessage msg={msg} onResearch={onResearch} onFork={onFork} />
            )}
          </React.Fragment>
        ))}
        <div ref={bottomRef} />
      </Box>
    </Box>
  );
}
