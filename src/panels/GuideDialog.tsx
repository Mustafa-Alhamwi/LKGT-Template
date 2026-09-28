import { useState } from 'react'
import { BookOpen, CalendarDays, ClipboardCheck, Eraser, GalleryHorizontal, Boxes, History, ImageIcon, Lightbulb, MousePointerClick, Palette, PenLine, ShieldCheck, Sparkles, Table2 } from 'lucide-react'
import { Btn, Chips } from '../ui/kit'
import { Modal } from './Dialogs'
import { useEditor, type Dialog } from '../store/editor'
import { openKits } from '../store/lock'
import { openRetouch } from '../store/retouch'

const close = () => useEditor.setState({ dialog: null })

const STEPS: { t: string; d: string }[] = [
  { t: 'اختر القالب والمقاس', d: 'من الصفحة الرئيسية اختر الفئة (إعلانات، صح/خطأ، حقيقة/خرافة، عروض أسعار، هل تعلم) ثم المقاس (منشور، ستوري، مربع…) وانقر القالب — كل القوالب فارغة وجاهزة.' },
  { t: 'أضف صورة المنتج', d: 'اسحب الصورة إلى التصميم أو انقر منطقة الإسقاط: يُفرَّغ المنتج تلقائياً ويُبرَز فوق تدرّج الخلفية. صور PNG الشفافة تُستخدم مباشرة.' },
  { t: 'اكتب النصوص', d: 'من تبويب «العناصر» أو بنقر مزدوج على النص داخل التصميم. ضع الكلمة المهمة بين نجمتين *هكذا* لتلوينها. في قوالب الأسئلة اختر الإجابة لتنتقل بين «السؤال» و«الكشف».' },
  { t: 'خصّص التصميم', d: 'تبويب «التصميم»: الخلفيات والخامات، الشكل والظل، الشريط واللوغو. شريط الإضافة على اليمين: نصوص، ملصقات، QR، صور ومنتجات إضافية.' },
  { t: 'راجع وصدّر', d: 'افحص الجودة من قائمة «أدوات»، ثم زر «تصدير». للتصدير المتقدم: عدة مقاسات في ZIP، PDF للطباعة، PSD بطبقات، فيديو MP4 أو GIF.' },
]

interface Tool {
  icon: React.ReactNode
  name: string
  desc: string
  dialog?: Dialog
  run?: () => void
  needsEditor?: boolean
}

const TOOLS: Tool[] = [
  { icon: <PenLine size={18} />, name: 'مساعد الكتابة', desc: 'نصوص التصميم ونص المنشور والوسوم بنبرة تختارها — محلي أو بـ Claude.', dialog: 'copy', needsEditor: true },
  { icon: <ShieldCheck size={18} />, name: 'فحص الجودة', desc: 'يكشف النصوص النائبة والتباين الضعيف والخطوط الصغيرة والأخطاء الإملائية.', dialog: 'check', needsEditor: true },
  { icon: <Sparkles size={18} />, name: 'اقتراحات ذكية', desc: 'بدائل لتصميمك بقوالب وألوان مستخرجة من منتجك.', dialog: 'suggest', needsEditor: true },
  { icon: <Palette size={18} />, name: 'ألوان من المنتج', desc: 'يستخرج ألوان صورتك ويصبغ التصميم بتدرجات متناسقة.', dialog: 'palette', needsEditor: true },
  { icon: <ImageIcon size={18} />, name: 'تصميم من صورة مرجعية', desc: 'ارفع تصميماً أعجبك فيقترح أقرب القوالب وألوانه.', dialog: 'reference', needsEditor: true },
  { icon: <Eraser size={18} />, name: 'محو عنصر من الصورة', desc: 'لوّن فوق شعار أو غبار أو عنصر غير مرغوب فيُملأ من المحيط.', run: () => openRetouch(), needsEditor: true },
  { icon: <GalleryHorizontal size={18} />, name: 'كاروسيل من نص', desc: 'ألصق نصاً فتُولَّد شريحة لكل فقرة بنفس التصميم.', dialog: 'carousel', needsEditor: true },
  { icon: <Table2 size={18} />, name: 'توليد جماعي', desc: 'جدول Excel/CSV + صور منتجات ← عشرات التصاميم دفعة واحدة.', dialog: 'batch' },
  { icon: <CalendarDays size={18} />, name: 'تقويم المحتوى', desc: 'خطّط منشوراتك، اربطها بمشاريعك وجهّزها للنشر.', dialog: 'calendar' },
  { icon: <ClipboardCheck size={18} />, name: 'المراجعة والاعتماد', desc: 'ملف واحد يرسله للمراجع ليعلّق ويعتمد بدون حساب.', dialog: 'review', needsEditor: true },
  { icon: <Boxes size={18} />, name: 'مجموعات الهوية', desc: 'ألوان ومعلومات وشعار أكثر من علامة، مع إعادة تلوين القوالب تلقائياً.', run: openKits },
  { icon: <History size={18} />, name: 'سجل النسخ', desc: 'نسخ تلقائية ويدوية مع مقارنة قبل/بعد واستعادة.', dialog: 'versions', needsEditor: true },
]

const TIPS: [string, string][] = [
  ['Ctrl + K', 'لوحة الأوامر: ابحث عن أي أمر أو قالب أو مقاس'],
  ['نقر مزدوج', 'على أي نص لتعديله مباشرة، وعلى الخلفية لتحديد كل شيء'],
  ['Shift + نقر', 'لإضافة عناصر إلى التحديد ثم محاذاتها أو توزيعها'],
  ['Alt + سحب', 'يعطّل الالتصاق بالخطوط الإرشادية الذكية'],
  ['الأسهم', 'تحريك دقيق 1px (مع Shift: 10px) — بدون تحديد: القالب التالي/السابق'],
  ['Ctrl + Z / Y', 'تراجع وإعادة (لكل التعديلات حتى تبديل الشرائح)'],
  ['Ctrl + S', 'حفظ نسخة مسماة (الحفظ التلقائي يعمل دائماً)'],
  ['عجلة الفأرة', 'على الخلفية أو المنتج للتكبير، ومع Ctrl لتكبير مساحة العمل'],
]

export default function GuideDialog() {
  const view = useEditor((s) => s.view)
  const [tab, setTab] = useState<'start' | 'tools' | 'tips'>('start')
  return (
    <Modal title="دليل LKGT Studio" onClose={close} wide>
      <Chips
        value={tab}
        options={[
          { value: 'start', label: 'ابدأ سريعاً' },
          { value: 'tools', label: 'الأدوات الذكية' },
          { value: 'tips', label: 'نصائح واختصارات' },
        ]}
        onChange={setTab}
      />
      {tab === 'start' && (
        <ol className="gd-steps">
          {STEPS.map((s, i) => (
            <li key={i}>
              <b>{i + 1}</b>
              <div>
                <strong>{s.t}</strong>
                <p>{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {tab === 'tools' && (
        <div className="gd-tools">
          {TOOLS.map((t) => {
            const disabled = !!t.needsEditor && view !== 'editor'
            return (
              <div key={t.name} className={`gd-tool ${disabled ? 'off' : ''}`}>
                <span className="gd-ic">{t.icon}</span>
                <div>
                  <strong>{t.name}</strong>
                  <p>{t.desc}</p>
                </div>
                <Btn
                  small
                  disabled={disabled}
                  title={disabled ? 'افتح تصميماً أولاً' : undefined}
                  onClick={() => {
                    if (t.run) t.run()
                    else if (t.dialog) useEditor.setState({ dialog: t.dialog })
                  }}
                >
                  فتح
                </Btn>
              </div>
            )
          })}
        </div>
      )}
      {tab === 'tips' && (
        <>
          <div className="gd-tips">
            {TIPS.map(([k, v]) => (
              <div key={k}>
                <kbd>{k}</kbd>
                <span>{v}</span>
              </div>
            ))}
          </div>
          <div className="gd-note">
            <Lightbulb size={18} />
            <p>
              كل شيء يُحفظ على جهازك فقط (لا حسابات ولا رفع للخوادم، عدا اختيارياً طلبات وضع Claude في مساعد الكتابة). ثبّت البرنامج كتطبيق من «الإعدادات ← التطبيق» ليعمل بدون إنترنت، وخذ نسخة احتياطية لمشاريعك من «ملف ← تصدير ملف المشروع».
            </p>
          </div>
          <div className="gd-note">
            <MousePointerClick size={18} />
            <p>الخطوط الرسمية: Araboto للعربي وHP Simplified للإنكليزي (تُكتشف تلقائياً من جهازك، أو استوردها من «الإعدادات ← الخطوط»). واجهة البرنامج بخط Qomra.</p>
          </div>
        </>
      )}
      <div className="row-btns">
        <Btn variant="primary" icon={<BookOpen size={15} />} onClick={close}>
          فهمت — لنبدأ
        </Btn>
      </div>
    </Modal>
  )
}
