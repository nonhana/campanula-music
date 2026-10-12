// 检查网易云录制数据里有没有残留作者的真实身份（tests/fixtures/netease/README.md「脱敏」）。
// 身份和真假编号的对照在作者本机的 _notes/fixture-identity.json（不进 git）；没有这个文件（CI、别人的机器）就跳过。
// 用法：
//   node scripts/fixture-identity.mjs              查 tests/fixtures/ 下全部录制
//   node scripts/fixture-identity.mjs <文件>...    只查这些（提交前钩子传暂存的文件）
// 查的是：本人的 uid、昵称，本人作为歌手的编号和名字，本人歌单、作品、别的听众的真实编号（按整个数字匹配）。
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
export const IDENTITY_FILE = join(ROOT, '_notes/fixture-identity.json')
const FIXTURES = join(ROOT, 'tests/fixtures')

/** 读对照表；没有就是 null */
export function loadIdentity() {
  return existsSync(IDENTITY_FILE) ? JSON.parse(readFileSync(IDENTITY_FILE, 'utf8')) : null
}

const wholeNumber = number => new RegExp(`(?<![0-9])${number}(?![0-9])`)
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 对照表变成一组 [说明, 正则] */
function rulesOf(identity) {
  return [
    ['本人 uid', wholeNumber(identity.self.uid)],
    ['本人昵称', new RegExp(escape(identity.self.nickname))],
    ['本人的歌手编号', wholeNumber(identity.artist.id)],
    ['本人的歌手名', new RegExp(escape(identity.artist.name))],
    ...Object.keys(identity.playlists).map(id => [`本人歌单 ${id}`, wholeNumber(id)]),
    ...Object.keys(identity.works).map(id => [`本人作品 ${id}`, wholeNumber(id)]),
    ...Object.keys(identity.users).map(id => [`听众 ${id}`, wholeNumber(id)]),
  ]
}

/** 一段录制文字里残留的真实身份：每条命中写明是什么、前后的文字 */
export function findLeaks(text, identity) {
  return rulesOf(identity).flatMap(([label, pattern]) => {
    const match = pattern.exec(text)
    return match ? [`${label}：…${text.slice(Math.max(0, match.index - 60), match.index + 60).replace(/\s+/g, ' ')}…`] : []
  })
}

function fixtureFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? fixtureFiles(join(dir, entry.name)) : [join(dir, entry.name)])
}

function main(args) {
  const identity = loadIdentity()
  if (!identity) {
    console.log(`录制脱敏检查跳过：没有 ${relative(ROOT, IDENTITY_FILE)}（只在作者本机）`)
    return 0
  }
  const files = (args.length ? args.map(file => resolve(file)) : fixtureFiles(FIXTURES))
    .filter(file => file.startsWith(FIXTURES) && /\.json(?:\.gz)?$/.test(file) && existsSync(file))
  const problems = files.flatMap((file) => {
    const bytes = readFileSync(file)
    const leaks = findLeaks((file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8'), identity)
    return leaks.length ? [`${relative(ROOT, file)}\n  ${leaks.join('\n  ')}`] : []
  })
  if (problems.length) {
    console.error(`录制数据里还有作者的真实身份，先脱敏（tests/fixtures/netease/README.md「脱敏」）：\n${problems.join('\n')}`)
    return 1
  }
  console.log(`录制脱敏检查：${files.length} 个文件，没有残留`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = main(process.argv.slice(2))
