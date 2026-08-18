/**
 * Vitest 全局环境兜底。
 *
 * Node 26 自带实验性 localStorage 全局（未传 --localstorage-file 时访问即返回 undefined），
 * vitest 4 的 jsdom 环境因检测到该全局而跳过拷贝 jsdom 自身的 Storage，导致测试里
 * localStorage 不可用。此处注入内存版 Storage 保证基于 localStorage 的行为可测。
 */
class MemoryStorage {
  private data = new Map<string, string>()

  get length() {
    return this.data.size
  }

  clear() {
    this.data.clear()
  }

  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.data.delete(key)
  }

  setItem(key: string, value: string) {
    this.data.set(key, String(value))
  }
}

const storage: Storage = new MemoryStorage()

for (const target of [globalThis, globalThis.window].filter(Boolean)) {
  try {
    Object.defineProperty(target, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    })
  }
  catch {
    // 目标对象不可配置时放弃覆盖，保持原状
  }
}
