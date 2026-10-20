// 读一份录制数据（tests/fixtures/netease/ 下的相对路径）。以 .gz 结尾的是 gzip 压缩的整页录制，
// 见 tests/fixtures/netease/README.md。只读，不校验；校验在 tests/harness/fixtures.ts 和索引脚本里。
import type { RawFixture } from './fixture-format.ts'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'

const BASE = new URL('../../../../tests/fixtures/netease/', import.meta.url)

export async function readFixture(path: string): Promise<RawFixture> {
  const bytes = await readFile(new URL(path, BASE))
  const text = path.endsWith('.gz') ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8')
  return JSON.parse(text) as RawFixture
}
