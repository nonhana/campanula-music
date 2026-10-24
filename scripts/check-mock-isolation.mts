// 生产构建检查（#58、#61）：mock、录制数据、mock 路由和开发设计页都不能进产物。
// 跑在 pnpm build 之后；CI 和 pre-push 都用它。
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import process from 'node:process'

import { DESIGN_PAGE_MARKER } from '../src/lib/dev/design-marker.ts'
import { MOCK_RUNTIME_MARKER } from '../src/lib/server/mock/runtime.ts'

const ROOT = join(import.meta.dirname, '..')
const OUTPUTS = [
  join(ROOT, '.svelte-kit/output'),
  join(ROOT, 'build'),
  join(ROOT, '.vercel/output'),
]
const MARKERS = [
  MOCK_RUNTIME_MARKER,
  DESIGN_PAGE_MARKER,
  'campanula:mock-sdk',
  '/mock-assets/audio',
  '/api/mock/',
  'playlist_detail.liked-full',
  'user_playlist.full',
]

const filesIn = async (dir: string): Promise<string[]> => {
  try {
    await stat(dir)
  }
  catch {
    return []
  }
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    // .vercel/output 里的 node_modules 是软链，跳过：mock 和录制数据不会在里面
    if (entry.name === 'node_modules' || entry.isSymbolicLink())
      continue
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      files.push(...await filesIn(path))
    else
      files.push(path)
  }
  return files
}

const problems: string[] = []
let checked = 0
for (const output of OUTPUTS) {
  for (const file of await filesIn(output)) {
    checked += 1
    const text = (await readFile(file)).toString('latin1')
    for (const marker of MARKERS) {
      if (text.includes(marker))
        problems.push(`${relative(ROOT, file)}：出现 ${marker}`)
    }
  }
}

if (problems.length > 0) {
  console.error('生产构建检查失败：出现了仅供开发使用的代码或数据：')
  for (const problem of problems)
    console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`生产构建检查通过：${checked} 个文件，没有 mock、录制数据、mock 路由或开发设计页`)
