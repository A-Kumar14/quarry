import React, { memo, useState } from 'react';
import { Box, Typography, Collapse } from '@mui/material';

// Single step in the chain
const ChainOfThoughtStep = memo(function ChainOfThoughtStep({
  label,
  detail,
  status, // 'pending' | 'active' | 'done'
  isLast,
}) {
  const [open, setOpen] = useState(false);

  const dotColor =
    status === 'done'    ? '#4ade80' :
    status === 'active'  ? '#F97316' :
    '#2a2520';

  const dotAnim = status === 'active' ? {
    animation: 'cot-pulse 1.2s ease-in-out infinite',
    '@keyframes cot-pulse': {
      '0%,100%': { opacity: 0.4, transform: 'scale(0.85)' },
      '50%':     { opacity: 1,   transform: 'scale(1.15)' },
    },
  } : {};

  return (
    <Box sx={{ display: 'flex', gap: 1.25 }}>
      {/* Timeline spine */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 14 }}>
        <Box sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: dotColor,
          mt: '3px',
          flexShrink: 0,
          transition: 'background 0.3s',
          ...dotAnim,
        }} />
        {!isLast && (
          <Box sx={{
            width: '1px',
            flex: 1,
            minHeight: 10,
            background: status === 'done' ? 'rgba(74,222,128,0.2)' : '#1e1a14',
            mt: 0.5,
            transition: 'background 0.3s',
          }} />
        )}
      </Box>

      {/* Content */}
      <Box sx={{ pb: isLast ? 0 : 1.25, flex: 1, minWidth: 0 }}>
        <Box
          onClick={detail ? () => setOpen(o => !o) : undefined}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: detail ? 'pointer' : 'default',
            userSelect: 'none',
          }}
        >
          <Typography sx={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.64rem',
            color: status === 'active' ? '#F97316' : status === 'done' ? '#666' : '#3a3530',
            letterSpacing: '0.02em',
            transition: 'color 0.3s',
            flex: 1,
          }}>
            {label}
          </Typography>
          {detail && (
            <Typography sx={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.58rem',
              color: '#2a2520',
              transition: 'transform 0.15s',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}>
              ▶
            </Typography>
          )}
        </Box>

        {detail && (
          <Collapse in={open} timeout={150}>
            <Box sx={{
              mt: 0.5,
              px: 1,
              py: 0.5,
              background: '#0e0c0a',
              borderRadius: '4px',
              border: '1px solid #1a1713',
            }}>
              <Typography sx={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.60rem',
                color: '#555',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {detail}
              </Typography>
            </Box>
          </Collapse>
        )}
      </Box>
    </Box>
  );
});

// Container
export default memo(function ChainOfThought({ steps }) {
  if (!steps || steps.length === 0) return null;

  return (
    <Box sx={{
      mb: 1,
      px: 1.25,
      py: 0.875,
      background: 'rgba(249,115,22,0.03)',
      border: '1px solid #1c1813',
      borderRadius: '8px',
    }}>
      {steps.map((step, i) => (
        <ChainOfThoughtStep
          key={i}
          label={step.label}
          detail={step.detail}
          status={step.status}
          isLast={i === steps.length - 1}
        />
      ))}
    </Box>
  );
});
