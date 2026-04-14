/**
 * deepMotion.ts — Motion design system for Quarry Deep mode.
 *
 * SPEC OVERVIEW
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. appearCard
 *    Purpose  : New analysis cards entering the panel after a Deep run completes.
 *    Pattern  : fade-in + 10px upward translate → rest position.
 *    Duration : 220ms (fast — the card is ready, not "appearing dramatically").
 *    Easing   : [0.22, 1, 0.36, 1] — custom decelerate cubic-bezier.
 *               Starts fast (card "arrives"), decelerates cleanly to rest.
 *               No spring overshoot — crisis UI must feel settled, not elastic.
 *    Stagger  : 65ms between cards (Claims → Gaps → Timeline → Perspectives).
 *               Long enough to read as intentional sequence; short enough to
 *               feel like one cohesive event, not a slow parade.
 *
 * 2. updateCard
 *    Purpose  : Existing card signalling that its content changed when a new
 *               Deep run refines or adds to prior analysis.
 *    Pattern  : micro scale pulse (1.0 → 1.006 → 1.0) + brief orange glow.
 *               The card does NOT move — it stays in place and "breathes once".
 *    Duration : 480ms for the full round-trip.
 *    Easing   : easeInOut — symmetrical so the flash feels like a heartbeat,
 *               not an abrupt flash.
 *    Trigger  : Imperative via useAnimationControls().start('flash'), so it
 *               can fire on any data version change without re-mounting.
 *
 * 3. pulseBadge
 *    Purpose  : Live / active indicators (orange dot beside "Deep Analysis" label,
 *               "streaming" indicator while analysis runs).
 *    Pattern  : opacity + scale breathing loop [1 → 0.42 → 1] / [1 → 0.86 → 1].
 *    Duration : 2200ms per cycle — deliberately slow so it reads as "alive"
 *               rather than "alerting". In a newsroom UI, fast pulsing is a
 *               warning signal; slow pulsing means "active but calm".
 *    Easing   : easeInOut — smooth, non-mechanical rhythm.
 *    Repeat   : Infinity with repeatType: 'loop'.
 *
 * 4. settleBars
 *    Purpose  : Coverage/completeness meters (source diversity, claim confidence,
 *               gap coverage) animating from 0 to their target value on mount.
 *    Pattern  : width 0% → target% with transform-origin: left.
 *    Duration : 580ms — long enough to feel like measurement, short enough not
 *               to feel like a loading bar.
 *    Easing   : [0.25, 0.46, 0.45, 0.94] — ease-out quad. Accelerates quickly
 *               from 0 then smoothly decelerates to the final value. No
 *               overshoot (meters must read as accurate, not performative).
 *    Stagger  : 80ms per bar so bars read as a ranked list, not simultaneous.
 *
 * 5. fadeSwap
 *    Purpose  : Swapping between diagram types (timeline / actorGraph / corridorMap)
 *               in the Deep diagram slot.
 *    Pattern  : AnimatePresence mode="wait". Old diagram: fade out + scale 0.97
 *               (recedes). New diagram: scale 0.97 → 1 + fade in.
 *    Duration : 180ms exit, 240ms enter. Exit is shorter — the old diagram
 *               should get out of the way quickly; the new one can settle.
 *    Easing   : exit [0.55, 0, 1, 0.45] (ease-in — accelerates to exit),
 *               enter [0.22, 1, 0.36, 1] (decelerate — arrives and settles).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Variants, Transition } from 'framer-motion';

// ── Shared easing curves ──────────────────────────────────────────────────────

/** Fast arrival, smooth deceleration to rest. Used for enter motions. */
export const EASE_DECELERATE = [0.22, 1, 0.36, 1] as const;

/** Accelerates into exit — card "leaves" decisively. */
export const EASE_ACCELERATE = [0.55, 0, 1, 0.45] as const;

/** Standard ease-out quad for bars and subtle transitions. */
export const EASE_OUT_QUAD = [0.25, 0.46, 0.45, 0.94] as const;

// ── 1. appearCard ─────────────────────────────────────────────────────────────

/** Variants for an analysis card entering the panel. Pair with `staggerCards`. */
export const appearCardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: EASE_DECELERATE,
    },
  },
};

/**
 * Stagger container — wrap the card list in a `motion.div` with these variants.
 * Children use `appearCardVariants`.
 *
 * @example
 * <motion.div variants={staggerCards} initial="hidden" animate="visible">
 *   {cards.map(c => <motion.div key={c.id} variants={appearCardVariants}>…</motion.div>)}
 * </motion.div>
 */
export const staggerCards: Variants = {
  hidden:  {},
  visible: {
    transition: {
      staggerChildren: 0.065,
      delayChildren:   0.04,
    },
  },
};

// ── 2. updateCard ─────────────────────────────────────────────────────────────

/**
 * Variants for an existing card whose content has been updated.
 * Trigger imperatively: `controls.start('flash').then(() => controls.set('idle'))`.
 *
 * The card stays in place — only the glow and micro-scale change.
 */
export const updateCardVariants: Variants = {
  idle: {
    scale:     1,
    boxShadow: '0 0 0px rgba(249,115,22,0)',
  },
  flash: {
    scale: [1, 1.006, 1.006, 1],
    boxShadow: [
      '0 0 0px  rgba(249,115,22,0)',
      '0 0 18px rgba(249,115,22,0.22)',
      '0 0 18px rgba(249,115,22,0.22)',
      '0 0 0px  rgba(249,115,22,0)',
    ],
    transition: {
      duration:   0.48,
      ease:       'easeInOut',
      times:      [0, 0.25, 0.65, 1],
    },
  },
};

// ── 3. pulseBadge ─────────────────────────────────────────────────────────────

/**
 * Direct animate prop for a live/active indicator dot.
 * Spread onto a `motion.div`.
 *
 * @example
 * <motion.div style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent)' }}
 *             {...pulseBadgeAnimate} />
 */
export const pulseBadgeAnimate: {
  animate: { opacity: number[]; scale: number[] };
  transition: Transition;
} = {
  animate: {
    opacity: [1, 0.42, 1],
    scale:   [1, 0.86,  1],
  },
  transition: {
    duration:   2.2,
    ease:       'easeInOut',
    repeat:     Infinity,
    repeatType: 'loop',
  },
};

// ── 4. settleBars ─────────────────────────────────────────────────────────────

/**
 * Returns the transition config for a single coverage bar.
 * Apply to `animate={{ width: '${value}%' }}` on a `motion.div`.
 *
 * @param barIndex  Zero-based index for staggered entry.
 *
 * @example
 * <motion.div
 *   initial={{ width: '0%' }}
 *   animate={{ width: `${coverage}%` }}
 *   transition={settleBarTransition(0)}
 *   style={{ height: 4, background: 'var(--accent)', transformOrigin: 'left' }}
 * />
 */
export function settleBarTransition(barIndex: number): Transition {
  return {
    duration: 0.58,
    ease:     EASE_OUT_QUAD,
    delay:    barIndex * 0.08,
  };
}

// ── 5. fadeSwap ───────────────────────────────────────────────────────────────

/**
 * Variants for swapping diagram types inside an `AnimatePresence mode="wait"`.
 * Apply to `motion.div` children; change `key` when diagram type changes.
 *
 * @example
 * <AnimatePresence mode="wait">
 *   <motion.div key={diagramType} variants={fadeSwapVariants}
 *               initial="enter" animate="visible" exit="exit">
 *     <DeepDiagram spec={spec} />
 *   </motion.div>
 * </AnimatePresence>
 */
export const fadeSwapVariants: Variants = {
  enter: {
    opacity: 0,
    scale:   0.97,
  },
  visible: {
    opacity: 1,
    scale:   1,
    transition: {
      duration: 0.24,
      ease:     EASE_DECELERATE,
    },
  },
  exit: {
    opacity: 0,
    scale:   0.97,
    transition: {
      duration: 0.18,
      ease:     EASE_ACCELERATE,
    },
  },
};

// ── Loading shimmer (bonus) ───────────────────────────────────────────────────

/**
 * Low-key "analysis in progress" state — a single slow opacity pulse on a
 * text line or skeleton block. Not a spinner; reads as "quietly working".
 */
export const analysingPulse: {
  animate: { opacity: number[] };
  transition: Transition;
} = {
  animate: {
    opacity: [0.45, 0.80, 0.45],
  },
  transition: {
    duration:   1.8,
    ease:       'easeInOut',
    repeat:     Infinity,
    repeatType: 'loop',
  },
};
