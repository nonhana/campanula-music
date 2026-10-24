// 给 tests/fixtures/netease 下的录制数据建机器可读索引（mock 按模块 + 查询匹配用）。
// 每份录制都过 tests/harness/fixtures.ts 的 SDK 结构定义校验，校验不过就不写索引。
// 用法：pnpm fixtures:index；pnpm fixtures:index --check（索引和文件对不上就失败，CI 用）。
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath as toPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { fixtureOutcome } from '../src/lib/server/mock/fixture-format.ts'
import { queryKey } from '../src/lib/server/mock/query-key.ts'
import { readFixture } from '../src/lib/server/mock/read-fixture.ts'
import { loadFixture } from '../tests/harness/fixtures.ts'

const ROOT = join(dirname(toPath(import.meta.url)), '..')
const FIXTURES = join(ROOT, 'tests/fixtures/netease')
const INDEX = join(FIXTURES, 'index.json')

interface IndexEntry {
  path: string
  module: string
  queryKey: string
  query: unknown
  status: number
  outcome: 'ok' | 'rejected' | 'rateLimited'
  /** 有 SDK 结构定义并通过校验；没有结构定义的模块（artist_detail）只能是 false，mock 不拿它当可用录制 */
  validated: boolean
  truncated: unknown
  constructed: boolean
  viewer: string | null
  sdk: string | null
  note: string | null
}

export interface FixtureIndex {
  version: 1
  checkedWith: string
  recordings: number
  modules: Record<string, { count: number, outcomes: Record<string, number> }>
  entries: IndexEntry[]
}

/** 数以千计的编号不进索引：预览里只留前 80 个字符 */
function preview(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > 80
      ? `${value.slice(0, 80)}…`
      : value
  }
  if (Array.isArray(value)) {
    return value.length > 8
      ? [
          ...value.slice(0, 8).map(preview),
          `…共 ${value.length} 项`,
        ]
      : value.map(preview)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [
      key,
      preview((value as Record<string, unknown>)[key]),
    ]))
  }
  return value
}

async function filesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      files.push(...await filesIn(path))
    else if (entry.name.endsWith('.json') || entry.name.endsWith('.json.gz'))
      files.push(path)
  }
  return files
}

async function metaOf(file: string, path: string): Promise<Record<string, unknown>> {
  const bytes = await readFile(file)
  const text = path.endsWith('.gz')
    ? gunzipSync(bytes).toString('utf8')
    : bytes.toString('utf8')
  const parsed = JSON.parse(text) as { context?: Record<string, unknown> }
  return parsed.context ?? {}
}

export async function buildIndex(): Promise<FixtureIndex> {
  const files = (await filesIn(FIXTURES)).filter(file => file !== INDEX).sort()
  const entries: IndexEntry[] = []
  for (const file of files) {
    const path = relative(FIXTURES, file).split('\\').join('/')
    const raw = await readFixture(path)
    const { rejected, response } = fixtureOutcome(raw.module, raw.response)
    // 一份没通过 SDK 结构定义校验的录制不能进索引（loadFixture 会抛错）；SDK 还没导出结构的模块记为未校验
    let validated = true
    try {
      await loadFixture(path)
    }
    catch (error) {
      if (!(error instanceof Error) || !/没有导出 .*，录制数据/.test(error.message))
        throw error
      validated = false
    }
    const meta = await metaOf(file, path)
    entries.push({
      path,
      module: raw.module,
      queryKey: queryKey(raw.query ?? {}),
      query: preview(raw.query ?? {}),
      status: response.status,
      outcome: response.retryAfter !== undefined
        ? 'rateLimited'
        : rejected ? 'rejected' : 'ok',
      validated,
      truncated: meta.truncated ?? null,
      constructed: meta.constructed === true,
      viewer: typeof meta.viewer === 'string'
        ? meta.viewer
        : null,
      sdk: typeof meta.sdk === 'string'
        ? meta.sdk
        : null,
      note: typeof meta.note === 'string'
        ? meta.note
        : null,
    })
  }
  const modules: FixtureIndex['modules'] = {}
  for (const entry of entries) {
    const module = (modules[entry.module] ??= { count: 0, outcomes: {} })
    module.count += 1
    module.outcomes[entry.outcome] = (module.outcomes[entry.outcome] ?? 0) + 1
  }
  let sdkVersion = 'unknown'
  try {
    const pkg = JSON.parse((await readFile(join(ROOT, 'node_modules/hana-music-api/package.json'))).toString('utf8')) as { version: string }
    sdkVersion = pkg.version
  }
  catch {}
  return {
    version: 1,
    checkedWith: `hana-music-api@${sdkVersion}`,
    recordings: entries.length,
    modules,
    entries,
  }
}

function serialize(index: FixtureIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check')
  const index = await buildIndex()
  const text = serialize(index)
  if (check) {
    const current = await readFile(INDEX, 'utf8').catch(() => '')
    if (current !== text) {
      console.error('录制索引不是最新的：跑 pnpm fixtures:index 再提交')
      process.exit(1)
    }
    console.log(`录制索引是最新的（${index.recordings} 份，${Object.keys(index.modules).length} 个模块）`)
    return
  }
  await writeFile(INDEX, text)
  console.log(`写了 ${relative(ROOT, INDEX)}（${index.recordings} 份，${Object.keys(index.modules).length} 个模块）`)
}

if (process.argv[1] && toPath(import.meta.url) === process.argv[1])
  await main()
