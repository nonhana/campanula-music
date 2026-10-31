// 端点目录检查（#68）：目录里的每条 = 一个路由路径，get/post = 路由导出的 GET/POST；
// 40 个路由文件 / 42 个处理函数 / 42 个端点定义；搜索四类共用一个路由，但要确认 kind 有 4 个。
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import process from 'node:process'

const ROOT = join(import.meta.dirname, '..')
const API_DIR = join(ROOT, 'src/routes/api')
const ENDPOINTS = join(ROOT, 'src/lib/api/endpoints.ts')
const SEARCH = join(ROOT, 'src/lib/api/search.ts')

const routeFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      files.push(...await routeFiles(path))
    else if (entry.name === '+server.ts')
      files.push(path)
  }
  return files
}

const routes = new Map<string, string[]>()
const routeSources = new Map<string, string>()
let handlerCount = 0
for (const file of await routeFiles(API_DIR)) {
  const route = `/${relative(API_DIR, file).split(sep).slice(0, -1).join('/')}`
  const id = `/api${route}`
  const source = await readFile(file, 'utf8')
  const methods = [
    ...source.matchAll(/^export const (GET|POST)\b/gm),
  ].map(match => match[1]!)
  handlerCount += methods.length
  routes.set(id, methods)
  routeSources.set(id, source)
}

const catalog: { name: string, id: string, method: string }[] = []
const catalogSource = await readFile(ENDPOINTS, 'utf8')
for (const match of catalogSource.matchAll(/^ {2}(\w+): (get|post)<[\s\S]*?resolve\('([^']+)'/gm)) {
  catalog.push({
    name: match[1]!,
    id: match[3]!,
    method: match[2]!.toUpperCase(),
  })
}

const searchKinds = [
  ...(await readFile(SEARCH, 'utf8')).matchAll(/SEARCH_KINDS[^=]*= \[([^\]]+)\]/g),
]
  .flatMap(match => [
    ...match[1]!.matchAll(/'([^']+)'/g),
  ].map(item => item[1]!))
const searchRoute = '/api/search/[kind]'
const searchDefined = catalogSource.includes(`resolve('${searchRoute}'`)

const problems: string[] = []
if (handlerCount !== 42)
  problems.push(`处理函数应为 42 个，实际 ${handlerCount} 个`)
if (catalog.length + (searchDefined ? 1 : 0) !== 42)
  problems.push(`端点定义应为 42 条（41 条目录 + searchPage），实际 ${catalog.length + (searchDefined ? 1 : 0)} 条`)
if (searchKinds.length !== 4 || new Set(searchKinds).size !== 4)
  problems.push(`搜索 kind 应为 4 个，实际 ${JSON.stringify(searchKinds)}`)
if (!routes.get(searchRoute)?.includes('GET'))
  problems.push(`缺少 GET ${searchRoute}`)
if (!searchDefined)
  problems.push('目录里没有 searchPage 的 resolve')

const catalogMethods = new Map<string, Set<string>>()
for (const { name, id, method } of catalog) {
  const methods = routes.get(id)
  if (!methods)
    problems.push(`目录条目 ${name} 的路由 ${id} 不存在`)
  else if (!methods.includes(method))
    problems.push(`目录条目 ${name} 声明 ${method}，路由 ${id} 只导出 ${methods.join('/')}`)
  catalogMethods.set(id, (catalogMethods.get(id) ?? new Set()).add(method))
}
if (searchDefined) {
  catalogMethods.set(searchRoute, new Set([
    ...(catalogMethods.get(searchRoute) ?? []),
    'GET',
  ]))
}

for (const [id, methods] of routes) {
  const declared = [
    ...(catalogMethods.get(id) ?? []),
  ].sort().join('/')
  const exported = [...methods].sort().join('/')
  if (declared !== exported)
    problems.push(`路由 ${id} 导出 ${exported || '无'}，目录声明 ${declared || '无'}`)
}

// 路由文件里引用的端点 key 必须属于它自己的路由：把 A 端点配到 B 路由时编译期看不出，这里拦住
const catalogByName = new Map(catalog.map(entry => [entry.name, entry]))
for (const [id, source] of routeSources) {
  for (const match of source.matchAll(/endpoints\.(?!js\b)(\w+)/g)) {
    const name = match[1]!
    const endpoint = catalogByName.get(name)
    if (!endpoint)
      problems.push(`路由 ${id} 用了目录里没有的端点 ${name}`)
    else if (endpoint.id !== id)
      problems.push(`路由 ${id} 用了端点 ${name}（它的目录路由是 ${endpoint.id}）`)
  }
  if (id === searchRoute && !source.includes('searchPage('))
    problems.push(`路由 ${id} 没有用 searchPage(kind)`)
}

if (problems.length > 0) {
  console.error('端点目录检查失败：')
  for (const problem of problems)
    console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`端点目录检查通过：${routes.size} 个路由文件 / ${handlerCount} 个处理函数 / ${catalog.length + 1} 条端点定义 / search kinds: ${searchKinds.length}/4`)
