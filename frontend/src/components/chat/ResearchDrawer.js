import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { Link2, GitMerge, Users } from 'lucide-react';
import ContradictionsTab from '../ContradictionsTab';
import PerspectivesTab from '../PerspectivesTab';

const TAB_META = [
  { id: 'sources', label: 'Sources', Icon: Link2 },
  { id: 'contradictions', label: 'Contradictions', Icon: GitMerge },
  { id: 'perspectives', label: 'Perspectives', Icon: Users },
];

export default function ResearchDrawer({ open, message, onClose }) {
  const [activeTab, setActiveTab] = useState(0);
  const tabRefs = useRef([]);

  useEffect(() => {
    if (open && message?.id) setActiveTab(0);
  }, [open, message?.id]);

  const handleTabKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      setActiveTab((i) => {
        const next = (i + delta + TAB_META.length) % TAB_META.length;
        queueMicrotask(() => tabRefs.current[next]?.focus());
        return next;
      });
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setActiveTab(0);
      queueMicrotask(() => tabRefs.current[0]?.focus());
    }
    if (e.key === 'End') {
      e.preventDefault();
      const last = TAB_META.length - 1;
      setActiveTab(last);
      queueMicrotask(() => tabRefs.current[last]?.focus());
    }
  }, []);

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

        {/* Segmented control (glass pill nav — Converse dark tokens) */}
        <Box sx={{ px: 2, pb: 1.5, flexShrink: 0 }}>
          <Box
            role="tablist"
            aria-label="Research sections"
            onKeyDown={handleTabKeyDown}
            sx={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: `repeat(${TAB_META.length}, minmax(0, 1fr))`,
              alignItems: 'stretch',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(14px) saturate(160%)',
              WebkitBackdropFilter: 'blur(14px) saturate(160%)',
              p: 0.5,
              overflow: 'hidden',
              boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 -1px 0 rgba(0,0,0,0.2) inset',
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                top: 4,
                bottom: 4,
                left: 4,
                width: `calc((100% - 8px) / ${TAB_META.length})`,
                borderRadius: '10px',
                background: 'rgba(20,16,14,0.72)',
                border: '1px solid rgba(249,115,22,0.35)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
                transform: `translateX(calc(${activeTab} * 100%))`,
                transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            {TAB_META.map((tab, i) => {
              const count = i === 0 ? sources.length
                : i === 1 ? (research.contradictions || []).length
                : 0;
              const selected = activeTab === i;
              const { Icon } = tab;
              return (
                <Box
                  key={tab.id}
                  component="button"
                  type="button"
                  role="tab"
                  id={`research-tab-${tab.id}`}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  ref={(el) => { tabRefs.current[i] = el; }}
                  onClick={() => {
                    setActiveTab(i);
                    queueMicrotask(() => tabRefs.current[i]?.focus());
                  }}
                  sx={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.75,
                    py: 1,
                    px: 0.75,
                    minWidth: 0,
                    border: 'none',
                    borderRadius: '10px',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.58rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: selected ? '#F97316' : '#555',
                    transition: 'color 0.18s ease',
                    '&:focus-visible': {
                      outline: '2px solid rgba(249,115,22,0.65)',
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Icon size={16} strokeWidth={2} aria-hidden style={{ flexShrink: 0 }} />
                  <Box component="span" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tab.label}
                    {count > 0 ? ` (${count})` : ''}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Tab panels */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          <Box
            role="tabpanel"
            id="research-panel-sources"
            aria-labelledby="research-tab-sources"
            hidden={activeTab !== 0}
          >
            {activeTab === 0 && <SourcesList sources={sources} />}
          </Box>
          <Box
            role="tabpanel"
            id="research-panel-contradictions"
            aria-labelledby="research-tab-contradictions"
            hidden={activeTab !== 1}
          >
            {activeTab === 1 && (
              <ContradictionsTab
                data={contradictions}
              />
            )}
          </Box>
          <Box
            role="tabpanel"
            id="research-panel-perspectives"
            aria-labelledby="research-tab-perspectives"
            hidden={activeTab !== 2}
          >
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
