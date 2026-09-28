import { useId, type ReactNode } from 'react'
import {
  Atom, Award, Ban, Banknote, Battery, Bell, BadgeCheck, BadgePercent, Bookmark, BookOpen, Bot, Brain, Cable, Calendar, Camera, Car, Check, CircleCheck, CircleDollarSign,
  CircleHelp, CircleX, ClipboardCheck, Clock, Cloud, Code, Coffee, Coins, Cpu, CreditCard, Crown, Database, Droplets, Eye, Fingerprint, FlaskConical, Flag, Flame, Gift,
  GraduationCap, Globe, Handshake, HardDrive, Headphones, Heart, House, Info, Key, Keyboard, Laptop, Leaf, Lightbulb, Link, ListChecks, Lock, Mail, MapPin, Medal,
  Megaphone, MessageCircle, Microscope, Monitor, Mouse, Network, Package, PartyPopper, Percent, Phone, Plane, Plug, Printer, Projector, Quote, Receipt, Recycle, Rocket,
  Router, ScanBarcode, Scissors, Search, Server, Shield, ShieldCheck, ShoppingCart, Smartphone, Smile, Snowflake, Sparkles, Speaker, Stamp, Star, Sun, Tag, Target, Timer,
  TrendingUp, Trophy, TriangleAlert, Truck, ThumbsUp, Users, Video, Wallet, Watch, Wifi, Wrench, X, Zap,
  type LucideIcon,
} from 'lucide-react'
import { fontStack, isArabicText } from '../lib/fonts'
import { measure100 } from '../lib/textFit'
import { mix, withAlpha } from '../lib/color'
import { useEditor } from '../store/editor'
import type { StickerSpec } from '../model/types'

/* ------------------------------------------------------------------
 * مكتبة الملصقات: شارات، أشكال، أسهم، أيقونات
 * كل ملصق SVG يتلوّن بلونين ويحمل نصاً قابلاً للتعديل عند الحاجة
 * ------------------------------------------------------------------ */

export type StickerCat = 'badge' | 'shape' | 'arrow' | 'icon'
export type AnswerState = 'neutral' | 'chosen' | 'dim'

export interface RenderCtx {
  color: string
  color2: string
  text: string
  text2: string
  uid: string
  fv: number
  strokeW: number
  state: AnswerState
}

export interface StickerDef {
  id: string
  label: string
  cat: StickerCat
  vw: number
  vh: number
  color: string
  color2: string
  text?: string
  text2?: string
  strokeW?: number
  render: (c: RenderCtx) => ReactNode
}

const shade = (c: string, t: number) => mix(c, '#000000', t)
const tint = (c: string, t: number) => mix(c, '#ffffff', t)

/* ------------------------------ نص SVG متلائم ------------------------------ */

function StText({
  text,
  x,
  y,
  maxW,
  maxSize,
  color,
  fv,
  weight = 900,
  gap = 1.08,
  rotate,
  spacing = 0,
}: {
  text: string
  x: number
  y: number
  maxW: number
  maxSize: number
  color: string
  fv: number
  weight?: number
  gap?: number
  rotate?: number
  spacing?: number
}) {
  const lines = (text || '').split('\n')
  const sizes = lines.map((l) => (l.trim() ? Math.min(maxSize, (100 * maxW) / Math.max(1, measure100(l, { weightAr: weight, weightLat: 700, tracking: spacing, uppercase: false }, fv))) : maxSize))
  const size = Math.max(6, Math.min(...sizes))
  const total = size * gap * lines.length
  return (
    <g transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}>
      {lines.map((l, i) => (
        <text
          key={i}
          x={x}
          y={y - total / 2 + size * gap * (i + 0.5)}
          textAnchor="middle"
          dominantBaseline="central"
          direction={isArabicText(l) ? 'rtl' : 'ltr'}
          fill={color}
          fontFamily={fontStack(l, 700)}
          fontWeight={weight}
          fontSize={size}
          letterSpacing={spacing ? `${spacing}em` : undefined}
          style={{ whiteSpace: 'pre' }}
        >
          {l}
        </text>
      ))}
    </g>
  )
}

function starPath(cx: number, cy: number, n: number, r1: number, r2: number, rot = -90): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2
    const a = ((rot + (i * 180) / n) * Math.PI) / 180
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M${pts.join(' L')} Z`
}

function scallopPath(cx: number, cy: number, n: number, R: number, bump: number): string {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)])
  }
  const chord = 2 * R * Math.sin(Math.PI / n)
  const rb = chord / 2 + bump
  return `M${pts[0][0]} ${pts[0][1]} ${pts.map((_p, i) => `A${rb} ${rb} 0 0 1 ${pts[(i + 1) % n][0]} ${pts[(i + 1) % n][1]}`).join(' ')} Z`
}

/** تدرج عمودي خفيف من اللون */
function Grad({ id, color, amount = 0.22 }: { id: string; color: string; amount?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={tint(color, amount)} />
      <stop offset="1" stopColor={shade(color, amount * 0.6)} />
    </linearGradient>
  )
}

const shadowFilter = (id: string, o = 0.35) => (
  <filter id={id} x="-20%" y="-20%" width="140%" height="150%">
    <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity={o} />
  </filter>
)

/* ------------------------------ الشارات ------------------------------ */

const badges: StickerDef[] = [
  {
    id: 'b:burst',
    label: 'نجمة متفجرة',
    cat: 'badge',
    vw: 200,
    vh: 200,
    color: '#D11A24',
    color2: '#FFFFFF',
    text: 'جديد',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>
          <Grad id={`g${uid}`} color={color} />
          {shadowFilter(`s${uid}`)}
        </defs>
        <path d={starPath(100, 100, 14, 96, 82)} fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
        <circle cx="100" cy="100" r="70" fill="none" stroke={withAlpha(color2, 0.55)} strokeWidth="2.5" strokeDasharray="5 6" />
        <StText text={text} x={100} y={100} maxW={116} maxSize={58} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:sale',
    label: 'انفجار حاد',
    cat: 'badge',
    vw: 200,
    vh: 200,
    color: '#FFD23F',
    color2: '#B3121C',
    text: 'SALE',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>{shadowFilter(`s${uid}`)}</defs>
        <path d={starPath(100, 100, 18, 98, 70)} fill={shade(color, 0.16)} transform="translate(3 4)" />
        <path d={starPath(100, 100, 18, 98, 70)} fill={color} filter={`url(#s${uid})`} />
        <StText text={text} x={100} y={100} maxW={104} maxSize={50} color={color2} fv={fv} rotate={-8} />
      </>
    ),
  },
  {
    id: 'b:seal',
    label: 'ختم مموّج',
    cat: 'badge',
    vw: 200,
    vh: 200,
    color: '#111214',
    color2: '#F5C542',
    text: 'أصلي\n100%',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>
          <Grad id={`g${uid}`} color={color} amount={0.3} />
          {shadowFilter(`s${uid}`)}
        </defs>
        <path d={scallopPath(100, 100, 26, 80, 4)} fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
        <circle cx="100" cy="100" r="66" fill="none" stroke={color2} strokeWidth="3" />
        <circle cx="100" cy="100" r="59" fill="none" stroke={withAlpha(color2, 0.5)} strokeWidth="1.5" />
        <StText text={text} x={100} y={100} maxW={92} maxSize={40} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:circle',
    label: 'شارة دائرية',
    cat: 'badge',
    vw: 200,
    vh: 200,
    color: '#D11A24',
    color2: '#FFFFFF',
    text: 'عرض',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>
          <radialGradient id={`g${uid}`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor={tint(color, 0.28)} />
            <stop offset="1" stopColor={shade(color, 0.12)} />
          </radialGradient>
          {shadowFilter(`s${uid}`)}
        </defs>
        <circle cx="100" cy="100" r="90" fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
        <circle cx="100" cy="100" r="76" fill="none" stroke={withAlpha(color2, 0.7)} strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
        <StText text={text} x={100} y={100} maxW={110} maxSize={52} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:ring',
    label: 'حلقة',
    cat: 'badge',
    vw: 200,
    vh: 200,
    color: '#111214',
    color2: '#FFFFFF',
    text: 'NEW',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>{shadowFilter(`s${uid}`, 0.25)}</defs>
        <circle cx="100" cy="100" r="92" fill={color2} filter={`url(#s${uid})`} />
        <circle cx="100" cy="100" r="86" fill="none" stroke={color} strokeWidth="6" />
        <circle cx="100" cy="100" r="72" fill={color} />
        <StText text={text} x={100} y={100} maxW={100} maxSize={48} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:discount',
    label: 'خصم',
    cat: 'badge',
    vw: 200,
    vh: 200,
    color: '#D11A24',
    color2: '#FFFFFF',
    text: '50%',
    text2: 'خصم',
    render: ({ color, color2, text, text2, uid, fv }) => (
      <>
        <defs>
          <Grad id={`g${uid}`} color={color} />
          {shadowFilter(`s${uid}`)}
        </defs>
        <path d={scallopPath(100, 100, 22, 82, 5)} fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
        <StText text={text} x={100} y={88} maxW={112} maxSize={62} color={color2} fv={fv} />
        <StText text={text2} x={100} y={140} maxW={90} maxSize={34} color={withAlpha(color2, 0.92)} fv={fv} weight={700} />
      </>
    ),
  },
  {
    id: 'b:shield',
    label: 'درع',
    cat: 'badge',
    vw: 200,
    vh: 210,
    color: '#1B2A4A',
    color2: '#FFFFFF',
    text: 'ضمان\nسنة',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>
          <Grad id={`g${uid}`} color={color} amount={0.3} />
          {shadowFilter(`s${uid}`)}
        </defs>
        <path d="M100 8 L180 34 V98 C180 148 142 182 100 200 C58 182 20 148 20 98 V34 Z" fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
        <path d="M100 22 L166 44 V98 C166 138 136 168 100 184 C64 168 34 138 34 98 V44 Z" fill="none" stroke={withAlpha(color2, 0.6)} strokeWidth="2.5" />
        <StText text={text} x={100} y={104} maxW={92} maxSize={44} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:banner',
    label: 'شريط بأطراف',
    cat: 'badge',
    vw: 340,
    vh: 120,
    color: '#D11A24',
    color2: '#FFFFFF',
    text: 'شحن مجاني',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>
          <Grad id={`g${uid}`} color={color} amount={0.18} />
          {shadowFilter(`s${uid}`, 0.28)}
        </defs>
        <path d="M0 34 H64 V112 H0 L26 73 Z" fill={shade(color, 0.28)} />
        <path d="M340 34 H276 V112 H340 L314 73 Z" fill={shade(color, 0.28)} />
        <path d="M44 98 L64 118 V98 Z" fill={shade(color, 0.5)} />
        <path d="M296 98 L276 118 V98 Z" fill={shade(color, 0.5)} />
        <rect x="42" y="8" width="256" height="90" rx="8" fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
        <StText text={text} x={170} y={53} maxW={216} maxSize={46} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:tag',
    label: 'بطاقة سعر',
    cat: 'badge',
    vw: 300,
    vh: 150,
    color: '#111214',
    color2: '#FFFFFF',
    text: 'وفّر 30%',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>
          <Grad id={`g${uid}`} color={color} amount={0.25} />
          {shadowFilter(`s${uid}`)}
        </defs>
        <path d="M70 6 H268 A26 26 0 0 1 294 32 V118 A26 26 0 0 1 268 144 H70 L6 75 Z" fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
        <circle cx="64" cy="75" r="11" fill={color2} />
        <circle cx="64" cy="75" r="11" fill="none" stroke={withAlpha(color, 0.35)} strokeWidth="3" />
        <StText text={text} x={185} y={76} maxW={172} maxSize={54} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:ticket',
    label: 'كوبون',
    cat: 'badge',
    vw: 340,
    vh: 150,
    color: '#D11A24',
    color2: '#FFFFFF',
    text: '25%',
    text2: 'كوبون\nخصم',
    render: ({ color, color2, text, text2, uid, fv }) => (
      <>
        <defs>
          <Grad id={`g${uid}`} color={color} amount={0.2} />
          {shadowFilter(`s${uid}`)}
        </defs>
        <path d="M14 6 H326 V52 A20 20 0 0 0 326 92 V144 H14 V92 A20 20 0 0 0 14 52 Z" fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
        <line x1="112" y1="16" x2="112" y2="134" stroke={withAlpha(color2, 0.7)} strokeWidth="3" strokeDasharray="4 8" strokeLinecap="round" />
        <StText text={text2} x={62} y={75} maxW={72} maxSize={28} color={color2} fv={fv} weight={700} />
        <StText text={text} x={226} y={75} maxW={182} maxSize={78} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:corner',
    label: 'شريط زاوية',
    cat: 'badge',
    vw: 200,
    vh: 200,
    color: '#D11A24',
    color2: '#FFFFFF',
    text: 'جديد',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>
          <clipPath id={`c${uid}`}>
            <rect x="0" y="0" width="200" height="200" rx="14" />
          </clipPath>
        </defs>
        <g clipPath={`url(#c${uid})`}>
          <path d="M40 0 H108 L200 92 V160 Z" fill={color} />
          <path d="M40 0 H108 L200 92 V160 Z" fill="none" stroke={withAlpha(color2, 0.35)} strokeWidth="2" strokeDasharray="4 6" transform="translate(-4 4)" />
          <StText text={text} x={138} y={62} maxW={78} maxSize={34} color={color2} fv={fv} rotate={45} />
        </g>
      </>
    ),
  },
  {
    id: 'b:bubble',
    label: 'فقاعة كلام',
    cat: 'badge',
    vw: 280,
    vh: 210,
    color: '#FFFFFF',
    color2: '#111214',
    text: 'هدية\nمجانية',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>{shadowFilter(`s${uid}`, 0.3)}</defs>
        <path d="M34 6 H246 Q274 6 274 34 V128 Q274 156 246 156 H128 L70 200 L84 156 H34 Q6 156 6 128 V34 Q6 6 34 6 Z" fill={color} filter={`url(#s${uid})`} />
        <StText text={text} x={140} y={82} maxW={200} maxSize={54} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:pill',
    label: 'زر دعوة',
    cat: 'badge',
    vw: 340,
    vh: 96,
    color: '#111214',
    color2: '#FFFFFF',
    text: 'اطلب الآن',
    render: ({ color, color2, text, uid, fv }) => {
      const ar = isArabicText(text)
      const cx = ar ? 52 : 288
      const tx = ar ? 196 : 152
      return (
        <>
          <defs>
            <Grad id={`g${uid}`} color={color} amount={0.2} />
            {shadowFilter(`s${uid}`, 0.3)}
          </defs>
          <rect x="4" y="6" width="332" height="84" rx="42" fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
          <circle cx={cx} cy="48" r="30" fill={color2} />
          <path
            d={ar ? 'M62 48 H42 M52 38 L42 48 L52 58' : 'M278 48 H298 M288 38 L298 48 L288 58'}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <StText text={text} x={tx} y={49} maxW={190} maxSize={44} color={color2} fv={fv} />
        </>
      )
    },
  },
  {
    id: 'b:pill-o',
    label: 'زر مفرّغ',
    cat: 'badge',
    vw: 340,
    vh: 96,
    color: '#D11A24',
    color2: '#D11A24',
    text: 'اعرف المزيد',
    render: ({ color, text, fv }) => (
      <>
        <rect x="6" y="8" width="328" height="80" rx="40" fill="none" stroke={color} strokeWidth="5" />
        <StText text={text} x={170} y={49} maxW={252} maxSize={42} color={color} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:hex',
    label: 'سداسي',
    cat: 'badge',
    vw: 210,
    vh: 190,
    color: '#1FBF8F',
    color2: '#FFFFFF',
    text: 'جودة\nعالية',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>
          <Grad id={`g${uid}`} color={color} />
          {shadowFilter(`s${uid}`)}
        </defs>
        <path d="M56 6 H154 Q162 6 166 13 L204 82 Q208 95 204 103 L166 172 Q162 184 154 184 H56 Q48 184 44 172 L6 103 Q2 95 6 82 L44 13 Q48 6 56 6 Z" fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
        <StText text={text} x={105} y={95} maxW={112} maxSize={42} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:medal',
    label: 'ميدالية',
    cat: 'badge',
    vw: 200,
    vh: 240,
    color: '#F0B429',
    color2: '#7A4A00',
    text: '1',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>
          <radialGradient id={`g${uid}`} cx="0.35" cy="0.3" r="0.85">
            <stop offset="0" stopColor={tint(color, 0.55)} />
            <stop offset="0.6" stopColor={color} />
            <stop offset="1" stopColor={shade(color, 0.3)} />
          </radialGradient>
          {shadowFilter(`s${uid}`)}
        </defs>
        <path d="M52 0 H92 L120 92 H80 Z" fill="#D11A24" />
        <path d="M148 0 H108 L80 92 H120 Z" fill="#A3111A" />
        <circle cx="100" cy="150" r="74" fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
        <circle cx="100" cy="150" r="60" fill="none" stroke={withAlpha(color2, 0.45)} strokeWidth="3" />
        <StText text={text} x={100} y={152} maxW={70} maxSize={84} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:stamp',
    label: 'ختم دائري',
    cat: 'badge',
    vw: 220,
    vh: 220,
    color: '#B3121C',
    color2: '#B3121C',
    text: 'خرافة',
    text2: '✕',
    render: ({ color, text, fv, uid }) => (
      <>
        <defs>
          <filter id={`r${uid}`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.4 2.95" result="m" />
            <feComposite in="SourceGraphic" in2="m" operator="in" />
          </filter>
        </defs>
        <g filter={`url(#r${uid})`} transform="rotate(-10 110 110)">
          <circle cx="110" cy="110" r="98" fill="none" stroke={color} strokeWidth="9" />
          <circle cx="110" cy="110" r="82" fill="none" stroke={color} strokeWidth="3.5" />
          <StText text={text} x={110} y={110} maxW={120} maxSize={54} color={color} fv={fv} />
        </g>
      </>
    ),
  },
  {
    id: 'b:stamp-r',
    label: 'ختم مستطيل',
    cat: 'badge',
    vw: 320,
    vh: 130,
    color: '#1FBF8F',
    color2: '#1FBF8F',
    text: 'حقيقة',
    render: ({ color, text, fv, uid }) => (
      <>
        <defs>
          <filter id={`r${uid}`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.4 2.95" result="m" />
            <feComposite in="SourceGraphic" in2="m" operator="in" />
          </filter>
        </defs>
        <g filter={`url(#r${uid})`} transform="rotate(-6 160 65)">
          <rect x="8" y="8" width="304" height="114" rx="14" fill="none" stroke={color} strokeWidth="9" />
          <rect x="24" y="24" width="272" height="82" rx="8" fill="none" stroke={color} strokeWidth="3" />
          <StText text={text} x={160} y={66} maxW={222} maxSize={62} color={color} fv={fv} />
        </g>
      </>
    ),
  },
  {
    id: 'b:chip-a',
    label: 'خيار أ (صح)',
    cat: 'badge',
    vw: 300,
    vh: 110,
    color: '#1FBF8F',
    color2: '#FFFFFF',
    text: 'صح',
    render: ({ color, color2, text, uid, fv, state }) => <Chip color={color} color2={color2} text={text} uid={uid} fv={fv} state={state} mark="check" />,
  },
  {
    id: 'b:chip-b',
    label: 'خيار ب (خطأ)',
    cat: 'badge',
    vw: 300,
    vh: 110,
    color: '#E4343E',
    color2: '#FFFFFF',
    text: 'خطأ',
    render: ({ color, color2, text, uid, fv, state }) => <Chip color={color} color2={color2} text={text} uid={uid} fv={fv} state={state} mark="cross" />,
  },
  {
    id: 'b:number',
    label: 'رقم',
    cat: 'badge',
    vw: 140,
    vh: 140,
    color: '#D11A24',
    color2: '#FFFFFF',
    text: '01',
    render: ({ color, color2, text, uid, fv }) => (
      <>
        <defs>
          <Grad id={`g${uid}`} color={color} />
          {shadowFilter(`s${uid}`)}
        </defs>
        <circle cx="70" cy="70" r="62" fill={`url(#g${uid})`} filter={`url(#s${uid})`} />
        <StText text={text} x={70} y={72} maxW={78} maxSize={64} color={color2} fv={fv} />
      </>
    ),
  },
  {
    id: 'b:stars',
    label: 'تقييم نجوم',
    cat: 'badge',
    vw: 320,
    vh: 70,
    color: '#F5B301',
    color2: '#D9D9DE',
    text: '5',
    render: ({ color, color2, text, uid }) => {
      const v = Math.max(0, Math.min(5, parseFloat(text) || 0))
      const star = (i: number) => starPath(32 + i * 64, 35, 5, 27, 11.5)
      return (
        <>
          <defs>
            <clipPath id={`c${uid}`}>
              <rect x="0" y="0" width={v * 64} height="70" />
            </clipPath>
          </defs>
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={star(i)} fill={color2} />
          ))}
          <g clipPath={`url(#c${uid})`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <path key={i} d={star(i)} fill={color} />
            ))}
          </g>
        </>
      )
    },
  },
  {
    id: 'b:tape',
    label: 'شريط لاصق',
    cat: 'badge',
    vw: 320,
    vh: 96,
    color: '#FFD23F',
    color2: '#111214',
    text: 'انتبه',
    render: ({ color, color2, text, fv }) => (
      <>
        <path d="M8 10 L20 20 L8 30 L20 40 L8 50 L20 60 L8 70 L20 80 L8 88 H312 L300 80 L312 70 L300 60 L312 50 L300 40 L312 30 L300 20 L312 10 Z" fill={withAlpha(color, 0.92)} />
        <StText text={text} x={160} y={49} maxW={230} maxSize={44} color={color2} fv={fv} />
      </>
    ),
  },
]

function Chip({ color, color2, text, uid, fv, state, mark }: { color: string; color2: string; text: string; uid: string; fv: number; state: AnswerState; mark: 'check' | 'cross' }) {
  const chosen = state === 'chosen'
  const dim = state === 'dim'
  const fill = chosen ? color : color2
  const ink = chosen ? color2 : color
  const stroke = color
  return (
    <g opacity={dim ? 0.38 : 1}>
      <defs>
        <Grad id={`g${uid}`} color={color} amount={0.18} />
        {shadowFilter(`s${uid}`, chosen ? 0.4 : 0.16)}
        <filter id={`glow${uid}`} x="-30%" y="-40%" width="160%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      {chosen && <rect x="10" y="14" width="280" height="84" rx="42" fill={color} opacity="0.55" filter={`url(#glow${uid})`} />}
      <rect x="6" y="8" width="288" height="94" rx="47" fill={chosen ? `url(#g${uid})` : fill} stroke={stroke} strokeWidth={chosen ? 0 : 5} filter={`url(#s${uid})`} />
      <circle cx="58" cy="55" r="32" fill={chosen ? color2 : color} />
      <path
        d={mark === 'check' ? 'M43 56 L54 67 L74 44' : 'M45 41 L71 67 M71 41 L45 67'}
        fill="none"
        stroke={chosen ? color : color2}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <StText text={text} x={186} y={56} maxW={148} maxSize={54} color={ink} fv={fv} />
    </g>
  )
}

/* ------------------------------ الأشكال ------------------------------ */

const S = (id: string, label: string, vw: number, vh: number, color: string, color2: string, render: StickerDef['render'], extra: Partial<StickerDef> = {}): StickerDef => ({
  id,
  label,
  cat: 'shape',
  vw,
  vh,
  color,
  color2,
  render,
  ...extra,
})

const shapes: StickerDef[] = [
  S('s:blob1', 'شكل عضوي ١', 200, 200, '#FF8F96', '#FFC9B8', ({ color, color2, uid }) => (
    <>
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={color2} />
        </linearGradient>
      </defs>
      <path d="M152.6 40.2C168 55 176 78 172 100c-4 22-20 40-40 52s-46 18-68 8C44 150 32 124 30 100S38 50 62 34c24-16 60-9 90 6Z" fill={`url(#g${uid})`} />
    </>
  )),
  S('s:blob2', 'شكل عضوي ٢', 200, 200, '#7C3AED', '#EC4899', ({ color, color2, uid }) => (
    <>
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={color2} />
        </linearGradient>
      </defs>
      <path d="M45 30c28-26 84-20 108 10 26 32 22 82-6 110-30 30-88 34-114 2C8 118 18 56 45 30Z" fill={`url(#g${uid})`} />
    </>
  )),
  S('s:circle', 'دائرة', 200, 200, '#D11A24', '#D11A24', ({ color }) => <circle cx="100" cy="100" r="96" fill={color} />),
  S('s:ring', 'حلقة', 200, 200, '#D11A24', '#D11A24', ({ color, strokeW }) => <circle cx="100" cy="100" r={96 - strokeW / 2} fill="none" stroke={color} strokeWidth={strokeW} />, { strokeW: 10 }),
  S('s:square', 'مربع مدوّر', 200, 200, '#111214', '#111214', ({ color }) => <rect x="4" y="4" width="192" height="192" rx="34" fill={color} />),
  S('s:squircle', 'سكويركل', 200, 200, '#111214', '#111214', ({ color }) => <path d="M100 4C184 4 196 16 196 100S184 196 100 196 4 184 4 100 16 4 100 4Z" fill={color} />),
  S('s:triangle', 'مثلث', 200, 180, '#FFD23F', '#FFD23F', ({ color }) => <path d="M100 8 L192 172 H8 Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth="10" />),
  S('s:star', 'نجمة', 200, 200, '#F5B301', '#F5B301', ({ color }) => <path d={starPath(100, 104, 5, 96, 40)} fill={color} strokeLinejoin="round" stroke={color} strokeWidth="6" />),
  S('s:sparkle', 'لمعة', 200, 200, '#FFD23F', '#FFD23F', ({ color }) => <path d="M100 4 C108 70 130 92 196 100 C130 108 108 130 100 196 C92 130 70 108 4 100 C70 92 92 70 100 4Z" fill={color} />),
  S('s:heart', 'قلب', 200, 180, '#E4343E', '#E4343E', ({ color }) => <path d="M100 172 C40 128 6 96 6 58 C6 30 28 10 54 10 C74 10 90 20 100 38 C110 20 126 10 146 10 C172 10 194 30 194 58 C194 96 160 128 100 172Z" fill={color} />),
  S('s:plus', 'إشارة +', 200, 200, '#D11A24', '#D11A24', ({ color }) => <path d="M76 8 H124 V76 H192 V124 H124 V192 H76 V124 H8 V76 H76 Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth="10" />),
  S('s:diamond', 'معين', 200, 200, '#2A6BFF', '#2A6BFF', ({ color }) => <path d="M100 4 L196 100 L100 196 L4 100 Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth="10" />),
  S('s:arch', 'قوس', 200, 240, '#FFE3E1', '#FFE3E1', ({ color }) => <path d="M6 234 V100 A94 94 0 0 1 194 100 V234 Z" fill={color} />),
  S('s:semi', 'نصف دائرة', 200, 110, '#D11A24', '#D11A24', ({ color }) => <path d="M4 106 A96 96 0 0 1 196 106 Z" fill={color} />),
  S('s:wave', 'خط متموج', 320, 60, '#D11A24', '#D11A24', ({ color, strokeW }) => <path d="M8 30 C 40 -6, 70 66, 100 30 S 160 -6, 190 30 S 250 66, 280 30 S 312 12, 316 30" fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />, { strokeW: 9 }),
  S('s:zigzag', 'زجزاج', 320, 60, '#111214', '#111214', ({ color, strokeW }) => <path d="M8 46 L48 12 L88 46 L128 12 L168 46 L208 12 L248 46 L288 12 L312 34" fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />, { strokeW: 9 }),
  S('s:squiggle', 'تسطير بالفرشاة', 320, 40, '#D11A24', '#D11A24', ({ color, strokeW }) => <path d="M6 26 C 60 8, 110 34, 170 18 S 270 10, 314 22" fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />, { strokeW: 10 }),
  S('s:brush', 'ضربة فرشاة', 340, 90, '#FFD23F', '#FFD23F', ({ color }) => <path d="M6 52 C 30 20, 70 14, 120 22 C 190 4, 260 12, 330 30 C 338 44, 322 66, 296 72 C 240 90, 170 76, 110 82 C 66 90, 20 82, 6 52Z" fill={color} />),
  S('s:dashcircle', 'دائرة متقطعة', 200, 200, '#D11A24', '#D11A24', ({ color, strokeW }) => <circle cx="100" cy="100" r={94 - strokeW / 2} fill="none" stroke={color} strokeWidth={strokeW} strokeDasharray="2 14" strokeLinecap="round" />, { strokeW: 7 }),
  S('s:brackets', 'أقواس زوايا', 200, 200, '#111214', '#111214', ({ color, strokeW }) => <path d="M8 60 V8 H60 M140 8 H192 V60 M192 140 V192 H140 M60 192 H8 V140" fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="square" />, { strokeW: 8 }),
  S('s:halftone', 'نقاط هافتون', 200, 200, '#D11A24', '#D11A24', ({ color }) => (
    <>
      {Array.from({ length: 81 }).map((_, i) => {
        const x = i % 9
        const y = Math.floor(i / 9)
        const d = Math.hypot(x - 4, y - 4)
        const r = Math.max(0, 9.5 - d * 1.9)
        return r > 0.6 ? <circle key={i} cx={12 + x * 22} cy={12 + y * 22} r={r} fill={color} /> : null
      })}
    </>
  )),
  S('s:rays', 'أشعة', 200, 200, '#FFD23F', '#FFD23F', ({ color }) => (
    <>
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2
        const a2 = a + 0.13
        return <path key={i} d={`M100 100 L${100 + 98 * Math.cos(a)} ${100 + 98 * Math.sin(a)} L${100 + 98 * Math.cos(a2)} ${100 + 98 * Math.sin(a2)} Z`} fill={color} />
      })}
    </>
  )),
  S('s:confetti', 'قصاصات احتفال', 240, 200, '#D11A24', '#FFD23F', ({ color, color2 }) => (
    <>
      {[
        [30, 30, 0, 1], [90, 14, 30, 2], [160, 40, -20, 1], [210, 20, 50, 2], [50, 100, 70, 2], [120, 84, -40, 1],
        [190, 110, 20, 2], [24, 170, -30, 1], [100, 160, 45, 2], [170, 176, 10, 1], [220, 150, -60, 2],
      ].map(([x, y, r, k], i) => (
        <rect key={i} x={x} y={y} width={k === 1 ? 26 : 12} height={k === 1 ? 10 : 22} rx="3" fill={i % 3 === 0 ? color : i % 3 === 1 ? color2 : tint(color, 0.35)} transform={`rotate(${r} ${x + 6} ${y + 6})`} />
      ))}
    </>
  )),
  S('s:sparkles', 'لمعات', 220, 200, '#FFD23F', '#FFFFFF', ({ color, color2 }) => (
    <>
      <path d="M90 20 C96 70 116 88 168 94 C116 100 96 118 90 170 C84 118 64 100 12 94 C64 88 84 70 90 20Z" fill={color} />
      <path d="M170 10 C173 34 182 42 206 45 C182 48 173 56 170 80 C167 56 158 48 134 45 C158 42 167 34 170 10Z" fill={color2} stroke={color} strokeWidth="2" />
      <path d="M176 120 C178 138 184 144 202 146 C184 148 178 154 176 172 C174 154 168 148 150 146 C168 144 174 138 176 120Z" fill={color} />
    </>
  )),
]

/* ------------------------------ الأسهم ------------------------------ */

/** رأس سهم يُحسب من نقطة النهاية واتجاه الوصول إليها */
function headPath(tx: number, ty: number, px: number, py: number, len = 44, deg = 30): string {
  const a = Math.atan2(ty - py, tx - px)
  const r = (deg * Math.PI) / 180
  const p1 = [tx - len * Math.cos(a - r), ty - len * Math.sin(a - r)]
  const p2 = [tx - len * Math.cos(a + r), ty - len * Math.sin(a + r)]
  return `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${tx} ${ty} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
}

const A = (id: string, label: string, vw: number, vh: number, d: string, head: string | null, fill = false): StickerDef => ({
  id,
  label,
  cat: 'arrow',
  vw,
  vh,
  color: '#D11A24',
  color2: '#D11A24',
  strokeW: fill ? 0 : 9,
  render: ({ color, strokeW }) =>
    fill ? (
      <path d={d} fill={color} strokeLinejoin="round" stroke={color} strokeWidth="8" />
    ) : (
      <g fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
        {head && <path d={head} />}
      </g>
    ),
})

const arrows: StickerDef[] = [
  A('a:straight', 'سهم مستقيم', 220, 100, 'M12 50 H200', headPath(200, 50, 12, 50)),
  A('a:straight-l', 'سهم لليسار', 220, 100, 'M208 50 H20', headPath(20, 50, 208, 50)),
  A('a:curve', 'سهم منحني', 220, 180, 'M14 160 C 34 40, 120 6, 190 62', headPath(190, 62, 120, 6)),
  A('a:curve-l', 'سهم منحني لليسار', 220, 180, 'M206 160 C 186 40, 100 6, 30 62', headPath(30, 62, 100, 6)),
  A('a:bent', 'سهم بزاوية', 200, 200, 'M24 20 V150 H168', headPath(168, 150, 24, 150)),
  A('a:loop', 'سهم دائري', 240, 200, 'M14 150 C 60 20, 160 10, 150 84 C 142 138, 66 116, 100 66 C 130 24, 190 30, 224 64', headPath(224, 64, 190, 30)),
  A('a:down', 'سهم لأسفل', 100, 200, 'M50 12 V180', headPath(50, 182, 50, 12)),
  A('a:double', 'أسهم مزدوجة', 200, 200, 'M40 30 L100 100 L40 170', 'M100 30 L160 100 L100 170'),
  A('a:block', 'سهم عريض', 240, 130, 'M8 42 H140 V10 L232 65 L140 120 V88 H8 Z', null, true),
  A('a:block-l', 'سهم عريض لليسار', 240, 130, 'M232 42 H100 V10 L8 65 L100 120 V88 H232 Z', null, true),
]

/* ------------------------------ الأيقونات ------------------------------ */

export const ICON_LIST: [string, LucideIcon, string][] = [
  ['Truck', Truck, 'شحن'], ['ShieldCheck', ShieldCheck, 'ضمان'], ['BadgePercent', BadgePercent, 'خصم'], ['Gift', Gift, 'هدية'], ['Flame', Flame, 'رائج'],
  ['Zap', Zap, 'سرعة'], ['Star', Star, 'نجمة'], ['Heart', Heart, 'إعجاب'], ['Crown', Crown, 'مميز'], ['Clock', Clock, 'وقت'], ['Phone', Phone, 'هاتف'],
  ['MessageCircle', MessageCircle, 'رسالة'], ['Globe', Globe, 'موقع'], ['MapPin', MapPin, 'موقع جغرافي'], ['Mail', Mail, 'بريد'], ['ShoppingCart', ShoppingCart, 'سلة'],
  ['ThumbsUp', ThumbsUp, 'موافقة'], ['Sparkles', Sparkles, 'لمعة'], ['Leaf', Leaf, 'طبيعي'], ['Ban', Ban, 'ممنوع'], ['Wrench', Wrench, 'صيانة'], ['Wifi', Wifi, 'واي فاي'],
  ['Printer', Printer, 'طابعة'], ['Laptop', Laptop, 'حاسوب'], ['Camera', Camera, 'كاميرا'], ['Check', Check, 'صح'], ['X', X, 'خطأ'], ['Award', Award, 'جائزة'],
  ['Medal', Medal, 'ميدالية'], ['BadgeCheck', BadgeCheck, 'موثّق'], ['Percent', Percent, 'نسبة'], ['Tag', Tag, 'سعر'], ['Timer', Timer, 'مؤقت'], ['Lock', Lock, 'حماية'],
  ['Cloud', Cloud, 'سحابة'], ['Headphones', Headphones, 'دعم'], ['Calendar', Calendar, 'تاريخ'], ['Cpu', Cpu, 'معالج'], ['Droplets', Droplets, 'حبر'], ['CreditCard', CreditCard, 'بطاقة'],
  ['Package', Package, 'طرد'], ['Rocket', Rocket, 'إطلاق'], ['Trophy', Trophy, 'كأس'], ['Lightbulb', Lightbulb, 'فكرة'], ['Bell', Bell, 'تنبيه'], ['Megaphone', Megaphone, 'إعلان'],
  ['Users', Users, 'فريق'], ['Handshake', Handshake, 'شراكة'], ['Smile', Smile, 'رضا'], ['House', House, 'منزل'], ['CircleHelp', CircleHelp, 'سؤال'], ['TriangleAlert', TriangleAlert, 'تحذير'],
  ['Info', Info, 'معلومة'], ['Search', Search, 'بحث'], ['Battery', Battery, 'بطارية'], ['Server', Server, 'خادم'], ['HardDrive', HardDrive, 'تخزين'], ['Monitor', Monitor, 'شاشة'],
  ['Smartphone', Smartphone, 'هاتف ذكي'], ['Projector', Projector, 'بروجكتر'], ['ScanBarcode', ScanBarcode, 'باركود'], ['Fingerprint', Fingerprint, 'بصمة'], ['Plug', Plug, 'طاقة'],
  ['Cable', Cable, 'كبل'], ['CircleCheck', CircleCheck, 'تم'], ['CircleX', CircleX, 'مرفوض'], ['Brain', Brain, 'ذكاء'], ['Microscope', Microscope, 'علم'], ['FlaskConical', FlaskConical, 'مختبر'],
  ['Atom', Atom, 'ذرة'], ['BookOpen', BookOpen, 'معرفة'], ['GraduationCap', GraduationCap, 'تعليم'], ['Quote', Quote, 'اقتباس'], ['Eye', Eye, 'رؤية'], ['Recycle', Recycle, 'تدوير'],
  ['Sun', Sun, 'شمس'], ['Snowflake', Snowflake, 'تبريد'], ['Coffee', Coffee, 'قهوة'], ['Car', Car, 'سيارة'], ['Plane', Plane, 'سفر'], ['Video', Video, 'فيديو'], ['Link', Link, 'رابط'],
  ['Bookmark', Bookmark, 'حفظ'], ['Flag', Flag, 'علم'], ['Key', Key, 'مفتاح'], ['Code', Code, 'برمجة'], ['Database', Database, 'بيانات'], ['Network', Network, 'شبكة'], ['Router', Router, 'راوتر'],
  ['Keyboard', Keyboard, 'لوحة مفاتيح'], ['Mouse', Mouse, 'فأرة'], ['Speaker', Speaker, 'صوت'], ['Watch', Watch, 'ساعة'], ['Wallet', Wallet, 'محفظة'], ['Banknote', Banknote, 'نقد'],
  ['Coins', Coins, 'عملات'], ['Receipt', Receipt, 'فاتورة'], ['TrendingUp', TrendingUp, 'نمو'], ['Target', Target, 'هدف'], ['CircleDollarSign', CircleDollarSign, 'دولار'], ['Scissors', Scissors, 'قص'],
  ['PartyPopper', PartyPopper, 'احتفال'], ['Bot', Bot, 'روبوت'], ['Shield', Shield, 'أمان'], ['Stamp', Stamp, 'ختم'], ['ClipboardCheck', ClipboardCheck, 'قائمة'], ['ListChecks', ListChecks, 'مهام'],
]

const ICON_MAP = new Map(ICON_LIST.map(([n, C]) => [n, C]))

const icons: StickerDef[] = ICON_LIST.map(([name, , label]) => ({
  id: `i:${name}`,
  label,
  cat: 'icon' as const,
  vw: 100,
  vh: 100,
  color: '#FFFFFF',
  color2: '#D11A24',
  strokeW: 2,
  render: () => null,
}))

export const STICKERS: StickerDef[] = [...badges, ...shapes, ...arrows, ...icons]
const BY_ID = new Map(STICKERS.map((s) => [s.id, s]))

export function findSticker(id: string): StickerDef | undefined {
  return BY_ID.get(id)
}

/** حجم افتراضي عند الإضافة (بحسب نسبة الملصق) */
export function defaultStickerSize(def: StickerDef): { w: number; h: number } {
  const base = def.cat === 'icon' ? 150 : def.cat === 'arrow' ? 240 : def.vw >= 300 ? 340 : 220
  const k = base / Math.max(def.vw, def.vh)
  return { w: Math.round(def.vw * k), h: Math.round(def.vh * k) }
}

/* ------------------------------ عرض الملصق ------------------------------ */

export function StickerView({
  spec,
  color,
  color2,
  answer,
  role,
}: {
  spec: StickerSpec
  color: string
  color2: string
  answer?: 'a' | 'b' | null
  role?: 'a' | 'b'
}) {
  const uid = useId().replace(/:/g, '')
  const fv = useEditor((s) => s.fontsVersion)
  const def = findSticker(spec.id)
  if (!def) return null
  if (def.cat === 'icon') {
    const Icon = ICON_MAP.get(spec.id.slice(2))
    const bg = spec.bg ?? 'circle'
    if (!Icon) return null
    const sw = spec.strokeW ?? 2
    const pad = bg === 'none' ? 6 : 24
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
        {bg === 'circle' && <circle cx="50" cy="50" r="50" fill={color2} />}
        {bg === 'rounded' && <rect x="0" y="0" width="100" height="100" rx="22" fill={color2} />}
        {bg === 'squircle' && <path d="M50 0C92 0 100 8 100 50S92 100 50 100 0 92 0 50 8 0 50 0Z" fill={color2} />}
        <Icon x={pad} y={pad} width={100 - pad * 2} height={100 - pad * 2} color={color} strokeWidth={sw} />
      </svg>
    )
  }
  const state: AnswerState = role && answer ? (answer === role ? 'chosen' : 'dim') : 'neutral'
  return (
    <svg viewBox={`0 0 ${def.vw} ${def.vh}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
      {def.render({ color, color2, text: spec.text ?? '', text2: spec.text2 ?? '', uid, fv, strokeW: spec.strokeW ?? def.strokeW ?? 8, state })}
    </svg>
  )
}

/** عبارات جاهزة (ملصق + نص + ألوان) للإضافة بنقرة */
export interface StickerPreset {
  label: string
  spec: StickerSpec
  color: string
  color2: string
  w?: number
}

export const STICKER_PRESETS: StickerPreset[] = [
  { label: 'جديد', spec: { id: 'b:burst', text: 'جديد' }, color: '#D11A24', color2: '#FFFFFF' },
  { label: 'NEW', spec: { id: 'b:seal', text: 'NEW' }, color: '#111214', color2: '#F5C542' },
  { label: 'خصم 50%', spec: { id: 'b:discount', text: '50%', text2: 'خصم' }, color: '#D11A24', color2: '#FFFFFF' },
  { label: 'SALE', spec: { id: 'b:sale', text: 'SALE' }, color: '#FFD23F', color2: '#B3121C' },
  { label: 'شحن مجاني', spec: { id: 'b:banner', text: 'شحن مجاني' }, color: '#D11A24', color2: '#FFFFFF', w: 380 },
  { label: 'الأكثر مبيعاً', spec: { id: 'b:banner', text: 'الأكثر مبيعاً' }, color: '#B8860B', color2: '#FFF7DC', w: 380 },
  { label: 'أصلي 100%', spec: { id: 'b:seal', text: 'أصلي\n100%' }, color: '#D11A24', color2: '#FFFFFF' },
  { label: 'ضمان سنة', spec: { id: 'b:shield', text: 'ضمان\nسنة' }, color: '#1B2A4A', color2: '#FFFFFF' },
  { label: 'كمية محدودة', spec: { id: 'b:tag', text: 'كمية محدودة' }, color: '#111214', color2: '#FFFFFF', w: 340 },
  { label: 'عرض خاص', spec: { id: 'b:pill', text: 'عرض خاص' }, color: '#D11A24', color2: '#FFFFFF', w: 340 },
  { label: 'اطلب الآن', spec: { id: 'b:pill', text: 'اطلب الآن' }, color: '#111214', color2: '#FFFFFF', w: 340 },
  { label: 'وفّر 30%', spec: { id: 'b:ticket', text: '30%', text2: 'وفّر\nالآن' }, color: '#D11A24', color2: '#FFFFFF', w: 360 },
  { label: 'هدية مجانية', spec: { id: 'b:bubble', text: 'هدية\nمجانية' }, color: '#FFFFFF', color2: '#111214' },
  { label: 'جودة عالية', spec: { id: 'b:hex', text: 'جودة\nعالية' }, color: '#1FBF8F', color2: '#FFFFFF' },
  { label: 'حقيقة ✓', spec: { id: 'b:stamp-r', text: 'حقيقة' }, color: '#1FBF8F', color2: '#1FBF8F', w: 360 },
  { label: 'خرافة ✕', spec: { id: 'b:stamp', text: 'خرافة' }, color: '#B3121C', color2: '#B3121C' },
  { label: 'انتبه', spec: { id: 'b:tape', text: 'انتبه' }, color: '#FFD23F', color2: '#111214', w: 360 },
  { label: 'تقييم 5 نجوم', spec: { id: 'b:stars', text: '5' }, color: '#F5B301', color2: '#D9D9DE', w: 340 },
]

export const STICKER_CATS: { id: StickerCat | 'preset'; label: string }[] = [
  { id: 'preset', label: 'جاهزة' },
  { id: 'badge', label: 'شارات' },
  { id: 'shape', label: 'أشكال' },
  { id: 'arrow', label: 'أسهم' },
  { id: 'icon', label: 'أيقونات' },
]
