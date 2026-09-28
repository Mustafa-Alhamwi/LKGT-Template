/* ------------------------------------------------------------------
 * المراجعة والاعتماد بدون خادم: ملف HTML واحد يُرسَل للمراجع (واتساب/بريد)،
 * يعلّق عليه ويعتمد، ثم يعيد ملف/رمز الرد لتستورده هنا.
 * ------------------------------------------------------------------ */

export interface ReviewPack {
  id: string
  title: string
  note: string
  caption: string
  projectId: string
  brand: string
  created: number
  slides: { img: string; w: number; h: number }[]
}

export interface ReviewResult {
  kind: 'lkgt-review'
  id: string
  projectId: string
  title: string
  decision: 'approved' | 'changes'
  reviewer: string
  at: number
  general: string
  comments: { slide: number; text: string }[]
}

const LS = String.fromCharCode(0x2028)
const PS = String.fromCharCode(0x2029)
const safeJson = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029')

export function encodeResult(r: ReviewResult): string {
  return 'LKR1:' + btoa(unescape(encodeURIComponent(JSON.stringify(r))))
}

export function parseReviewResult(text: string): ReviewResult {
  let t = text.trim()
  if (t.startsWith('LKR1:')) t = decodeURIComponent(escape(atob(t.slice(5).trim())))
  const r = JSON.parse(t) as ReviewResult
  if (r?.kind !== 'lkgt-review' || !r.id) throw new Error('هذا ليس ملف رد مراجعة صالحاً')
  return r
}

export function buildReviewHtml(pack: ReviewPack): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>مراجعة: ${pack.title.replace(/[<&]/g, '')}</title>
<style>
:root{--bg:#0b0b0f;--panel:#15151c;--raised:#1c1c25;--line:#2a2a36;--text:#f2f2f6;--muted:#9a9aa8;--red:#e8212c;--ok:#1fbf8f;--warn:#f0b429}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:"Segoe UI",Tahoma,Arial,sans-serif;line-height:1.7}
header{display:flex;align-items:center;gap:14px;padding:16px 22px;border-bottom:1px solid var(--line);background:var(--panel);position:sticky;top:0;z-index:5}
header h1{margin:0;font-size:17px;flex:1}
header small{color:var(--muted)}
.tag{background:rgba(232,33,44,.14);color:#ff6b75;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:700}
main{max-width:1100px;margin:0 auto;padding:22px}
.note{background:var(--raised);border:1px solid var(--line);border-radius:14px;padding:12px 16px;margin-bottom:18px;white-space:pre-wrap}
.slides{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
.slide{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:12px;display:flex;flex-direction:column;gap:10px}
.slide .wm{position:relative;border-radius:12px;overflow:hidden;line-height:0}
.slide img{width:100%;height:auto;display:block}
.slide .wm::after{content:"للمراجعة فقط";position:absolute;inset:0;display:grid;place-items:center;font-size:34px;font-weight:800;color:rgba(255,255,255,.16);transform:rotate(-24deg);text-shadow:0 0 2px rgba(0,0,0,.25);pointer-events:none}
.slide b{font-size:13px}
textarea,input{width:100%;background:var(--raised);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:9px 12px;font:inherit;font-size:14px}
textarea{min-height:74px;resize:vertical}
textarea:focus,input:focus{outline:2px solid var(--red);outline-offset:0}
.cap{margin-top:18px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.cap pre{margin:8px 0 0;white-space:pre-wrap;font:inherit;color:#dcdce6}
.form{margin-top:22px;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px;display:grid;gap:12px}
.row{display:flex;gap:10px;flex-wrap:wrap}
button{border:0;border-radius:12px;padding:12px 22px;font:inherit;font-weight:700;cursor:pointer;color:#fff}
.ok{background:var(--ok)} .chg{background:var(--warn);color:#241c00} .ghost{background:var(--raised);color:var(--text);border:1px solid var(--line)}
button:hover{filter:brightness(1.1)}
#res{display:none;margin-top:18px;background:var(--panel);border:1px solid var(--ok);border-radius:18px;padding:18px}
#res h3{margin:0 0 6px} #res p{color:var(--muted);margin:4px 0 12px}
#res code{display:block;background:var(--raised);border-radius:10px;padding:10px;font-size:11px;word-break:break-all;max-height:110px;overflow:auto;direction:ltr;text-align:left}
footer{color:var(--muted);text-align:center;padding:26px;font-size:12px}
</style>
</head>
<body>
<header><h1>${pack.title.replace(/[<&]/g, '') || 'مراجعة تصميم'}<br><small>${pack.brand.replace(/[<&]/g, '')} — ${new Date(pack.created).toLocaleDateString('ar-SY-u-nu-latn')}</small></h1><span class="tag">للمراجعة والاعتماد</span></header>
<main>
<div id="note" class="note" style="display:none"></div>
<div class="slides" id="slides"></div>
<div class="cap" id="capbox" style="display:none"><b>نص المنشور المقترح</b><pre id="cap"></pre></div>
<div class="form">
  <div><b>اسمك</b><input id="who" placeholder="اسم المراجع"></div>
  <div><b>ملاحظات عامة (اختياري)</b><textarea id="general" placeholder="أي ملاحظات إضافية…"></textarea></div>
  <div class="row"><button class="ok" id="approve">✓ اعتماد التصميم</button><button class="chg" id="changes">✎ طلب تعديلات</button></div>
</div>
<div id="res"></div>
</main>
<footer>أُنشئ بواسطة LKGT Studio — ملف مراجعة مستقل يعمل بدون إنترنت</footer>
<script>
var PACK = ${safeJson(pack)};
var $ = function(id){ return document.getElementById(id) };
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] }) }
(function(){
  if (PACK.note) { $('note').style.display = 'block'; $('note').textContent = PACK.note }
  if (PACK.caption) { $('capbox').style.display = 'block'; $('cap').textContent = PACK.caption }
  var html = '';
  PACK.slides.forEach(function(s, i){
    html += '<div class="slide"><b>' + (PACK.slides.length > 1 ? 'الشريحة ' + (i + 1) + ' من ' + PACK.slides.length : 'التصميم') + '</b><div class="wm"><img src="' + s.img + '" alt=""></div><textarea data-i="' + (i + 1) + '" placeholder="ملاحظاتك على ' + (PACK.slides.length > 1 ? 'هذه الشريحة' : 'التصميم') + '…"></textarea></div>';
  });
  $('slides').innerHTML = html;
})();
function toB64(str){ return btoa(unescape(encodeURIComponent(str))) }
function finish(decision){
  var who = $('who').value.trim();
  if (!who) { alert('اكتب اسمك أولاً'); $('who').focus(); return }
  var comments = [];
  document.querySelectorAll('textarea[data-i]').forEach(function(t){ if (t.value.trim()) comments.push({ slide: +t.dataset.i, text: t.value.trim() }) });
  var result = { kind: 'lkgt-review', id: PACK.id, projectId: PACK.projectId, title: PACK.title, decision: decision, reviewer: who, at: Date.now(), general: $('general').value.trim(), comments: comments };
  var json = JSON.stringify(result);
  var code = 'LKR1:' + toB64(json);
  var label = decision === 'approved' ? 'تم الاعتماد ✓' : 'طُلبت تعديلات';
  var summary = 'مراجعة «' + PACK.title + '» — ' + label + ' (' + who + ')' + (result.general ? '\\n' + result.general : '') + comments.map(function(c){ return '\\n• ' + (PACK.slides.length > 1 ? 'شريحة ' + c.slide + ': ' : '') + c.text }).join('');
  var r = $('res');
  r.style.display = 'block';
  r.innerHTML = '<h3>' + label + '</h3><p>أرسل الرد لصاحب التصميم: نزّل الملف وأرسله، أو انسخ الرمز وألصقه في LKGT Studio.</p><div class="row"><button class="ok" id="dl">تنزيل ملف الرد</button><button class="ghost" id="cp">نسخ الرمز</button><button class="ghost" id="wa">إرسال عبر واتساب</button></div><br><code>' + esc(code) + '</code>';
  $('dl').onclick = function(){ var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'review-' + PACK.id + '.json'; a.click() };
  $('cp').onclick = function(){ (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function(){ $('cp').textContent = 'تم النسخ ✓' }, function(){ prompt('انسخ الرمز:', code) }) };
  $('wa').onclick = function(){ window.open('https://wa.me/?text=' + encodeURIComponent(summary + '\\n\\n' + code), '_blank') };
  r.scrollIntoView({ behavior: 'smooth' });
}
$('approve').onclick = function(){ finish('approved') };
$('changes').onclick = function(){ finish('changes') };
</script>
</body>
</html>`
}
