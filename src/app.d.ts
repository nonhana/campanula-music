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
      /** 歌曲的“更多”菜单以底部弹层开着（触屏），同样压了一条浏览记录：返回先收起它 */
      songSheet?: true
      /** 加入歌单以底部弹层开着（从底部弹层的“更多”菜单打开，换掉菜单压的那条浏览记录）：返回先收起它 */
      playlistSheet?: true
      /** 歌单页的 ••• 以底部弹层开着（触屏）：返回先收起它 */
      playlistMenuSheet?: true
      /** 歌单编辑（新建、编辑信息、改公开、删除）以底部弹层开着（手机布局）：返回先收起它 */
      editorSheet?: true
      /** 换封面的裁剪页以全屏开着（手机布局），压在歌单编辑上面：返回先收起它 */
      coverSheet?: true
    }
    // interface Platform {}
  }
}

export {}
