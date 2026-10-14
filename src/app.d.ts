// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    interface PageState {
      /** 播放页开着（浅路由，压了一条浏览记录：返回手势、后退先关掉它）；queue：手机上还拉开了播放队列 */
      player?: 'open' | 'queue'
    }
    // interface Platform {}
  }
}

export {}
