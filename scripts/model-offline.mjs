// ينزّل نموذج التفريغ الذكي إلى public/imgly ليعمل البرنامج بدون إنترنت نهائياً
// الاستخدام: npm run model:offline
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const VERSION = '1.4.5' // يجب أن يطابق نسخة @imgly/background-removal في package.json
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lkgt-imgly-'))
try {
  console.log(`⬇  تنزيل نموذج التفريغ (@imgly/background-removal-data@${VERSION}) ...`)
  execSync(`npm pack @imgly/background-removal-data@${VERSION}`, { cwd: tmp, stdio: 'inherit' })
  const tgz = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'))
  if (!tgz) throw new Error('لم يتم تنزيل الحزمة')
  execSync(`tar -xzf "${tgz}"`, { cwd: tmp, stdio: 'inherit' })
  const src = path.join(tmp, 'package', 'dist')
  const dst = path.resolve('public', 'imgly')
  fs.rmSync(dst, { recursive: true, force: true })
  fs.cpSync(src, dst, { recursive: true })
  console.log(`✓ تم — النموذج موجود الآن في ${dst}`)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
