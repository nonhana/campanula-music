// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  /** dev:mock 时 Vite 的 define 设成 true；生产构建是 false（#58） */
  const __CAMPANULA_MOCK__: boolean
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    interface PageState {
      /** 由浮层栈拥有的有序历史条目；请求与焦点只活在当前会话里。 */
      overlays?: import('./lib/components/overlay-stack').OverlayMarker
    }
    // interface Platform {}
  }
}

export {}
