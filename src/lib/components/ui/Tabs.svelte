<!--
  标签条（DESIGN.md Navigation）：搜索结果的分类和歌手页的标签共用。选中的是墨色 600 字重，下面一条 3px 的薄荷短线；
  换标签由调用方换地址（onselect，替换当前记录），短线在同一页的换页过渡里滑到新标签下面（uno.config.ts 的 tab-line）。
  ←→ 在标签之间走（到头了绕回来），Home / End 到两头，走到哪个就选中哪个，焦点跟着走；Tab 只停在选中的那一个。
  tablist / tab / tabpanel：每个标签的 id 是 idOf(key)，都管 panel 那一块（tabpanel 由调用方画，aria-labelledby 指回选中的标签）。
  放不下时能左右滑，选中的那个横着滚进视野（不动页面）。
-->
<script lang='ts' generics='K extends string'>
  import type { ResolvedPathname } from '$app/types'
  import type { ClassValue } from 'svelte/elements'

  import { fade } from '../shared/motion'
  import { formatCount } from '../shared/text'

  interface Props {
    /** href 是 resolve 过的地址（中键、在新标签页打开时用）；count 给了才写在名字旁边，到了淡入 */
    tabs: readonly { key: K, label: string, href: ResolvedPathname, count?: number | null }[]
    selected: K
    /** 点了、按了键：调用方换地址；换完焦点落到选中的标签上 */
    onselect: (key: K) => Promise<void> | void
    idOf: (key: K) => string
    /** 标签管的那一块内容的 id */
    panel: string
    /** tablist 的读屏名字 */
    label: string
    class?: ClassValue
  }

  const { tabs, selected, onselect, idOf, panel, label, class: klass }: Props = $props()

  let strip = $state<HTMLElement>()

  const tabOf = (key: K): HTMLElement | null => strip?.querySelector<HTMLElement>(`#${CSS.escape(idOf(key))}`) ?? null

  // 放不下时选中的那个横着滚进视野；scrollIntoView 会连页面一起滚（歌手页的标签行可能还在屏幕下面），所以只动这一条
  $effect(() => {
    const tab = tabOf(selected)
    if (!strip || !tab)
      return
    const bounds = strip.getBoundingClientRect()
    const box = tab.getBoundingClientRect()
    if (box.left < bounds.left)
      strip.scrollLeft -= bounds.left - box.left
    else if (box.right > bounds.right)
      strip.scrollLeft += box.right - bounds.right
  })

  const select = async (key: K) => {
    await onselect(key)
    tabOf(key)?.focus({ preventScroll: true })
  }

  const onkeydown = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const KEYS: Record<string, number> = {
      ArrowRight: index === last
        ? 0
        : index + 1,
      ArrowLeft: index === 0
        ? last
        : index - 1,
      Home: 0,
      End: last,
    }
    const to = KEYS[event.key]
    if (to === undefined)
      return
    event.preventDefault()
    void select(tabs[to]!.key)
  }

  const onclick = (event: MouseEvent, key: K) => {
    event.preventDefault()
    void select(key)
  }
</script>

<div bind:this={strip} class={['flex overflow-x-auto', klass]} role='tablist' aria-label={label}>
  {#each tabs as tab, index (tab.key)}
    {@const on = tab.key === selected}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- 地址由调用方用 resolve() 拼好（还带着查询串），这里只画 -->
    <a href={tab.href}
       id={idOf(tab.key)}
       role='tab'
       aria-selected={on}
       aria-controls={panel}
       tabindex={on
         ? 0
         : -1}
       data-sveltekit-replacestate
       class={[
         'relative h-11 flex flex-none items-center rounded-lg px-3 text-body transition-colors duration-feedback',
         on ? 'text-neutral-900 font-600' : 'text-neutral-500 font-500 mouse:hover:text-neutral-800',
       ]}
       onkeydown={event => onkeydown(event, index)}
       onclick={event => onclick(event, tab.key)}
    >
      {tab.label}
      {#if tab.count !== undefined && tab.count !== null}
        <span class='ml-1 text-caption font-500 tabular-nums' in:fade>{formatCount(tab.count)}</span>
      {/if}
      {#if on}
        <!-- 换标签时这条短线滑到新标签下面：换页的过渡把新旧两条叫同一个名字（uno.config.ts） -->
        <span class='absolute bottom-1 left-1/2 h-[3px] w-4 rounded-full bg-primary-800 -translate-x-1/2' style:view-transition-name='tab-line' aria-hidden='true'></span>
      {/if}
    </a>
  {/each}
</div>
