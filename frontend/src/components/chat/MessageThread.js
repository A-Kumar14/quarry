import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <ActionBtn onClick={copy}>{copied ? '✓' : '⎘ Copy'}</ActionBtn>
  );
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

const MD_STYLES = {
  '& p':  { fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: '0.78rem', lineHeight: 1.75, color: '#bbb', my: 0.5 },
  '& h2': { fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: '0.85rem', color: '#ddd', mt: 1.5, mb: 0.5 },
  '& h3': { fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: '0.78rem', color: '#ddd', mt: 1, mb: 0.25 },
  '& ul, & ol': { pl: 2, my: 0.5 },
  '& li': { fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: '0.78rem', color: '#bbb', lineHeight: 1.7 },
  '& strong': { color: '#ddd', fontWeight: 500 },
  '& blockquote': { borderLeft: '3px solid #F97316', pl: 1.5, ml: 0, color: '#888', fontStyle: 'italic' },
  '& code': { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', background: '#1a1713', px: '4px', py: '1px', borderRadius: '4px' },
};

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
    <Box sx={{
      flex: 1,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Branch label header */}
      {activeBranchLabel && activeBranchLabel !== 'main' && (
        <Box sx={{
          px: 2.5,
          py: 0.875,
          borderBottom: '1px solid #1c1813',
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          flexShrink: 0,
        }}>
          <Typography sx={{
            fontSize: '0.62rem',
            fontFamily: "'IBM Plex Mono', monospace",
            background: 'rgba(249,115,22,0.1)',
            border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: '4px',
            px: 0.75,
            py: 0.25,
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          opacity: 0.35,
        }}>
          <Typography sx={{
            fontSize: '0.78rem',
            color: '#888',
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}>
            Ask anything. Quarry researches when needed.
          </Typography>
        </Box>
      )}

      {/* Messages */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
        {messages.map(msg => (
          <React.Fragment key={msg.id}>
            {msg.role === 'user' && (
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
            )}

            {msg.role === 'assistant' && (
              <Box sx={{ maxWidth: '76%' }}>
                <Typography sx={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.60rem',
                  color: '#F97316',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  mb: 0.625,
                }}>
                  {msg.streaming ? 'Quarry · thinking…' : 'Quarry'}
                </Typography>

                {msg.streaming && !msg.content ? (
                  /* Searching / thinking dots */
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5 }}>
                    {[0, 0.2, 0.4].map((delay, i) => (
                      <Box key={i} sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: '#F97316',
                        animation: 'pulse 1.2s infinite',
                        animationDelay: `${delay}s`,
                        '@keyframes pulse': {
                          '0%,100%': { opacity: 0.3 },
                          '50%': { opacity: 1 },
                        },
                      }} />
                    ))}
                    <Typography sx={{
                      fontSize: '0.68rem',
                      color: '#555',
                      fontFamily: "'IBM Plex Mono', monospace",
                      ml: 0.25,
                    }}>
                      Searching web…
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{
                    background: '#151310',
                    border: '1px solid #1e1a14',
                    borderRadius: '3px 12px 12px 12px',
                    px: 1.75,
                    py: 1.5,
                    ...MD_STYLES,
                  }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content || ''}
                    </ReactMarkdown>
                  </Box>
                )}

                {/* Action row — only when not streaming */}
                {!msg.streaming && msg.content && (
                  <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
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
            )}
          </React.Fragment>
        ))}
        <div ref={bottomRef} />
      </Box>
    </Box>
  );
}
