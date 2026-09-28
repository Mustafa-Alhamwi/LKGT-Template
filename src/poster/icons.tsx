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

export function WhatsappIcon({ size = 30, color = 'currentColor' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21l1.65-4.9A8.9 8.9 0 1 1 8 19.4L3 21z" />
      <path d="M9 8.5c.2 3 2.8 5.6 5.8 6l1.2-1.4-2-1-.9.6a4.3 4.3 0 0 1-2-2l.6-.9-1-2L9 8.5z" fill={color} stroke="none" />
    </svg>
  )
}

export function MailIcon({ size = 30, color = 'currentColor' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.6" y="4.6" width="18.8" height="14.8" rx="3" />
      <path d="M3.4 7.4l8.6 6 8.6-6" />
    </svg>
  )
}

export function PinIcon({ size = 30, color = 'currentColor' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21.4s7-5.9 7-11.4a7 7 0 1 0-14 0c0 5.5 7 11.4 7 11.4z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  )
}
