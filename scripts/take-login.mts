// 从专用浏览器（scripts/axi.sh）取登录 Cookie，存进 _notes/campanula-login，给录制脚本（netease-record.mts 的 openSession）用。作者先在专用窗口里扫码登录过（开发服务器开着）。
// Cookie 是 httpOnly 的，页面脚本读不到：这里让页面发一次 /api/account，再从 DevTools 记下的请求头里取 campanula_login。值只写进文件，不打印。用法：pnpm tsx scripts/take-login.mts
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const LOGIN_FILE = join(ROOT, '_notes/campanula-login')
const BASE = 'http://localhost:5173'

const port = execFileSync(join(ROOT, 'scripts/axi.sh'), ['port'], { encoding: 'utf8' }).trim()

/** 调一个 DevTools 工具（经专用浏览器的桥接进程，见 scripts/axi.sh） */
const call = async (name: string, args: Record<string, unknown>): Promise<string> => {
  const response = await fetch(`http://127.0.0.1:${port}/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args }),
  })
  const reply = await response.json() as { result?: string, error?: string }
  if (reply.error !== undefined || reply.result === undefined)
    throw new Error(`DevTools ${name}：${reply.error ?? '没有结果'}`)
  return reply.result
}

const pages = await call('list_pages', {})

/** 桥接进程的 list_pages 两种格式都见过：`1: title (url)` 和 `1: url` */
const pageIdOf = (text: string, target: string): number => {
  for (const line of text.split('\n')) {
    const match = /^(\d+): (.*)$/.exec(line.trim())
    if (!match)
      continue
    const rest = match[2]!.replace(/ \[selected\]$/, '')
    const url = /\(([^)]+)\)$/.exec(rest)?.[1] ?? rest
    if (url === target || url.startsWith(`${target}/`))
      return Number(match[1])
  }
  throw new Error(`专用窗口里没有打开着 ${target} 的标签页：开发服务器开着吗？用 scripts/axi.sh open ${target}/ 打开，在里面扫码登录`)
}

const pageId = pageIdOf(pages, BASE)

// 地址带一次性的参数：页面若是 sweep.py 打开的，同样地址的回答会从重放文件里回，不真的发出去，DevTools 里就没有这条请求
const probe = `/api/account?take-login=${Date.now()}`
const signedIn = await call('evaluate_script', { pageId, function: `async () => (await (await fetch('${probe}')).json()).account !== null` })
if (!signedIn.includes('true'))
  throw new Error('专用窗口里还没登录：请作者在专用窗口（scripts/axi.sh）里扫码登录，再跑一次')

const requests = await call('list_network_requests', {
  pageId,
  resourceTypes: ['fetch'],
})
const reqid = new RegExp(`reqid=(\\d+) GET http://localhost:5173${probe.replace('?', '\\?')}`).exec(requests)?.[1]
if (!reqid)
  throw new Error('DevTools 里没找到刚才的 /api/account 请求')
const detail = await call('get_network_request', {
  pageId,
  reqid: Number(reqid),
})
const value = /campanula_login=([^;\s]+)/.exec(detail)?.[1]
if (!value)
  throw new Error('/api/account 的请求头里没有 campanula_login')

writeFileSync(LOGIN_FILE, `${value}\n`)
console.log(`已从专用窗口取到登录 Cookie（${value.length} 个字符），写进 _notes/campanula-login`)
