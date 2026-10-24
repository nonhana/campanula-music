<!--
  桌面顶栏正中的搜索框（视觉原型 DesktopSearchBox，DESIGN.md 桌面搜索）：点进去、Tab 进去或按 Ctrl K（Mac 上 ⌘ K）时，
  框下面挂出下拉，没有遮罩、不挡页面：空着时是搜索历史（没有搜索历史就不挂出），打字时是建议（SearchSuggestions）。
  回车、点建议或搜索历史里的词就搜，结果在内容区单独成页（/search?q=）；点歌手、专辑、歌单的建议直接打开它的页面。在结果页上框里是这次搜的词。
  下拉从框下面飘出来，关上时淡出（motion.ts 的 pop）。Esc、点别处、焦点离开时收起，框里换回这一页搜的词。
  键盘：↑↓ 在建议之间选，回车搜；下拉里的搜索历史、“清空”用 Tab 走到，Esc 收起后回到搜索框
-->
<script lang='ts'>
  import { on } from 'svelte/events'

  import { getAppView } from '../shared/app-context.svelte'
  import { pop } from '../shared/motion'
  import { langOf } from '../shared/text'
  import SearchField from '../ui/SearchField.svelte'
  import type { SuggestionRow } from './search-box.svelte'
  import { activeSuggestionId, pickSuggestion, resetSearchBox, searchBox, searchBoxKey, SUGGESTION_LIST_ID, typeInSearchBox } from './search-box.svelte'
  import SearchSuggestions from './SearchSuggestions.svelte'

  const view = getAppView()
  let root = $state<HTMLElement>()
  let input = $state<HTMLInputElement>()
  let open = $state(false)
  /** 框里有字：下拉里是建议列表（不是搜索历史） */
  const suggesting = $derived(open && searchBox.draft.trim() !== '')
  /** 下拉挂着：打字时是建议；空着时有搜索历史才挂 */
  const dropped = $derived(suggesting || (open && view.state.search.history.length > 0))
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘ K'
    : 'Ctrl K'

  /** 打开下拉：框里有字（在结果页上是这次搜的词）就给它的建议 */
  const show = () => {
    if (open)
      return
    open = true
    view.app.suggest(searchBox.draft)
  }

  /** 收起下拉：框里换回这一页搜的词，不再要建议 */
  const hide = () => {
    open = false
    resetSearchBox(view.app)
  }

  /** 点了一行：下拉收起，焦点离开搜索框，内容区换成结果页或歌手、专辑、歌单的页面 */
  const pick = (row: SuggestionRow) => {
    open = false
    input?.blur()
    pickSuggestion(view.app, row)
  }

  const onkeydown = (event: KeyboardEvent) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp'))
      show()
    if (open && searchBoxKey(event, view.app) && event.key === 'Enter') {
      open = false
      input?.blur()
    }
  }

  /**
   * 搜索框和下拉合起来的那一块：Esc（搜索框里、Tab 到了下拉里的搜索历史都算）收起、焦点回到搜索框；
   * 焦点离开这一块（点别处、Tab 走出去）时收起
   */
  const closeOnLeave = (node: HTMLElement) => {
    const offKey = on(node, 'keydown', (event) => {
      if (event.key !== 'Escape' || !open)
        return
      event.preventDefault()
      // 先把焦点放回搜索框（下拉还开着，不会再打开一次），再收起
      input?.focus()
      hide()
    })
    const offFocus = on(node, 'focusout', (event) => {
      if (open && !node.contains(event.relatedTarget as Node | null))
        hide()
    })
    return () => {
      offKey()
      offFocus()
    }
  }

  // Ctrl K / ⌘ K：到搜索框，选中框里的字。播放页盖着骨架（inert）时不管
  const onWindowKey = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k' || root?.closest('[inert]'))
      return
    event.preventDefault()
    input?.focus()
    input?.select()
    show()
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<div bind:this={root} class='relative mx-auto max-w-[560px] min-w-0 flex-1' role='search' {@attach closeOnLeave}>
  <SearchField
    bind:input
    bind:value={() => searchBox.draft, (value) => {
      typeInSearchBox(view.app, value)
      open = true
    }}
    label='搜索'
    hint={open ? undefined : kbd}
    role='combobox'
    aria-expanded={dropped}
    aria-controls={suggesting ? SUGGESTION_LIST_ID : undefined}
    aria-autocomplete='list'
    aria-activedescendant={suggesting
      ? activeSuggestionId(view.app)
      : undefined}
    lang={langOf(searchBox.draft)}
    onfocus={show}
    onclick={show}
    {onkeydown}
  />
  {#if dropped}
    <!-- 按在下拉里不抢走搜索框的焦点：键盘一直留在框里 -->
    <div
      class='absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-[min(560px,70vh)] origin-top overflow-y-auto overscroll-contain rounded-xl bg-white shadow-float'
      role='presentation'
      transition:pop={{ below: true }}
      onpointerdown={event => event.preventDefault()}
    >
      <SearchSuggestions onpick={pick} />
    </div>
  {/if}
</div>

{#snippet kbd()}
  <kbd class='border border-neutral-200 rounded-sm bg-neutral-50 px-1.5 text-micro text-neutral-600 font-sans'>{shortcut}</kbd>
{/snippet}
