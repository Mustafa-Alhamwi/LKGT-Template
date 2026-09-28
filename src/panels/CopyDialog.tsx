import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, KeyRound, Loader2, PenLine, RefreshCw, Sparkles, WandSparkles } from 'lucide-react'
import { Btn, Chips, Empty } from '../ui/kit'
import { Modal } from './Dialogs'
import { changeContent, toast, useEditor } from '../store/editor'
import { categoryDef } from '../model/categories'
import type { AdTexts, TextKey } from '../model/types'
import { EMPTY_BRIEF, TONES, generateLocal, splitKeywords, type CopyBrief, type CopyOption, type CopyTexts } from '../lib/copywriter'
import { AiError, generateWithClaude } from '../lib/claude'
import { copyText } from '../lib/clipboard'

const close = () => useEditor.setState({ dialog: null })

const ORDER: (keyof CopyTexts)[] = ['kicker', 'title', 'tagline', 'subtitle', 'features', 'note', 'price', 'cta']

/** *كلمة* → مُبرزة */
function Accent({ text }: { text: string }) {
  const parts = text.split('*')
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <em key={i}>{p}</em> : <span key={i}>{p}</span>))}
    </>
  )
}

const isPlaceholder = (cat: ReturnType<typeof categoryDef>, k: keyof AdTexts, v: string) => {
  const ph = cat.placeholders[k]
  return !v || (typeof ph === 'string' && v === ph)
}

function initialBrief(): CopyBrief {
  const s = useEditor.getState()
  const d = s.design
  const cat = categoryDef(d.category)
  const t = d.content.texts
  const brand = s.brand
  const keywords = Array.isArray(t.features) && d.touched ? t.features.filter(Boolean) : []
  const contact = [brand.phone && `📞 ${brand.phone}`, brand.website && `🌐 ${brand.website}`, brand.instagram && `📷 ${brand.instagram}`].filter(Boolean).join('  ')
  return {
    ...EMPTY_BRIEF,
    category: cat.id,
    subject: d.touched && !isPlaceholder(cat, 'title', t.title) ? t.title : '',
    keywords,
    price: !isPlaceholder(cat, 'price', t.price) ? t.price : '',
    oldPrice: !isPlaceholder(cat, 'oldPrice', t.oldPrice) ? t.oldPrice : '',
    discount: !isPlaceholder(cat, 'discount', t.discount) ? t.discount : '',
    contact,
    brandTag: /^[\w؀-ۿ ]+$/.test(brand.name) ? brand.name.replace(/\s+/g, '') : '',
  }
}

export function CopyDialog() {
  const prefs = useEditor((s) => s.prefs)
  const category = useEditor((s) => s.design.category)
  const cat = categoryDef(category)
  const init = useMemo(initialBrief, [])
  const [subject, setSubject] = useState(init.subject)
  const [kw, setKw] = useState(init.keywords.join('، '))
  const [tone, setTone] = useState<CopyBrief['tone']>('friendly')
  const [price, setPrice] = useState(init.price)
  const [oldPrice, setOldPrice] = useState(init.oldPrice)
  const [discount, setDiscount] = useState(init.discount)
  const [extra, setExtra] = useState('')
  const [withContact, setWithContact] = useState(true)
  const [mode, setMode] = useState<'local' | 'claude'>('local')
  const [seed, setSeed] = useState(1)
  const [options, setOptions] = useState<CopyOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AiError | null>(null)
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const reqId = useRef(0)

  const subjectLabel = cat.id === 'ads' || cat.id === 'offers' ? 'اسم المنتج' : cat.labels.title
  const subjectHint =
    cat.id === 'ads' || cat.id === 'offers'
      ? 'مثال: سماعة لاسلكية Pro'
      : cat.id === 'truefalse'
        ? 'اكتب العبارة كما ستظهر: «القهوة تسبب الجفاف»'
        : cat.id === 'factmyth'
          ? 'اكتب المعلومة الشائعة: «نستخدم 10% فقط من أدمغتنا»'
          : 'اكتب المعلومة: «قلب الحوت الأزرق بحجم سيارة صغيرة»'

  const brief = (): CopyBrief => ({
    ...EMPTY_BRIEF,
    category: cat.id,
    subject,
    keywords: splitKeywords(kw),
    tone,
    price,
    oldPrice,
    discount,
    extra,
    contact: withContact ? init.contact : '',
    brandTag: init.brandTag,
  })

  // الوضع المحلي: توليد فوري ومباشر عند أي تغيير
  useEffect(() => {
    if (mode !== 'local') return
    const h = setTimeout(() => setOptions(generateLocal(brief(), seed)), 220)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, subject, kw, tone, price, oldPrice, discount, withContact, seed])

  const runClaude = async () => {
    if (!prefs.aiKey) return
    const my = ++reqId.current
    setBusy(true)
    setError(null)
    try {
      const list = await generateWithClaude(brief(), { apiKey: prefs.aiKey, model: prefs.aiModel, count: 5 })
      if (my === reqId.current) setOptions(list)
    } catch (e) {
      if (my === reqId.current) setError(e instanceof AiError ? e : new AiError('other', String(e)))
    } finally {
      if (my === reqId.current) setBusy(false)
    }
  }

  const apply = (o: CopyOption, only?: keyof CopyTexts) => {
    const keys = only ? [only] : ORDER.filter((k) => o.texts[k] != null && o.texts[k] !== '')
    if (!keys.length) return
    changeContent((c) => {
      for (const k of keys) {
        const v = o.texts[k]
        if (v == null) continue
        if (k === 'features') c.texts.features = v as string[]
        else (c.texts as unknown as Record<string, string>)[k] = v as string
      }
    })
    setApplied((prev) => {
      const n = new Set(prev)
      for (const k of keys) n.add(`${o.id}:${k}`)
      return n
    })
    if (!only) toast('تم تطبيق النصوص على التصميم', 'ok', 2200)
  }

  const copyCaption = async (o: CopyOption, withTags: boolean) => {
    const text = withTags && o.hashtags.length ? `${o.caption}\n\n${o.hashtags.join(' ')}` : o.caption
    const ok = await copyText(text)
    toast(ok ? 'تم نسخ نص المنشور' : 'تعذّر النسخ — انسخ النص يدوياً', ok ? 'ok' : 'error', 2200)
  }

  const switchMode = (m: 'local' | 'claude') => {
    if (m === mode) return
    reqId.current++
    setBusy(false)
    setError(null)
    setOptions([])
    setMode(m)
  }

  const claudeReady = !!prefs.aiKey
  const isOffers = cat.id === 'offers'

  return (
    <Modal title="مساعد الكتابة" onClose={close} wide="xl">
      <div className="cw">
        <div className="cw-form">
          <div className="cw-mode">
            <button className={mode === 'local' ? 'on' : ''} onClick={() => switchMode('local')}>
              <WandSparkles size={16} />
              <span>
                <b>سريع</b>
                <small>محلي بدون إنترنت</small>
              </span>
            </button>
            <button className={mode === 'claude' ? 'on' : ''} onClick={() => switchMode('claude')}>
              <Sparkles size={16} />
              <span>
                <b>Claude</b>
                <small>ذكاء حقيقي · أدق</small>
              </span>
            </button>
          </div>
          {mode === 'claude' && !claudeReady && (
            <div className="cw-key">
              <KeyRound size={16} />
              <span>أضف مفتاح Claude API مرة واحدة من الإعدادات لتفعيل هذا الوضع. المفتاح يبقى على جهازك فقط.</span>
              <Btn small onClick={() => useEditor.setState({ dialog: 'settings' })}>
                فتح الإعدادات
              </Btn>
            </div>
          )}

          <label className="cw-f">
            <span>
              {subjectLabel} <em>{cat.name}</em>
            </span>
            <textarea className="txa" dir="auto" rows={cat.id === 'ads' || cat.id === 'offers' ? 1 : 3} value={subject} placeholder={subjectHint} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="cw-f">
            <span>{cat.id === 'ads' || cat.id === 'offers' ? 'المزايا / كلمات مفتاحية' : 'كلمات مفتاحية (اختياري)'}</span>
            <input className="txi" dir="auto" value={kw} placeholder="افصل بفاصلة: جودة عالية، شحن مجاني" onChange={(e) => setKw(e.target.value)} />
          </label>
          {isOffers && (
            <div className="cw-row3">
              <label className="cw-f">
                <span>السعر الجديد</span>
                <input className="txi ltr" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
              <label className="cw-f">
                <span>السعر القديم</span>
                <input className="txi ltr" dir="ltr" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} />
              </label>
              <label className="cw-f">
                <span>الخصم</span>
                <input className="txi ltr" dir="ltr" value={discount} placeholder="-25%" onChange={(e) => setDiscount(e.target.value)} />
              </label>
            </div>
          )}
          <div className="cw-f">
            <span>النبرة</span>
            <Chips value={tone} wrap options={TONES.map((t) => ({ value: t.id, label: t.label, title: t.hint }))} onChange={setTone} />
          </div>
          {mode === 'claude' && (
            <label className="cw-f">
              <span>تعليمات إضافية (اختياري)</span>
              <textarea className="txa" dir="auto" rows={2} value={extra} placeholder="مثال: استخدم لهجة شامية بسيطة، اذكر أن التوصيل مجاني…" onChange={(e) => setExtra(e.target.value)} />
            </label>
          )}
          <label className="cw-sw">
            <input type="checkbox" checked={withContact} onChange={(e) => setWithContact(e.target.checked)} />
            <span>إضافة معلومات التواصل (من الهوية) إلى نص المنشور</span>
          </label>
          {mode === 'local' ? (
            <Btn variant="primary" block icon={<RefreshCw size={15} />} onClick={() => setSeed((x) => x + 1)}>
              اقتراحات أخرى
            </Btn>
          ) : (
            <Btn variant="primary" block icon={busy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} disabled={busy || !claudeReady} onClick={runClaude}>
              {busy ? 'Claude يكتب…' : options.length && options[0].source === 'claude' ? 'توليد اقتراحات جديدة' : 'اكتب لي بـ Claude'}
            </Btn>
          )}
          <p className="hint cw-note">
            {mode === 'claude'
              ? 'يُرسل الموضوع والكلمات المفتاحية فقط إلى Anthropic — لا تُرسل صور التصميم. راجع المعلومات قبل النشر.'
              : 'الاقتراحات المحلية قوالب لغوية مصقولة حسب فئة التصميم والنبرة، ولا تخترع معلومات عن منتجك.'}
          </p>
        </div>

        <div className="cw-res">
          {error && <div className="alert cw-err">{error.message}</div>}
          {busy && (
            <div className="cw-busy">
              <Loader2 size={20} className="spin" /> Claude يصيغ النصوص…
            </div>
          )}
          {!busy && options.length === 0 && !error && <Empty icon={<PenLine size={40} />} title={mode === 'claude' ? 'جاهز للكتابة' : 'اكتب الموضوع لتظهر الاقتراحات'} text={mode === 'claude' ? 'اضغط «اكتب لي بـ Claude».' : 'ستظهر هنا فوراً وتتحدّث أثناء الكتابة.'} />}
          <div className="cw-list">
            {options.map((o, n) => {
              const keys = ORDER.filter((k) => o.texts[k] != null && o.texts[k] !== '')
              const all = keys.length > 0 && keys.every((k) => applied.has(`${o.id}:${k}`))
              return (
                <article key={o.id} className="cw-card">
                  <header>
                    <span className="cw-n">{n + 1}</span>
                    <span className="cw-src">{o.source === 'claude' ? 'Claude' : 'محلي'}</span>
                    <span style={{ flex: 1 }} />
                    <Btn small variant={all ? 'default' : 'primary'} icon={all ? <Check size={14} /> : undefined} onClick={() => apply(o)} disabled={!keys.length}>
                      {all ? 'طُبّق' : 'تطبيق الكل'}
                    </Btn>
                  </header>
                  <div className="cw-fields">
                    {keys.map((k) => {
                      const v = o.texts[k]!
                      const done = applied.has(`${o.id}:${k}`)
                      return (
                        <button key={k} className={`cw-line ${done ? 'done' : ''}`} onClick={() => apply(o, k)} title="اضغط لتطبيق هذا الحقل فقط">
                          <small>{cat.labels[k as TextKey] ?? k}</small>
                          <b>{Array.isArray(v) ? v.map((x, i) => <div key={i}>• {x}</div>) : <Accent text={v} />}</b>
                          {done ? <Check size={14} /> : <i>تطبيق</i>}
                        </button>
                      )
                    })}
                  </div>
                  {(o.caption || o.hashtags.length > 0) && (
                    <>
                      <button className={`cw-toggle ${open === o.id ? 'on' : ''}`} onClick={() => setOpen(open === o.id ? null : o.id)}>
                        <ChevronDown size={15} />
                        نص المنشور والوسوم
                      </button>
                      {open === o.id && (
                        <div className="cw-cap">
                          <pre dir="auto">{o.caption}</pre>
                          {o.hashtags.length > 0 && <div className="cw-tags" dir="auto">{o.hashtags.join(' ')}</div>}
                          <div className="cw-caps-btns">
                            <Btn small icon={<Copy size={14} />} onClick={() => copyCaption(o, true)}>
                              نسخ النص مع الوسوم
                            </Btn>
                            <Btn small variant="ghost" onClick={() => copyCaption(o, false)}>
                              النص فقط
                            </Btn>
                            {o.hashtags.length > 0 && (
                              <Btn
                                small
                                variant="ghost"
                                onClick={async () => {
                                  const ok = await copyText(o.hashtags.join(' '))
                                  toast(ok ? 'تم نسخ الوسوم' : 'تعذّر النسخ', ok ? 'ok' : 'error', 2000)
                                }}
                              >
                                الوسوم فقط
                              </Btn>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
