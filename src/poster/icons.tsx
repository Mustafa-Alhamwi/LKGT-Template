/* أيقونات شريط التواصل (SVG داخلي حتى تُصدَّر بدقة) */

interface P {
  size?: number
  color?: string
}

export function GlobeIcon({ size = 30, color = 'currentColor' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round">
      <circle cx="12" cy="12" r="9.6" />
      <ellipse cx="12" cy="12" rx="4.3" ry="9.6" />
      <path d="M2.6 9h18.8M2.6 15h18.8" />
    </svg>
  )
}

export function InstagramIcon({ size = 30, color = 'currentColor' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.1}>
      <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.4" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="17.4" cy="6.6" r="1.25" fill={color} stroke="none" />
    </svg>
  )
}

export function PhoneIcon({ size = 30, color = 'currentColor' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
    </svg>
  )
}
