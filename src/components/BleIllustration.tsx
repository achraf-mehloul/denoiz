// Poetic empty-state illustration: a stylized BLE device silhouette with
// concentric wireless waves gently pulsing. Pure SVG — no external assets.

import { motion } from "framer-motion";

export function BleIllustration({ size = 220 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 220 220" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.78 0.15 190)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.78 0.15 190)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.85 0.16 190)" />
            <stop offset="100%" stopColor="oklch(0.65 0.14 210)" />
          </linearGradient>
        </defs>
        <circle cx="110" cy="110" r="105" fill="url(#glow)" />

        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx="110" cy="110" r={40 + i * 22}
            stroke="url(#stroke)" strokeWidth="1" strokeOpacity="0.35"
            initial={{ scale: 0.85, opacity: 0.7 }}
            animate={{ scale: [0.85, 1.05, 0.85], opacity: [0.55, 0.15, 0.55] }}
            transition={{ duration: 3.2, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "110px 110px" }}
          />
        ))}

        <g transform="translate(84 60)">
          <rect x="0" y="0" width="52" height="100" rx="10" stroke="url(#stroke)" strokeWidth="1.5" fill="oklch(0.20 0.02 220 / 40%)" />
          <path
            d="M 18 22 L 34 42 L 22 54 L 34 66 L 18 86 M 22 54 L 34 42 M 22 54 L 34 66"
            stroke="url(#stroke)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
          <circle cx="26" cy="94" r="2.2" fill="oklch(0.78 0.18 155)" opacity="0.9" />
        </g>

        <motion.path
          d="M 20 175 Q 40 175 44 165 T 60 155 T 74 175 T 90 155 T 106 175 T 122 155 T 138 175 T 154 165 T 174 175 L 200 175"
          stroke="oklch(0.78 0.18 155)" strokeWidth="1.4" fill="none" strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.65 }}
          transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
        />
      </svg>
    </div>
  );
}
