import React from 'react';
import { Box, Typography } from '@mui/material';

function agoShort(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function ConverseSidebar({
  sessions,
  activeSessionId,
  activeBranchId,
  onSelectSession,
  onNewSession,
}) {
  return (
    <Box sx={{
      width: 200,
      flexShrink: 0,
      borderRight: '1px solid #1c1813',
      display: 'flex',
      flexDirection: 'column',
      background: '#110f0d',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{
        px: 1.75,
        py: 1.5,
        borderBottom: '1px solid #1c1813',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <Typography sx={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: '0.69rem',
          fontWeight: 600,
          color: '#aaa',
          letterSpacing: '0.04em',
        }}>
          Conversations
        </Typography>
        <Box
          component="button"
          onClick={onNewSession}
          sx={{
            background: 'rgba(249,115,22,0.12)',
            border: '1px solid rgba(249,115,22,0.25)',
            borderRadius: '6px',
            px: 0.75,
            py: 0.25,
            fontSize: '0.62rem',
            color: '#F97316',
            fontFamily: "'IBM Plex Mono', monospace",
            cursor: 'pointer',
            '&:hover': { background: 'rgba(249,115,22,0.2)' },
          }}
        >
          + New
        </Box>
      </Box>

      {/* Session list */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
        {sessions.length === 0 && (
          <Typography sx={{
            fontSize: '0.70rem',
            color: '#3a3530',
            px: 1.75,
            py: 2,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}>
            No conversations yet
          </Typography>
        )}

        {sessions.map(session => {
          const isActive = session.id === activeSessionId;
          const defaultBranch = session.branches?.[0];

          return (
            <React.Fragment key={session.id}>
              {/* Session row */}
              <Box
                onClick={() => onSelectSession(session.id, defaultBranch?.id)}
                sx={{
                  px: 1.75,
                  py: 0.875,
                  cursor: 'pointer',
                  borderLeft: isActive ? '2px solid #F97316' : '2px solid transparent',
                  background: isActive ? 'rgba(249,115,22,0.06)' : 'transparent',
                  '&:hover': { background: isActive ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.02)' },
                }}
              >
                <Typography sx={{
                  fontSize: '0.69rem',
                  color: isActive ? '#F97316' : '#bbb',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontWeight: isActive ? 500 : 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {session.title || 'New conversation'}
                </Typography>
                <Typography sx={{
                  fontSize: '0.60rem',
                  color: '#444',
                  fontFamily: "'IBM Plex Mono', monospace",
                  mt: 0.25,
                }}>
                  {agoShort(session.created_at)} · {defaultBranch?.message_count || 0} msgs
                </Typography>
              </Box>

              {/* Branch rows (only shown when session is active and has >1 branch) */}
              {isActive && session.branches && session.branches.length > 1 &&
                session.branches.map(branch => {
                  const isBranchActive = branch.id === activeBranchId;
                  return (
                    <Box
                      key={branch.id}
                      onClick={() => onSelectSession(session.id, branch.id)}
                      sx={{
                        px: 1.75,
                        pl: 2.75,
                        py: 0.5,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        '&:hover': { background: 'rgba(255,255,255,0.02)' },
                      }}
                    >
                      <Box sx={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: isBranchActive ? '#F97316' : '#2a2520',
                        flexShrink: 0,
                      }} />
                      <Typography sx={{
                        fontSize: '0.62rem',
                        color: isBranchActive ? '#F97316' : '#555',
                        fontFamily: "'IBM Plex Sans', sans-serif",
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {branch.label}
                      </Typography>
                    </Box>
                  );
                })
              }
            </React.Fragment>
          );
        })}
      </Box>
    </Box>
  );
}
