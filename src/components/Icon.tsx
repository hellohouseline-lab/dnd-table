// Line icons from the screen designs, drawn in the current text colour.

const PATHS = {
  sheet: ['M6 3h9l4 4v14H6z', 'M9 11h7M9 15h7'],
  items: ['M5 8h14l-1 12H6z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  powers: ['M13 2L3 14h9l-1 8 10-12h-9z'],
  journal: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 21V5'],
  lore: ['M4 4h16v16H4z', 'M4 15l5-5 4 4 3-3 4 4'],
  star: ['M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z'],
  camera: ['M15 10l5-3v10l-5-3z', 'M5 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'],
  cameraOff: [
    'M15 10l5-3v10l-5-3z',
    'M5 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
    'M3 3l18 18',
  ],
  mic: ['M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  micOff: ['M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3', 'M3 3l18 18'],
  leave: ['M14 4h5v16h-5', 'M10 8l-4 4 4 4', 'M6 12h11'],
  d20: ['M12 2l8.7 5v10L12 22l-8.7-5V7z', 'M12 7.5l-5 9h10z'],
  sword: ['M14.5 17.5L3 6V3h3l11.5 11.5', 'M13 19l6-6', 'M16 16l4 4'],
  log: ['M6 3h12v18H6z', 'M9 8h6M9 12h6M9 16h4'],
  music: ['M9 18V5l12-2v13', 'M6 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6z', 'M18 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6z'],
  volume: ['M4 9h4l5-4v14l-5-4H4z', 'M16 9a4 4 0 0 1 0 6', 'M19 6a8 8 0 0 1 0 12'],
  play: ['M7 4l13 8-13 8z'],
  pause: ['M7 4h4v16H7z', 'M14 4h4v16h-4z'],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 16v4h16v-4'],
  moon: ['M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z'],
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
