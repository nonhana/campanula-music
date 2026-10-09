// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    interface PageState {
      /** 验证关卡③：多选压的那条浅路由历史 */
      select?: boolean
    }
    // interface Platform {}
  }
}

export {}
