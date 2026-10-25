// 统一的浏览器命令：mock 是日常验证的默认路径，真账号只用于交付前由作者试用。一个浏览器进程、一个专用上下文；同一时间只允许一个 agent 操作（文件锁）。
// 用法：scripts/browser.sh check|open|exec|screenshot|reset|scenario|coverage|offline|port [参数]
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

const ROOT = join(import.meta.dirname, '..')
const LOCK = join(homedir(), '.cache/campanula-axi/browser.lock')
const MOCK_ORIGIN = 'http://localhost:5174'
const REAL_ORIGIN = 'http://localhost:5173'
const MOCK_PROFILE = join(homedir(), '.cache/campanula-axi/mock-profile')

const args = process.argv.slice(2)
const real = args.includes('--real') || process.env.CAMPANULA_BROWSER === 'real'
const command = args.find(arg => !arg.startsWith('--')) ?? 'check'
const rest = args.filter(arg => arg !== command && arg !== '--real')
const origin = real ? REAL_ORIGIN : MOCK_ORIGIN
const session = real ? 'campanula' : 'campanula-mock'

const lock = (): () => void => {
  mkdirSync(dirname(LOCK), { recursive: true })
  try {
    writeFileSync(LOCK, JSON.stringify({
      pid: process.pid,
      command,
      at: Date.now(),
    }), { flag: 'wx' })
  }
  catch {
    const holder = (() => {
      try {
        return JSON.parse(readFileSync(LOCK, 'utf8')) as { pid: number, command: string }
      }
      catch {
        return null
      }
    })()
    if (holder) {
      try {
        process.kill(holder.pid, 0)
        throw new Error(`浏览器正被另一个 agent 操作（pid ${holder.pid}，${holder.command}）：等它做完，或确认它已经停了再删 ${LOCK}`)
      }
      catch (error) {
        if (error instanceof Error && error.message.includes('浏览器正被'))
          throw error
      }
    }
    rmSync(LOCK, { force: true })
    return lock()
  }
  return () => rmSync(LOCK, { force: true })
}

const envOf = (): NodeJS.ProcessEnv => {
  if (real) {
    return {
      ...process.env,
      CHROME_DEVTOOLS_AXI_SESSION: 'campanula',
      CHROME_DEVTOOLS_AXI_USER_DATA_DIR: join(homedir(), '.cache/campanula-axi/chrome-profile'),
      CHROME_DEVTOOLS_AXI_HEADED: '1',
    }
  }
  return {
    ...process.env,
    CHROME_DEVTOOLS_AXI_SESSION: session,
    CHROME_DEVTOOLS_AXI_USER_DATA_DIR: MOCK_PROFILE,
    CHROME_DEVTOOLS_AXI_HEADED: '1',
  }
}

const port = (): number => {
  const env = envOf()
  execFileSync('chrome-devtools-axi', ['pages'], { env, stdio: 'ignore' })
  const pidFile = real
    ? join(homedir(), '.chrome-devtools-axi/sessions/campanula/bridge.pid')
    : join(homedir(), '.chrome-devtools-axi/sessions/campanula-mock/bridge.pid')
  const text = readFileSync(pidFile, 'utf8')
  const found = /"port":(\d+)/.exec(text)?.[1]
  if (!found)
    throw new Error(`没读到 ${session} 桥接进程的端口：${pidFile}`)
  return Number(found)
}

const call = async (name: string, callArgs: Record<string, unknown>): Promise<string> => {
  const bridge = port()
  const response = await fetch(`http://127.0.0.1:${bridge}/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args: callArgs }),
  })
  const reply = await response.json() as { result?: string, error?: string }
  if (reply.error !== undefined || reply.result === undefined)
    throw new Error(`DevTools ${name}：${reply.error ?? '没有结果'}`)
  return reply.result
}

const pages = async (): Promise<string> => call('list_pages', {})

const pageIdOf = (text: string, target: string): number | null => {
  // 桥接进程的 list_pages 两种格式都见过：`1: title (url)` 和 `1: url`；CLI 的 pages 是 `1,url`
  for (const line of text.split('\n')) {
    const match = /^(\d+): (.*)$/.exec(line.trim())
    if (!match)
      continue
    const rest = match[2]!.replace(/ \[selected\]$/, '')
    const url = /\(([^)]+)\)$/.exec(rest)?.[1] ?? rest
    if (url === target || url.startsWith(`${target}/`))
      return Number(match[1])
  }
  return null
}

const ensurePage = async (path = '/'): Promise<number> => {
  const text = await pages()
  const found = pageIdOf(text, origin)
  if (found !== null)
    return found
  await call('new_page', { url: `${origin}${path}` })
  const after = await pages()
  const created = pageIdOf(after, origin)
  if (created === null)
    throw new Error(`打不开 ${origin}：开发服务器开着吗？`)
  await selectPage(created)
  return created
}

const selectPage = async (pageId: number): Promise<void> => {
  // 用 CLI 的 selectpage：它会把选中的页写进 CLI 自己的状态，随后的 eval/screenshot 才认
  cli([
    'selectpage',
    String(pageId),
    '--no-snapshot',
  ])
}

const cli = (args: string[]): string => execFileSync('chrome-devtools-axi', args, {
  env: envOf(),
  encoding: 'utf8',
})

const parseNested = (output: string): unknown => {
  let current: unknown = output
  for (let depth = 0; depth < 4 && typeof current === 'string'; depth += 1) {
    try {
      current = JSON.parse(current)
    }
    catch {
      break
    }
  }
  return current
}

const evaluate = async (pageId: number, expression: string): Promise<string> => {
  await selectPage(pageId)
  const output = cli(['eval', expression]).replace(/\nhelp\[[\s\S]*$/, '').replace(/^result:\s*/, '').trim()
  const parsed = parseNested(output)
  return typeof parsed === 'string'
    ? parsed
    : JSON.stringify(parsed)
}

const navigate = async (pageId: number, url: string): Promise<void> => {
  await call('navigate_page', { type: 'url', url, pageId })
}

const mockStatus = async (): Promise<{ enabled: boolean, scenario: string, seed: string, offline: boolean }> => {
  const response = await fetch(`${MOCK_ORIGIN}/api/mock/status`)
  if (!response.ok)
    throw new Error(`mock 开发服务器没开：先 pnpm dev:mock（${MOCK_ORIGIN}）`)
  return response.json() as Promise<{ enabled: boolean, scenario: string, seed: string, offline: boolean }>
}

const postMock = async (path: string, body?: unknown): Promise<void> => {
  const response = await fetch(`${MOCK_ORIGIN}${path}`, body === undefined
    ? { method: 'POST' }
    : {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
  if (!response.ok)
    throw new Error(`mock ${path} 失败：${response.status} ${await response.text()}`)
}

const accountSignedIn = async (pageId: number): Promise<{ signedIn: boolean, text: string }> => {
  const output = await evaluate(pageId, `(async () => { const r = await fetch('/api/account', { cache: 'no-store' }); const b = await r.json(); return JSON.stringify({ status: r.status, account: b.account ? { id: b.account.id, nickname: b.account.nickname } : null }) })()`)
  const state = JSON.parse(output) as { status: number, account: { id: number, nickname: string } | null }
  return {
    signedIn: state.account !== null,
    text: JSON.stringify(state),
  }
}

const main = async (): Promise<void> => {
  const release = lock()
  try {
    switch (command) {
      case 'port':
        console.log(port())
        return
      case 'check':
        if (real) {
          try {
            await fetch(`${REAL_ORIGIN}/api/account`)
          }
          catch {
            throw new Error(`真账号开发服务器没开：先 pnpm dev（${REAL_ORIGIN}）`)
          }
        }
        if (!real) {
          console.log(JSON.stringify({
            mode: 'mock',
            ...(await mockStatus()),
          }))
          return
        }
        {
          // 真账号：先开 /api/account 这一页查登录，不加载 App、不触发曲库同步
          const pageId = await ensurePage('/api/account')
          const account = await accountSignedIn(pageId)
          if (!account.signedIn) {
            console.error(`真账号没登录：请在专用窗口（scripts/axi.sh）里扫码一次，再跑 scripts/browser.sh check --real。${account.text}`)
            process.exitCode = 1
            return
          }
          console.log(JSON.stringify({
            mode: 'real',
            ...JSON.parse(account.text),
          }))
        }
        return
      case 'open': {
        if (real) {
          try {
            await fetch(`${REAL_ORIGIN}/api/account`)
          }
          catch {
            throw new Error(`真账号开发服务器没开：先 pnpm dev（${REAL_ORIGIN}）`)
          }
        }
        if (!real)
          await mockStatus()
        // 真账号先开 /api/account 查登录；确认登录了才导航到 App
        const pageId = await ensurePage(real ? '/api/account' : '/')
        if (real) {
          const account = await accountSignedIn(pageId)
          if (!account.signedIn) {
            console.error(`真账号没登录：请先在专用窗口（scripts/axi.sh）里扫码。没有继续打开页面。${account.text}`)
            process.exitCode = 1
            return
          }
          await navigate(pageId, `${origin}${rest[0] ?? '/'}`)
          await selectPage(pageId)
          console.log(`real ${origin}${rest[0] ?? '/'}`)
          return
        }
        const path = rest[0] ?? '/'
        await navigate(pageId, `${origin}/mock/login?next=${encodeURIComponent(path)}`)
        await selectPage(pageId)
        console.log(`mock ${origin}${path}`)
        return
      }
      case 'exec': {
        const pageId = await ensurePage()
        console.log(await evaluate(pageId, rest.join(' ')))
        return
      }
      case 'screenshot': {
        const pageId = await ensurePage()
        const file = resolve(ROOT, rest[0] ?? `_notes/screenshots/mock-${Date.now()}.png`)
        mkdirSync(dirname(file), { recursive: true })
        await selectPage(pageId)
        cli(['screenshot', file])
        console.log(file)
        return
      }
      case 'reset':
        if (real) {
          console.error('真账号没有 reset：mock 才可重置')
          process.exitCode = 1
          return
        }
        await postMock('/api/mock/reset')
        console.log('mock 已回到种子')
        return
      case 'scenario': {
        if (real) {
          console.error('真账号没有 scenario：mock 才可换场景')
          process.exitCode = 1
          return
        }
        const name = rest[0] ?? 'default'
        await postMock('/api/mock/scenario', { name })
        console.log(JSON.stringify(await mockStatus()))
        return
      }
      case 'coverage': {
        if (real) {
          console.error('真账号没有 coverage：mock 才有覆盖报告')
          process.exitCode = 1
          return
        }
        const response = await fetch(`${MOCK_ORIGIN}/api/mock/coverage`)
        console.log(JSON.stringify(await response.json(), null, 2))
        return
      }
      case 'offline': {
        const pageId = await ensurePage()
        const on = rest[0] !== 'off'
        await call('emulate', on
          ? { pageId, networkConditions: 'Offline' }
          : { pageId })
        console.log(`offline ${on ? 'on' : 'off'}`)
        return
      }
      default:
        throw new Error(`不认识的命令 ${command}：check|open|exec|screenshot|reset|scenario|coverage|offline|port`)
    }
  }
  finally {
    release()
  }
}

await main()
