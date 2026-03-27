import React, { useState } from 'react';
import { List, arrayMove } from 'react-movable';
import { GripVertical, Clipboard, Check, Edit3 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import GlassCard from './GlassCard';

/* ── Empty / loading states ────────────────────────────────────────────── */
function QuoteEmpty() {
  return (
    <GlassCard style={{ padding: '28px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.85rem', color: 'var(--fg-dim)' }}>
        No attributable quotes found in the retrieved sources.
      </div>
    </GlassCard>
  );
}

function QuoteSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          height: 80,
          borderRadius: 10,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          animation: `qPulse 1.4s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
      <style>{`@keyframes qPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }`}</style>
    </div>
  );
}

/* ── Single quote card (used inside react-movable List) ──────────────────── */
function QuoteCard({ quote, isDragged, onInsert, onCopy, style, ref: fwdRef, ...props }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`"${quote.quote}" — ${quote.speaker}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast.success('Quote copied to clipboard');
      })
      .catch(() => toast.error('Copy failed'));
  };

  const handleInsert = (e) => {
    e.stopPropagation();
    onInsert(quote);
  };

  return (
    <div
      ref={fwdRef}
      {...props}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 10,
        background: isDragged ? 'rgba(249,115,22,0.06)' : 'var(--glass-bg)',
        border: `1px solid ${isDragged ? 'rgba(249,115,22,0.35)' : 'var(--border)'}`,
        borderLeft: `3px solid var(--accent)`,
        marginBottom: 8,
        cursor: isDragged ? 'grabbing' : 'default',
        boxShadow: isDragged ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
        transition: 'box-shadow 0.15s',
        userSelect: isDragged ? 'none' : 'auto',
        ...style,
      }}
    >
      {/* Drag handle */}
      <div
        data-movable-handle
        style={{
          cursor: 'grab',
          color: 'var(--fg-dim)',
          display: 'flex',
          alignItems: 'center',
          paddingTop: 2,
          flexShrink: 0,
        }}
      >
        <GripVertical size={14} />
      </div>

      {/* Quote content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '0.88rem',
          fontStyle: 'italic',
          color: 'var(--fg-primary)',
          lineHeight: 1.6,
          marginBottom: 6,
        }}>
          "{quote.quote}"
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {quote.speaker && (
              <span style={{
                fontFamily: 'var(--font-family)', fontSize: '0.70rem', fontWeight: 600,
                color: 'var(--fg-secondary)',
              }}>
                — {quote.speaker}
              </span>
            )}
            {quote.domain && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
                color: 'var(--fg-dim)',
                background: 'var(--bg-secondary)',
                padding: '1px 5px', borderRadius: 4,
              }}>
                {quote.domain}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <button
              onClick={handleInsert}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                background: 'rgba(249,115,22,0.08)',
                border: '1px solid rgba(249,115,22,0.22)',
                fontFamily: 'var(--font-family)', fontSize: '0.66rem',
                fontWeight: 500, color: 'var(--accent)',
              }}
            >
              <Edit3 size={9} /> Insert
            </button>
            <button
              onClick={handleCopy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                background: copied ? 'rgba(34,197,94,0.08)' : 'var(--bg-secondary)',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
                fontFamily: 'var(--font-family)', fontSize: '0.66rem',
                fontWeight: 500, color: copied ? '#22c55e' : 'var(--fg-secondary)',
                transition: 'all 0.14s',
              }}
            >
              {copied ? <Check size={9} /> : <Clipboard size={9} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export default function QuoteBankTab({ quotes: initialQuotes = [], loading = false, onInsertClaim }) {
  const [items, setItems] = useState(initialQuotes);

  // Sync when props change (new search result)
  React.useEffect(() => {
    setItems(initialQuotes);
  }, [initialQuotes]);

  const handleInsert = (quote) => {
    if (!onInsertClaim) return;
    onInsertClaim({
      claim_text: `"${quote.quote}" — ${quote.speaker}`,
      status: 'single_source',
      source_outlets: [quote.domain].filter(Boolean),
    });
  };

  if (loading) return (
    <>
      <Toaster position="bottom-center" />
      <QuoteSkeleton />
    </>
  );

  if (!items || items.length === 0) return (
    <>
      <Toaster position="bottom-center" />
      <QuoteEmpty />
    </>
  );

  return (
    <>
      <Toaster position="bottom-center" richColors />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <span style={{ fontSize: '0.72rem' }}>💬</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600,
          color: 'var(--fg-dim)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {items.length} quote{items.length !== 1 ? 's' : ''} · drag to reorder
        </span>
      </div>

      <List
        values={items}
        onChange={({ oldIndex, newIndex }) => setItems(arrayMove(items, oldIndex, newIndex))}
        renderList={({ children, props }) => <div {...props}>{children}</div>}
        renderItem={({ value, props, isDragged }) => (
          <QuoteCard
            key={value.quote}
            quote={value}
            isDragged={isDragged}
            onInsert={handleInsert}
            onCopy={() => {}}
            {...props}
          />
        )}
      />
    </>
  );
}
