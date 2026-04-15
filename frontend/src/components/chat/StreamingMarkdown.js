/**
 * StreamingMarkdown — block-level memoized markdown renderer.
 * Splits content on paragraph breaks; only the last block re-renders
 * during streaming, keeping long conversations fast.
 */
import React, { memo, useMemo } from 'react';
import { Box } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MD_STYLES = {
  '& p':         { fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: '0.78rem', lineHeight: 1.75, color: '#bbb', my: '6px' },
  '& h1,& h2':   { fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: '0.88rem', color: '#ddd', mt: '12px', mb: '4px' },
  '& h3':        { fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: '0.78rem', color: '#ddd', mt: '8px', mb: '2px' },
  '& ul,& ol':   { pl: '20px', my: '4px' },
  '& li':        { fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: '0.78rem', color: '#bbb', lineHeight: 1.7 },
  '& strong':    { color: '#ddd', fontWeight: 500 },
  '& em':        { color: '#aaa', fontStyle: 'italic' },
  '& blockquote':{ borderLeft: '3px solid #F97316', pl: '12px', ml: 0, color: '#888', fontStyle: 'italic', my: '8px' },
  '& code':      { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', background: '#1a1713', px: '4px', py: '2px', borderRadius: '3px', color: '#e2a96f' },
  '& pre':       { background: '#0e0c0a', border: '1px solid #1e1a14', borderRadius: '6px', p: '10px', overflowX: 'auto', my: '8px' },
  '& pre code':  { background: 'none', px: 0, py: 0, color: '#bbb', fontSize: '0.72rem' },
  '& table':     { borderCollapse: 'collapse', width: '100%', my: '8px' },
  '& th':        { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#888', borderBottom: '1px solid #2a2218', pb: '4px', textAlign: 'left' },
  '& td':        { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.75rem', color: '#bbb', borderBottom: '1px solid #1a1713', py: '4px' },
};

// A single memoized paragraph block
const Block = memo(function Block({ text }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {text}
    </ReactMarkdown>
  );
}, (prev, next) => prev.text === next.text);

export default function StreamingMarkdown({ content, messageId }) {
  // Split on double-newline (paragraph boundaries)
  const blocks = useMemo(() => {
    if (!content) return [];
    const raw = content.split(/\n{2,}/);
    // Last block is always the partial one — never memoize it
    return raw;
  }, [content]);

  return (
    <Box sx={MD_STYLES}>
      {blocks.map((block, i) => (
        <Block
          key={`${messageId}-${i}`}
          text={i < blocks.length - 1 ? block : block} // last block changes
        />
      ))}
    </Box>
  );
}
