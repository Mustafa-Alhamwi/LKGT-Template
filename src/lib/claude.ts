import type Anthropic from '@anthropic-ai/sdk'
import { categoryDef } from '../model/categories'
import { TONES, toHashtag, type CopyBrief, type CopyOption, type CopyTexts } from './copywriter'

/* ------------------------------------------------------------------
 * وضع Claude (اختياري): كتابة أذكى عبر واجهة Anthropic مباشرة من المتصفح.
 * المفتاح يبقى على جهازك ويُرسل إلى Anthropic فقط. المكتبة تُحمَّل عند أول استخدام.
 * ------------------------------------------------------------------ */

export const AI_MODELS = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', hint: 'الأسرع والأوفر — يكفي لمعظم النصوص' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', hint: 'متوازن — صياغة أغنى' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5', hint: 'الأدق والأبدع — أبطأ وأغلى' },
]

export type AiErrorKind = 'auth' | 'rate' | 'network' | 'bad' | 'refusal' | 'other'

export class AiError extends Error {
  kind: AiErrorKind
  constructor(kind: AiErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

const SYSTEM = `You are a senior Arabic social-media copywriter for LKGT, an Arabic-speaking company that publishes Instagram posts. You write short, punchy copy in clear Modern Standard Arabic (light and friendly; use a dialect only if the extra instructions ask for it).

You receive a JSON brief and must return exactly the requested number of DISTINCT options.

Rules:
- The text fields are placed inside a graphic design, so they must be SHORT: kicker ≤ 3 words; tagline ≤ 12 words; cta ≤ 4 words; note ≤ 10 words; subtitle ≤ 8 words; features: 2–4 items of ≤ 4 words each.
- You may wrap ONE key word or short phrase in *asterisks* inside "tagline" and "title" to highlight it, for example: "اجعل *يومك* أسهل".
- NEVER invent product specifications, prices, numbers, dates, guarantees, awards or statistics that are not in the brief. If a field cannot be written without inventing facts, return an empty string (or an empty array) for it.
- Categories "ads" and "offers": "title" is the product name — return it exactly as given (or empty). Write kicker, tagline, cta, and (only from given keywords) subtitle/features. For "offers" also write a short "note" about the offer duration ONLY in generic wording (e.g. "العرض لفترة محدودة").
- Categories "truefalse", "factmyth", "didyouknow": "title" is the claim/fact itself, polished but with the SAME meaning. "tagline" is the explanation/answer only if the brief contains it; otherwise empty. Do not add facts of your own. "cta" invites interaction.
- "caption": a ready-to-post Instagram caption in Arabic: a hook line, 1–3 short lines of body, a call to action, and the contact line if one is provided. Use emojis that match the tone (formal and luxury tones: few or none). Do NOT put hashtags inside the caption.
- "hashtags": 5–8 relevant hashtags (Arabic and/or English), each starting with #, without spaces (use underscores).
- Fields that do not apply to the category must be "" (or []).
- Respect the requested tone strictly and make the options clearly different from each other in wording and structure.`

const SCHEMA = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kicker: { type: 'string' },
          title: { type: 'string' },
          subtitle: { type: 'string' },
          tagline: { type: 'string' },
          note: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          cta: { type: 'string' },
          caption: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
        },
        required: ['kicker', 'title', 'subtitle', 'tagline', 'note', 'features', 'cta', 'caption', 'hashtags'],
        additionalProperties: false,
      },
    },
  },
  required: ['options'],
  additionalProperties: false,
} as const

interface RawOption {
  kicker?: string
  title?: string
  subtitle?: string
  tagline?: string
  note?: string
  features?: string[]
  cta?: string
  caption?: string
  hashtags?: string[]
}

async function client(apiKey: string) {
  const { default: Sdk } = await import('@anthropic-ai/sdk')
  return { Sdk, api: new Sdk({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 }) }
}

function explain(Sdk: typeof Anthropic, e: unknown): AiError {
  if (e instanceof AiError) return e
  if (e instanceof Sdk.AuthenticationError || e instanceof Sdk.PermissionDeniedError) return new AiError('auth', 'مفتاح Claude غير صحيح أو لا يملك صلاحية — راجع المفتاح في الإعدادات.')
  if (e instanceof Sdk.RateLimitError) return new AiError('rate', 'تجاوزت حدّ الطلبات مؤقتاً — انتظر قليلاً ثم أعد المحاولة.')
  if (e instanceof Sdk.APIConnectionError) return new AiError('network', 'تعذّر الاتصال بخدمة Claude — تحقق من الإنترنت.')
  if (e instanceof Sdk.BadRequestError) return new AiError('bad', `رفض Claude الطلب: ${e.message}`)
  if (e instanceof Sdk.APIError) return new AiError('other', `خطأ من خدمة Claude (${e.status ?? '؟'}): ${e.message}`)
  return new AiError('other', String((e as Error)?.message ?? e))
}

function parseJson(text: string): { options?: RawOption[] } | null {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(t)
  } catch {
    const a = t.indexOf('{')
    const b = t.lastIndexOf('}')
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+\n/g, '\n').trim() : '')

function toOption(raw: RawOption, i: number, brief: CopyBrief): CopyOption {
  const t: CopyTexts = {}
  const keepTitle = brief.category === 'truefalse' || brief.category === 'factmyth' || brief.category === 'didyouknow'
  if (str(raw.kicker)) t.kicker = str(raw.kicker)
  if (keepTitle && str(raw.title)) t.title = str(raw.title)
  if (str(raw.subtitle)) t.subtitle = str(raw.subtitle)
  if (str(raw.tagline)) t.tagline = str(raw.tagline)
  if (str(raw.note)) t.note = str(raw.note)
  if (str(raw.cta)) t.cta = str(raw.cta)
  const feats = (raw.features ?? []).map(str).filter(Boolean).slice(0, 5)
  if (feats.length) t.features = feats
  const tags = (raw.hashtags ?? [])
    .map((h) => toHashtag(str(h).replace(/^#+/, '')))
    .filter(Boolean)
    .filter((h, idx, arr) => arr.indexOf(h) === idx)
    .slice(0, 10)
  return { id: `c${Date.now().toString(36)}-${i}`, texts: t, caption: str(raw.caption), hashtags: tags, source: 'claude' }
}

/** يولّد خيارات نصية عبر Claude */
export async function generateWithClaude(brief: CopyBrief, cfg: { apiKey: string; model: string; count?: number }): Promise<CopyOption[]> {
  const count = cfg.count ?? 5
  const { Sdk, api } = await client(cfg.apiKey)
  const cat = categoryDef(brief.category)
  const tone = TONES.find((t) => t.id === brief.tone)
  const payload = {
    count,
    category: { id: cat.id, name: cat.name },
    fieldMeaning: cat.labels,
    tone: tone ? `${tone.label} (${tone.hint})` : brief.tone,
    subject: brief.subject,
    keywords: brief.keywords,
    price: brief.price || undefined,
    oldPrice: brief.oldPrice || undefined,
    discount: brief.discount || undefined,
    contactLine: brief.contact || undefined,
    extraInstructions: brief.extra || undefined,
  }
  const needsEffort = cfg.model.includes('opus-5') || cfg.model.includes('sonnet-5')
  const call = (structured: boolean) =>
    api.messages.create({
      model: cfg.model,
      max_tokens: 12000,
      system: structured ? SYSTEM : `${SYSTEM}\n\nReturn ONLY a JSON object of the form {"options":[{...}]} with the fields kicker, title, subtitle, tagline, note, features, cta, caption, hashtags. No prose.`,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
      ...(structured ? { output_config: { ...(needsEffort ? { effort: 'low' as const } : {}), format: { type: 'json_schema' as const, schema: SCHEMA as unknown as Record<string, unknown> } } } : {}),
    })
  try {
    let msg
    try {
      msg = await call(true)
    } catch (e) {
      // بعض النماذج لا تدعم الإخراج المنظّم أو مستوى الجهد — نعيد بدون ذلك
      if (e instanceof Sdk.BadRequestError) msg = await call(false)
      else throw e
    }
    if (msg.stop_reason === 'refusal') throw new AiError('refusal', 'رفض Claude كتابة هذا المحتوى — جرّب صياغة أخرى للموضوع.')
    const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    const data = parseJson(text)
    if (!data?.options?.length) throw new AiError('other', 'لم يُرجع Claude نتيجة مفهومة — أعد المحاولة.')
    return data.options.slice(0, count).map((o, i) => toOption(o, i, brief))
  } catch (e) {
    throw explain(Sdk, e)
  }
}

/** اختبار سريع للمفتاح والنموذج */
export async function testClaude(apiKey: string, model: string): Promise<void> {
  const { Sdk, api } = await client(apiKey)
  try {
    await api.messages.create({ model, max_tokens: 64, messages: [{ role: 'user', content: 'ping' }] })
  } catch (e) {
    throw explain(Sdk, e)
  }
}
