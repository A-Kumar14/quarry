import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import ContradictionsTab from '../ContradictionsTab';
import PerspectivesTab from '../PerspectivesTab';

const TABS = ['Sources', 'Contradictions', 'Perspectives'];

export default function ResearchDrawer({ open, message, onClose }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!open || !message) return null;

  const research = message.research_data || {};
  const sources = research.sources || [];
  const contradictions = { contradictions: research.contradictions || [], consensus: '' };
  const query = research.query_used || '';

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={onClose}
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 10,
        }}
      />

      {/* Drawer sheet */}
      <Box sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 11,
        background: '#13110e',
        borderTop: '1px solid #2a2218',
        borderRadius: '12px 12px 0 0',
        maxHeight: '65vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Drag handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.25, pb: 0.5, flexShrink: 0 }}>
          <Box sx={{ width: 36, height: 3, borderRadius: 2, background: '#2a2520' }} />
        </Box>

        {/* Tabs */}
        <Box sx={{
          display: 'flex',
          borderBottom: '1px solid #1e1a14',
          px: 2,
          flexShrink: 0,
        }}>
          {TABS.map((tab, i) => {
            const count = i === 0 ? sources.length
              : i === 1 ? (research.contradictions || []).length
              : 0;
            return (
              <Box
                key={tab}
                component="button"
                onClick={() => setActiveTab(i)}
                sx={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.62rem',
                  color: activeTab === i ? '#F97316' : '#555',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === i ? '2px solid #F97316' : '2px solid transparent',
                  px: 1.5,
                  py: 1,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab}{count > 0 ? ` (${count})` : ''}
              </Box>
            );
          })}
        </Box>

        {/* Tab body */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          {activeTab === 0 && (
            <SourcesList sources={sources} />
          )}
          {activeTab === 1 && (
            <ContradictionsTab
              data={contradictions}
            />
          )}
          {activeTab === 2 && (
            <PerspectivesTab
              query={query}
              isDeepMode={false}
              subQueries={[]}
              sources={sources}
              prefetchedData={null}
            />
          )}
        </Box>
      </Box>
    </>
  );
}

function SourcesList({ sources }) {
  if (!sources.length) {
    return (
      <Typography sx={{
        fontSize: '0.72rem',
        color: '#555',
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        No sources for this message.
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      {sources.map((src, i) => {
        const quality = src.quality_tier || src.credibility_tier || 'unknown';
        const dotColor = quality === 'high' ? '#22c55e' : quality === 'medium' ? '#eab308' : '#555';
        let domain = '';
        try { domain = new URL(src.url).hostname.replace('www.', ''); } catch (_) { domain = src.url; }
        return (
          <Box key={i} sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'flex-start',
            py: 0.75,
            borderBottom: '1px solid #1a1713',
          }}>
            <Box sx={{
              width: 6, height: 6, borderRadius: '50%',
              background: dotColor, flexShrink: 0, mt: 0.5,
            }} />
            <Box>
              <Typography
                component="a"
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontSize: '0.72rem',
                  color: '#bbb',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  lineHeight: 1.4,
                  textDecoration: 'none',
                  '&:hover': { color: '#F97316' },
                }}
              >
                {src.title || domain}
              </Typography>
              <Typography sx={{
                fontSize: '0.60rem',
                color: '#555',
                fontFamily: "'IBM Plex Mono', monospace",
                mt: 0.25,
              }}>
                {domain}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
