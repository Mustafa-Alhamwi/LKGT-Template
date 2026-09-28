/**
 * حاوية مخفية بحجم صفر ومقصوصة — لقياس النصوص ورسم التصدير
 * (بدلاً من إزاحة العناصر آلاف البكسلات، مما يكسر الرسم في الصفحات RTL)
 */
let root: HTMLDivElement | null = null

export function offscreenRoot(): HTMLDivElement {
  if (!root) {
    root = document.createElement('div')
    root.setAttribute('aria-hidden', 'true')
    root.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-1;'
    document.body.appendChild(root)
  }
  return root
}
