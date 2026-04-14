import React, { useMemo, useState, useCallback } from 'react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { encode } from 'qss';
import { motion, useMotionValue, useSpring } from 'framer-motion';

const cn = (...classes) => classes.filter(Boolean).join(' ');

function buildPreviewUrl(url, width, height, isStatic, imageSrc) {
  if (isStatic) return imageSrc || '';
  const params = encode({
    url,
    screenshot: true,
    meta: false,
    embed: 'screenshot.url',
    colorScheme: 'dark',
    'viewport.isMobile': true,
    'viewport.deviceScaleFactor': 1,
    'viewport.width': Math.round(width * 2.2),
    'viewport.height': Math.round(height * 2.2),
  });
  return `https://api.microlink.io/?${params}`;
}

export function HoverPeek({
  children,
  url,
  className,
  peekWidth = 220,
  peekHeight = 138,
  isStatic = false,
  imageSrc = '',
  enableMouseFollow = true,
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const mouseX = useMotionValue(0);
  const followX = useSpring(mouseX, { stiffness: 140, damping: 20 });

  const previewSrc = useMemo(
    () => buildPreviewUrl(url, peekWidth, peekHeight, isStatic, imageSrc),
    [url, peekWidth, peekHeight, isStatic, imageSrc]
  );

  const handlePointerMove = useCallback((event) => {
    if (!enableMouseFollow) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    mouseX.set((x - rect.width / 2) * 0.22);
  }, [enableMouseFollow, mouseX]);

  const handleOpenChange = useCallback((nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFailed(false);
      mouseX.set(0);
    }
  }, [mouseX]);

  const child = React.isValidElement(children)
    ? React.cloneElement(children, {
      className: cn(children.props.className, className),
      onPointerMove: handlePointerMove,
    })
    : <span className={className} onPointerMove={handlePointerMove}>{children}</span>;

  const validUrl = /^https?:\/\//i.test(url || '');
  if (!validUrl) return child;

  return (
    <HoverCard.Root openDelay={90} closeDelay={140} onOpenChange={handleOpenChange}>
      <HoverCard.Trigger asChild>
        {child}
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="center"
          sideOffset={10}
          className="z-[1200] [perspective:900px]"
        >
          {open && (
            <motion.div
              initial={{ opacity: 0, rotateY: -75, scale: 0.97 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 210, damping: 20 }}
              style={{ x: enableMouseFollow ? followX : 0 }}
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] shadow-xl"
                style={{ width: peekWidth }}
              >
                {failed ? (
                  <div
                    style={{ width: peekWidth, height: peekHeight }}
                    className="flex items-center justify-center text-xs text-[var(--fg-dim)]"
                  >
                    Preview unavailable
                  </div>
                ) : (
                  <img
                    src={previewSrc}
                    width={peekWidth}
                    height={peekHeight}
                    alt={`Preview of ${url}`}
                    loading="lazy"
                    onError={() => setFailed(true)}
                    className="block bg-[var(--bg-tertiary)]"
                  />
                )}
              </a>
            </motion.div>
          )}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

