<!--
  搜索结果页的标签（视觉原型 SearchPanel）：综合 / 单曲 / 歌单 / 歌手 / 专辑，四类旁边写网易云给的总数（还没拉到时不写，到了淡入）。
  选中的写进地址的 type：返回、刷新还停在这个标签；换标签不留浏览记录（返回直接离开搜索，和曲库标签一样）。
  ←→ 在标签之间走（到头了绕回来），Home / End 到两头，走到哪个就选中哪个；选中的是墨色 600 字重，下面一条 3px 的薄荷短线，
  换标签时滑过去（uno.config.ts 的 tab-line）。桌面吸在顶栏下面；手机放在骨架的标签行里，吸在搜索框下面，放不下时能左右滑
-->
<script lang='ts'>
  import { resolve } from '$app/paths'

  import { getAppView } from '../shared/app-context.svelte'
  import { fade } from '../shared/motion'
  import { formatCount } from '../shared/text'
  import { selectSearchTab } from './search-box.svelte'
  import type { SearchTab } from './view'
  import { SEARCH_PANEL_ID, SEARCH_TABS, searchPath, searchTabId } from './view'

  interface Props {
    keyword: string
    tab: SearchTab
    phone?: boolean
  }

  const { keyword, tab, phone = false }: Props = $props()
  const view = getAppView()
  const results = $derived(view.state.search.results?.keyword === keyword
    ? view.state.search.results
    : null)

  /** 标签旁边写的总数：综合不写，还没拉到不写 */
  const totalOf = (key: SearchTab): number | null => {
    if (key === 'all' || !results)
      return null
    const list = results[key]
    return list.status === 'shown'
      ? list.total
      : null
  }

  let strip = $state<HTMLElement>()

  // 手机上标签放不下时，选中的那个滚进视野
  $effect(() => {
    strip?.querySelector(`#${searchTabId(tab)}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })

  const onkeydown = (event: KeyboardEvent, index: number) => {
    const last = SEARCH_TABS.length - 1
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
    void selectSearchTab(keyword, SEARCH_TABS[to].key)
  }

  const onclick = (event: MouseEvent, key: SearchTab) => {
    event.preventDefault()
    void selectSearchTab(keyword, key)
  }
</script>

<div bind:this={strip} class={[
  'flex overflow-x-auto',
  phone ? 'px-2' : '-mx-3',
]} role='tablist' aria-label='搜索结果分类'>
  {#each SEARCH_TABS as item, index (item.key)}
    {@const selected = item.key === tab}
    {@const total = totalOf(item.key)}
    <a
      id={searchTabId(item.key)}
      href={resolve(searchPath(keyword, item.key))}
      role='tab'
      aria-selected={selected}
      aria-controls={SEARCH_PANEL_ID}
      tabindex={selected
        ? 0
        : -1}
      data-sveltekit-replacestate
      class={[
        'relative h-11 flex flex-none items-center rounded-lg px-3 text-body transition-colors duration-feedback',
        selected ? 'text-neutral-900 font-600' : 'text-neutral-500 font-500 mouse:hover:text-neutral-800',
      ]}
      onkeydown={event => onkeydown(event, index)}
      onclick={event => onclick(event, item.key)}
    >
      {item.label}
      {#if total !== null}
        <span class='ml-1 text-caption font-500 tabular-nums' in:fade>{formatCount(total)}</span>
      {/if}
      {#if selected}
        <!-- 换标签时这条短线滑到新标签下面：换页的过渡把新旧两条叫同一个名字（uno.config.ts） -->
        <span class='absolute bottom-1 left-1/2 h-[3px] w-4 rounded-full bg-primary-800 -translate-x-1/2' style:view-transition-name='tab-line' aria-hidden='true'></span>
      {/if}
    </a>
  {/each}
</div>
