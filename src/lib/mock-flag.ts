// Vite 的 define 在 dev:mock 时把它设成 true，生产构建和普通 dev 是 false（#58）。
// 页面只靠它显示“Mock · 测试数据”，不把 mock 代码带进生产包。
export const mock = typeof __CAMPANULA_MOCK__ !== 'undefined' && __CAMPANULA_MOCK__
