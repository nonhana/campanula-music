<!--
  一个歌手名或专辑名（#84，DESIGN.md Song Row · 歌手名、专辑名）：能点时是链接（credit-link.ts 判断；没登录时一律纯文字），否则照写名字。
  平时和旁边一样的颜色，鼠标悬停时加下划线、字变成墨色。链接压在整行的点歌按钮上面（relative z-1，同红心键）：点它只换页、不放歌；
  在它上面右键照旧打开这首歌的“更多”菜单（行自己的 oncontextmenu）。有层占着浏览历史时（播放页）由浮层栈换页，返回回到打开播放页之前的那一页；
  按着修饰键、用中键点的照浏览器自己的来（新标签页）。
-->
<script lang='ts'>
  import { page } from '$app/state'

  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import type { CreditKind, CreditTarget } from './credit-link'
  import { creditLink } from './credit-link'

  interface Props {
    kind: CreditKind
    target: CreditTarget
    /** 名字能点（桌面、不在多选里） */
    linked: boolean
    /** 进 Tab 顺序（播放条、播放页）；歌曲行、首页歌曲格、播放队列里的不进，键盘和读屏走“更多”菜单 */
    tabbable?: boolean
    /** 手机播放页：点按区域上下各垫 6px，和 32px 的行高一起是 32px */
    padded?: boolean
  }

  const { kind, target, linked, tabbable = false, padded = false }: Props = $props()
  const view = getAppView()
  const { stack } = getOverlays()
  const link = $derived(linked && view.state.library
    ? creditLink(kind, target, page.url.pathname)
    : null)

  const follow = (event: MouseEvent) => {
    if (!link || !stack.holdsHistory || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    void stack.leave(link.href)
  }
</script>

{#if link}
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- 地址由 credit-link.ts 用 resolve() 拼好 -->
  <a href={link.href}
     class={['relative z-1 rounded-sm underline-offset-3 mouse:hover:(text-neutral-900 underline)', padded && 'py-1.5']}
     tabindex={tabbable
       ? undefined
       : -1}
     onclick={follow}
  >{link.name}</a>
{:else}{target.name}{/if}
