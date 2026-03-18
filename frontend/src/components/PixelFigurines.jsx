import React from 'react';

const ENABLE_FIGURINE_ANIMATION = true;

export const floatIdleCSS = ENABLE_FIGURINE_ANIMATION
  ? `
    @keyframes floatIdle {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-4px); }
    }
    .fig-left  { animation: floatIdle 3s ease-in-out infinite; }
    .fig-right { animation: floatIdle 3s ease-in-out infinite 1.5s; }
    @media (max-width: 767px) {
      .fig-left, .fig-right { display: none !important; }
    }
    @media (min-width: 768px) and (max-width: 1024px) {
      .fig-left  { transform-origin: bottom left;  transform: scale(0.7); }
      .fig-right { transform-origin: bottom right; transform: scale(0.7); }
    }
  `
  : `
    @media (max-width: 767px) {
      .fig-left, .fig-right { display: none !important; }
    }
    @media (min-width: 768px) and (max-width: 1024px) {
      .fig-left  { transform-origin: bottom left;  transform: scale(0.7); }
      .fig-right { transform-origin: bottom right; transform: scale(0.7); }
    }
  `;

/* ── The Scout: magnifying glass, orange jacket, navy cap ── */
export function ScoutFigurine() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80" width="60" height="80"
      style={{ imageRendering: 'pixelated', display: 'block' }}>
      {/* Cap brim */}
      <rect x="16" y="4"  width="28" height="4"  fill="#1A2744"/>
      {/* Cap crown */}
      <rect x="20" y="0"  width="20" height="6"  fill="#1A2744"/>
      {/* Head */}
      <rect x="18" y="8"  width="22" height="16" fill="#E8B99A"/>
      {/* Left eye */}
      <rect x="21" y="12" width="4"  height="4"  fill="#2D1A00"/>
      {/* Right eye */}
      <rect x="33" y="12" width="4"  height="4"  fill="#2D1A00"/>
      {/* Mouth */}
      <rect x="24" y="20" width="10" height="2"  fill="#C4917A"/>
      {/* Neck */}
      <rect x="25" y="24" width="8"  height="4"  fill="#E8B99A"/>
      {/* Body / jacket */}
      <rect x="14" y="28" width="28" height="18" fill="#EA580C"/>
      {/* Belt */}
      <rect x="14" y="44" width="28" height="3"  fill="#2D1A00"/>
      {/* Belt buckle */}
      <rect x="26" y="44" width="6"  height="3"  fill="#C99A2A"/>
      {/* Left arm */}
      <rect x="6"  y="28" width="8"  height="14" fill="#EA580C"/>
      {/* Left hand */}
      <rect x="5"  y="40" width="9"  height="6"  fill="#E8B99A"/>
      {/* Right arm (raised) */}
      <rect x="42" y="28" width="8"  height="10" fill="#EA580C"/>
      {/* Right elbow / forearm angled toward glass */}
      <rect x="44" y="36" width="10" height="4"  fill="#EA580C"/>
      {/* Right hand */}
      <rect x="50" y="28" width="6"  height="10" fill="#E8B99A"/>
      {/* Magnifying glass handle */}
      <rect x="47" y="14" width="4"  height="16" fill="#5C4033"/>
      {/* Glass frame top */}
      <rect x="36" y="6"  width="16" height="3"  fill="#F97316"/>
      {/* Glass frame left */}
      <rect x="36" y="6"  width="3"  height="18" fill="#F97316"/>
      {/* Glass frame right */}
      <rect x="49" y="6"  width="3"  height="18" fill="#F97316"/>
      {/* Glass frame bottom */}
      <rect x="36" y="21" width="16" height="3"  fill="#F97316"/>
      {/* Lens */}
      <rect x="39" y="9"  width="10" height="12" fill="#C7EBF5"/>
      {/* Lens shine */}
      <rect x="40" y="10" width="4"  height="3"  fill="#E8F8FF"/>
      {/* Pants left */}
      <rect x="14" y="47" width="12" height="20" fill="#1A2744"/>
      {/* Pants right */}
      <rect x="30" y="47" width="12" height="20" fill="#1A2744"/>
      {/* Shoe left */}
      <rect x="11" y="67" width="15" height="6"  fill="#1A1A1A"/>
      {/* Shoe right */}
      <rect x="30" y="67" width="15" height="6"  fill="#1A1A1A"/>
    </svg>
  );
}

/* ── The Archivist: sitting on books, holding an open tome ── */
export function ArchivistFigurine() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80" width="60" height="80"
      style={{ imageRendering: 'pixelated', display: 'block' }}>
      {/* Hair */}
      <rect x="16" y="0"  width="28" height="6"  fill="#5C3D2A"/>
      <rect x="14" y="4"  width="32" height="4"  fill="#5C3D2A"/>
      {/* Head */}
      <rect x="16" y="8"  width="26" height="16" fill="#E8B99A"/>
      {/* Left eye */}
      <rect x="20" y="13" width="4"  height="4"  fill="#2D1A00"/>
      {/* Right eye */}
      <rect x="34" y="13" width="4"  height="4"  fill="#2D1A00"/>
      {/* Glasses frame left - top */}
      <rect x="18" y="11" width="10" height="2"  fill="#8B6914"/>
      {/* Glasses frame left - bottom */}
      <rect x="18" y="18" width="10" height="2"  fill="#8B6914"/>
      {/* Glasses frame left - sides */}
      <rect x="18" y="11" width="2"  height="9"  fill="#8B6914"/>
      <rect x="26" y="11" width="2"  height="9"  fill="#8B6914"/>
      {/* Glasses bridge */}
      <rect x="28" y="14" width="4"  height="2"  fill="#8B6914"/>
      {/* Glasses frame right - top */}
      <rect x="32" y="11" width="10" height="2"  fill="#8B6914"/>
      {/* Glasses frame right - bottom */}
      <rect x="32" y="18" width="10" height="2"  fill="#8B6914"/>
      {/* Glasses frame right - sides */}
      <rect x="32" y="11" width="2"  height="9"  fill="#8B6914"/>
      <rect x="40" y="11" width="2"  height="9"  fill="#8B6914"/>
      {/* Smile */}
      <rect x="23" y="21" width="12" height="2"  fill="#C4917A"/>
      {/* Body / sweater */}
      <rect x="14" y="24" width="32" height="16" fill="#8B6914"/>
      {/* Left arm */}
      <rect x="6"  y="26" width="8"  height="12" fill="#8B6914"/>
      {/* Right arm */}
      <rect x="46" y="26" width="8"  height="12" fill="#8B6914"/>
      {/* Open book (held) - pages */}
      <rect x="10" y="28" width="18" height="12" fill="#F5EDD6"/>
      <rect x="32" y="28" width="18" height="12" fill="#F5EDD6"/>
      {/* Book spine */}
      <rect x="28" y="26" width="4"  height="14" fill="#6B4A2A"/>
      {/* Book text lines left page */}
      <rect x="12" y="31" width="12" height="2"  fill="#C4A97A"/>
      <rect x="12" y="35" width="8"  height="2"  fill="#C4A97A"/>
      {/* Book text lines right page */}
      <rect x="34" y="31" width="12" height="2"  fill="#C4A97A"/>
      <rect x="34" y="35" width="8"  height="2"  fill="#C4A97A"/>
      {/* Dangling legs */}
      <rect x="18" y="40" width="10" height="14" fill="#4A4A4A"/>
      <rect x="32" y="40" width="10" height="14" fill="#4A4A4A"/>
      {/* Shoes */}
      <rect x="15" y="54" width="13" height="6"  fill="#1A1A1A"/>
      <rect x="32" y="54" width="13" height="6"  fill="#1A1A1A"/>
      {/* Book stack top (cream) */}
      <rect x="6"  y="60" width="48" height="6"  fill="#C8A96E"/>
      {/* Book stack middle (teal) */}
      <rect x="2"  y="66" width="56" height="7"  fill="#2D6A6A"/>
      {/* Book stack bottom (red) — overflows viewport for "standing on floor" effect */}
      <rect x="0"  y="73" width="60" height="10" fill="#8B1A1A"/>
    </svg>
  );
}

/* ── The Wanderer: backpack, teal jacket, compass ── */
export function WandererFigurine() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80" width="60" height="80"
      style={{ imageRendering: 'pixelated', display: 'block' }}>
      {/* Hair */}
      <rect x="18" y="0"  width="24" height="6"  fill="#2D4A2D"/>
      {/* Head */}
      <rect x="18" y="6"  width="22" height="16" fill="#E8B99A"/>
      {/* Left eye */}
      <rect x="22" y="11" width="4"  height="4"  fill="#2D1A00"/>
      {/* Right eye */}
      <rect x="32" y="11" width="4"  height="4"  fill="#2D1A00"/>
      {/* Mouth */}
      <rect x="24" y="18" width="10" height="2"  fill="#C4917A"/>
      {/* Neck */}
      <rect x="25" y="22" width="8"  height="4"  fill="#E8B99A"/>
      {/* Backpack body (left side — slightly behind character) */}
      <rect x="4"  y="26" width="14" height="24" fill="#8B6914"/>
      {/* Backpack pocket */}
      <rect x="6"  y="36" width="10" height="10" fill="#A07C1F"/>
      {/* Backpack straps */}
      <rect x="10" y="26" width="3"  height="4"  fill="#6B4A14"/>
      <rect x="16" y="26" width="3"  height="16" fill="#6B4A14"/>
      {/* Body / jacket */}
      <rect x="14" y="26" width="28" height="20" fill="#2D6A4F"/>
      {/* Jacket pocket */}
      <rect x="16" y="34" width="8"  height="6"  fill="#236040"/>
      {/* Left arm */}
      <rect x="6"  y="28" width="8"  height="16" fill="#2D6A4F"/>
      {/* Left hand */}
      <rect x="5"  y="42" width="9"  height="5"  fill="#E8B99A"/>
      {/* Right arm (holding compass) */}
      <rect x="42" y="28" width="8"  height="16" fill="#2D6A4F"/>
      {/* Compass body (gold) */}
      <rect x="42" y="42" width="14" height="12" fill="#C99A2A"/>
      {/* Compass face */}
      <rect x="44" y="44" width="10" height="8"  fill="#E8D870"/>
      {/* Compass north needle */}
      <rect x="48" y="45" width="2"  height="4"  fill="#C03030"/>
      {/* Compass south needle */}
      <rect x="48" y="49" width="2"  height="3"  fill="#303090"/>
      {/* Pants left */}
      <rect x="14" y="46" width="12" height="20" fill="#5C4033"/>
      {/* Pants right */}
      <rect x="30" y="46" width="12" height="20" fill="#5C4033"/>
      {/* Shoe left */}
      <rect x="11" y="66" width="15" height="6"  fill="#1A1A1A"/>
      {/* Shoe right */}
      <rect x="30" y="66" width="15" height="6"  fill="#1A1A1A"/>
    </svg>
  );
}
