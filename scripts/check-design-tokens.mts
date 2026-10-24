// 检查界面代码只用设计系统的档位（DESIGN.md、uno.config.ts、src/lib/components/shared/motion-tokens.ts）。eslint 的 unocss/blocklist 只看得到 class='…' 这种纯字符串，
// 看不到 class={[…]}、对象和三元里的类名；被禁的类名又不会报错，只是不生成 CSS，界面悄悄失效。这里用 UnoCSS 自己的提取器扫整个文件，再加上 CSS 和 TS 里的零散动效数字。
// 用法：pnpm tsx scripts/check-design-tokens.mts [只查这些文件...]（不带文件查 src 下全部 .svelte、.ts；提交前钩子传暂存的文件）。查的是：
//   1. uno.config.ts blocklist 里的类名（零散时长、曲线，motion-reduce:，阶梯以外的字号、圆角、阴影、颜色），不管写在哪种 class 写法里
//   2. 注释以外的 120ms / 1.2s / cubic-bezier(…)：时长、曲线只写在 motion-tokens.ts
//   3. <style> 里的 ease / ease-in / ease-out：曲线写 var(--ease-out-soft) / var(--ease-in-soft)；来回循环可以用 ease-in-out、linear
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'

import { createGenerator } from 'unocss'

import config from '../uno.config.mts'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')
/** 动效数字的唯一出处 */
const TOKENS_FILE = join(SRC, 'lib/components/shared/motion-tokens.ts')

const RAW_MOTION = /\b\d+(?:\.\d+)?m?s\b|cubic-bezier\(/g
const CSS_KEYWORD_EASING = /(?<![\w-])ease(?:-in|-out)?(?![\w-])/g
const STYLE_BLOCK = /(<style[^>]*>)([\s\S]*?)(<\/style>)/g
const APPLY = /^(?:@apply|--at-apply:|--uno:)/

interface Finding {
  file: string
  line: number
  text: string
  why: string
}

/** 注释换成空格（保留换行，行号不变）：注释里可以照常写“200ms” */
const blankComments = (code: string): string => {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ')
  return code
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(?<![:'"`\\])\/\/[^\n]*/g, blank)
}

/** <style> 里是 CSS 不是类名（例如循环用的 ease-in-out 关键字）：换成空格，只留 @apply / --at-apply 后面的类名 */
const blankStyleExceptApply = (code: string): string => code.replace(STYLE_BLOCK, (_, open: string, css: string, close: string) =>
  open + css.replace(/(?:@apply|--at-apply:|--uno:)[^;}]*|[^\n]/g, kept => (APPLY.test(kept)
    ? kept
    : ' ')) + close)

const lineOf = (code: string, index: number): number => code.slice(0, index).split('\n').length

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const sourceFiles = (dir: string): string[] => readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && /\.(?:svelte|ts)$/.test(entry.name))
  .map(entry => join(entry.parentPath, entry.name))

const uno = await createGenerator(config)

/** 和 @unocss/eslint-plugin 的 blocklist 一样判断：类名本身，或者去掉变体（mouse:、enabled:）以后 */
const blockedReason = async (raw: string): Promise<string | null> => {
  const reason = (hit: NonNullable<ReturnType<typeof uno.getBlocked>>) => {
    const message = hit[1]?.message
    return typeof message === 'function'
      ? message(raw)
      : message ?? 'uno.config.ts 的 blocklist'
  }
  const direct = uno.getBlocked(raw)
  if (direct)
    return reason(direct)
  for (const matched of await uno.matchVariants(raw)) {
    const hit = matched && uno.getBlocked(matched[1])
    if (hit)
      return reason(hit)
  }
  return null
}

const check = async (file: string): Promise<Finding[]> => {
  const code = blankComments(readFileSync(file, 'utf8'))
  const name = relative(ROOT, file)
  const findings: Finding[] = []

  const markup = blankStyleExceptApply(code)
  for (const token of await uno.applyExtractors(markup, file)) {
    const why = await blockedReason(token)
    if (!why)
      continue
    const at = new RegExp(`(?<![\\w:-])${escapeRegExp(token)}(?![\\w-])`, 'g')
    for (const match of markup.matchAll(at)) {
      findings.push({
        file: name,
        line: lineOf(markup, match.index),
        text: token,
        why,
      })
    }
  }

  if (file !== TOKENS_FILE) {
    for (const match of code.matchAll(RAW_MOTION)) {
      findings.push({
        file: name,
        line: lineOf(code, match.index),
        text: match[0],
        why: '时长、曲线只写在 src/lib/components/shared/motion-tokens.ts，这里用 var(--duration-…) / var(--move-…) / var(--ease-…) 或 DURATIONS',
      })
    }
  }

  for (const style of code.matchAll(STYLE_BLOCK)) {
    const start = style.index + style[1].length
    for (const match of style[2].matchAll(CSS_KEYWORD_EASING)) {
      findings.push({
        file: name,
        line: lineOf(code, start + match.index),
        text: match[0],
        why: '曲线写 var(--ease-out-soft) / var(--ease-in-soft)；来回循环可以用 ease-in-out、linear',
      })
    }
  }
  return findings
}

const targets = process.argv.length > 2
  ? process.argv.slice(2).map(file => resolve(file)).filter(file => file.startsWith(SRC) && /\.(?:svelte|ts)$/.test(file))
  : sourceFiles(SRC)

const findings = (await Promise.all(targets.map(check))).flat().sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

if (findings.length > 0) {
  for (const f of findings)
    console.error(`${f.file}:${f.line}  ${f.text}  ${f.why}`)
  console.error(`\n${findings.length} 处没用设计系统的档位（DESIGN.md · Motion「写在哪」）`)
  process.exit(1)
}
console.log(`设计令牌检查通过：${targets.length} 个文件`)
