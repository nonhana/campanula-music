import { createContext } from 'svelte'

// 多选模块经 context 告诉滚动条“正在多选”（#66）：触屏上右侧 44px 的滚动条把手让给每一行的拖动把手（#36）。
// LoginPage、HttpsRequired、CookieSecretRequired、AppOpenFailed 四个根屏没有 provider（用 hasSelectionMode() 判断）；
// SignedInFrame 和 SignedOutFrame 都提供，没有 provider 时按“没在多选”处理。

export const [getSelectionMode, setSelectionMode, hasSelectionMode] = createContext<() => boolean>()
