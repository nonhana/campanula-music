// mock 的浏览器 smoke（#58 Testing Decisions）：自动登录、同步、打开歌单、写入、刷新、重置。
// 需要先开 pnpm dev:mock；跑一次：pnpm smoke:mock
import { execFileSync } from 'node:child_process'
import process from 'node:process'

const ROOT = new URL('..', import.meta.url).pathname
const BROWSER = `${ROOT}scripts/browser`
const NAME = `Mock smoke ${Date.now()}`

function run(args: string[]): string {
  return execFileSync(BROWSER, args, { encoding: 'utf8', cwd: ROOT })
}

async function waitFor(what: string, check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (check())
      return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`等不到：${what}`)
}

try {
  const status = JSON.parse(run(['check'])) as { mode: string, enabled?: boolean }
  if (status.mode !== 'mock' || !status.enabled)
    throw new Error('scripts/browser check 不是 mock 模式')

  run(['open', '/'])
  await waitFor('曲库同步', () => run(['exec', 'document.body.innerText.includes(\'我喜欢的音乐\') && document.body.innerText.includes(\'4,984\')']).includes('true'))
  if (!run(['exec', 'document.body.innerText.includes(\'Mock · 测试数据\')']).includes('true'))
    throw new Error('页面没有 Mock · 测试数据 标识')

  run(['open', '/playlists/900000024'])
  await waitFor('4 首可播放歌单', () => run(['exec', 'document.body.innerText.includes(\'Mock · 4 首可播放\')']).includes('true'))

  run(['open', '/playlists/900000019'])
  await waitFor('poems', () => run(['exec', 'document.body.innerText.includes(\'poems\')']).includes('true'))

  run(['exec', `(async () => { const response = await fetch('/api/playlists/900000019/name', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '${NAME}' }) }); location.reload(); return response.status })()`])
  await waitFor('写入后的名字', () => run(['exec', `document.body.innerText.includes('${NAME}')`]).includes('true'))

  run(['reset'])
  run(['exec', 'location.reload()'])
  await waitFor('重置后的 poems', () => run(['exec', 'document.body.innerText.includes(\'poems\')']).includes('true'))
  if (run(['exec', `document.body.innerText.includes('${NAME}')`]).includes('true'))
    throw new Error('reset 之后写过的名字还在')

  console.log('mock 浏览器 smoke 通过：自动登录、同步 4,984 首、打开歌单、写入、刷新、重置')
}
catch (error) {
  console.error(`mock 浏览器 smoke 失败：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
