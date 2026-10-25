// Line icons from the screen designs, drawn in the current text colour.

const PATHS = {
  sheet: ['M6 3h9l4 4v14H6z', 'M9 11h7M9 15h7'],
  items: ['M5 8h14l-1 12H6z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  powers: ['M13 2L3 14h9l-1 8 10-12h-9z'],
  journal: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 21V5'],
  lore: ['M4 4h16v16H4z', 'M4 15l5-5 4 4 3-3 4 4'],
  star: ['M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z'],
  camera: ['M15 10l5-3v10l-5-3z', 'M5 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'],
  d20: ['M12 2l8.7 5v10L12 22l-8.7-5V7z', 'M12 7.5l-5 9h10z'],
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
