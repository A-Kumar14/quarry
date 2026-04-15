import React, { useState, useRef } from 'react';
import { Box, Typography } from '@mui/material';

export default function InputBar({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(text);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleInput(e) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  return (
    <Box sx={{
      px: 2.25,
      pt: 1.25,
      pb: 1.75,
      borderTop: '1px solid #1c1813',
      flexShrink: 0,
    }}>
      <Box sx={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 1,
        background: '#151310',
        border: '1px solid #242018',
        borderRadius: '12px',
        px: 1.5,
        py: 1.25,
      }}>
        <Box
          ref={textareaRef}
          component="textarea"
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up…"
          rows={1}
          disabled={disabled}
          sx={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: '0.78rem',
            color: '#ccc',
            lineHeight: 1.6,
            '&::placeholder': { color: '#444' },
            '&:disabled': { opacity: 0.4 },
          }}
        />
        <Box
          component="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          sx={{
            width: 28,
            height: 28,
            borderRadius: '8px',
            background: disabled || !value.trim() ? '#1e1a14' : '#F97316',
            border: 'none',
            cursor: disabled || !value.trim() ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={disabled || !value.trim() ? '#555' : '#fff'} strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.75, px: 0.25 }}>
        {['↵ send', 'shift+↵ newline', '⎋ fork from message'].map(hint => (
          <Typography key={hint} sx={{
            fontSize: '0.58rem',
            color: '#2a2520',
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            {hint}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
