<!--
  PROTOTYPE：歌单页头部的 ••• 菜单。按歌单类型给不同的操作：
    我喜欢的音乐：随机播放、下载全部（不能改名、不能删）
    自建：编辑歌单信息、改为公开（只有隐私歌单有）、随机播放、删除歌单
    收藏：随机播放、取消收藏
    不在曲库里（搜索进来的）：随机播放、收藏歌单
  桌面是贴着按钮的浮层，手机是底部弹层。键盘：↑/↓ 移动，Esc 关闭。
-->
<script lang='ts'>
  import type { Playlist } from '$lib/prototype/data'
  import { formatCount, inLibrary, langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { CircleArrowDown, Globe, HeartOff, ListPlus, Pencil, Shuffle, Trash2 } from '@lucide/svelte'
  import { fade, fly } from 'svelte/transition'

  interface Props {
    pl: Playlist
    phone: boolean
    /** 浮层贴着它；关闭后把焦点还给它 */
    anchor: HTMLElement | null
    onshuffle: () => void
    onclose: () => void
  }

  const { pl, phone, anchor, onshuffle, onclose }: Props = $props()

  let box = $state<HTMLElement>()
  const rect = $derived(anchor?.getBoundingClientRect())
  const own = $derived(pl.kind === 'own')

  function close() {
    onclose()
    anchor?.focus({ preventScroll: true })
  }

  function run(action: () => void) {
    action()
    close()
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      close()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')
      return
    e.preventDefault()
    const list = box ? [...box.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')] : []
    const i = list.indexOf(document.activeElement as HTMLElement)
    list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus()
  }

  function focusFirst(node: HTMLElement) {
    queueMicrotask(() => node.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true }))
  }
</script>

{#snippet items()}
  {@const row = phone
    ? 'flex h-13 w-full items-center gap-4 rounded-xl px-4 text-left text-[15px] text-neutral-900 active:bg-primary-100 focus-visible:bg-primary-100 disabled:opacity-40'
    : 'item flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] text-neutral-900 focus-visible:(bg-primary-100 outline-none) disabled:opacity-40'}
  {@const sep = phone ? 'mx-4 my-1 h-px bg-neutral-100' : 'mx-3 my-1 h-px bg-neutral-100'}
  {#if own}
    <button role='menuitem' class={row} onclick={() => run(() => nav.openEdit('info'))}>
      <Pencil size={18} class='text-neutral-600' aria-hidden='true' />编辑歌单信息
    </button>
    {#if pl.isPrivate}
      <button role='menuitem' class={row} onclick={() => run(() => nav.openEdit('public'))}>
        <Globe size={18} class='text-neutral-600' aria-hidden='true' />改为公开
      </button>
    {/if}
  {/if}
  <button role='menuitem' class={row} onclick={() => run(onshuffle)}>
    <Shuffle size={18} class='text-neutral-600' aria-hidden='true' />随机播放
  </button>
  {#if pl.kind === 'liked'}
    <button role='menuitem' class={row} disabled={nav.offline} onclick={() => run(() => {})}>
      <CircleArrowDown size={18} class='text-secondary-800' aria-hidden='true' />
      <span class='min-w-0'>下载全部<span class='ml-2 text-neutral-500 tnum'>还有 {formatCount(pl.count - pl.downloaded)} 首没下载</span></span>
    </button>
  {/if}
  {#if !inLibrary(pl)}
    <button role='menuitem' class={row} disabled={nav.offline} onclick={() => run(() => {})}>
      <ListPlus size={18} class='text-neutral-600' aria-hidden='true' />收藏歌单
    </button>
  {:else if pl.kind === 'collected'}
    <div class={sep} role='separator'></div>
    <button role='menuitem' class={row} disabled={nav.offline} onclick={() => run(() => nav.openEdit('delete'))}>
      <HeartOff size={18} class='text-neutral-600' aria-hidden='true' />取消收藏
    </button>
  {:else if own}
    <div class={sep} role='separator'></div>
    <button role='menuitem' class={row} disabled={nav.offline} onclick={() => run(() => nav.openEdit('delete'))}>
      <Trash2 size={18} class='text-error-700' aria-hidden='true' /><span class='text-error-700'>删除歌单</span>
    </button>
  {/if}
{/snippet}

<svelte:window onresize={close} />

{#if phone}
  <div class='fixed inset-0 z-[70]' role='presentation'>
    <button class='absolute inset-0 bg-neutral-900/30' aria-label='关闭菜单' tabindex='-1' onclick={close} transition:fade={{ duration: 180 }}></button>
    <div
      bind:this={box}
      class='absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-2 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-float'
      role='menu'
      tabindex='-1'
      aria-label='歌单操作'
      {onkeydown}
      {@attach focusFirst}
      transition:fly={{ y: 320, duration: 320, opacity: 1, easing: t => 1 - (1 - t) ** 4 }}
    >
      <div class='mx-auto mb-2 h-1 w-9 rounded-full bg-neutral-300' aria-hidden='true'></div>
      <p class='truncate px-4 pb-2 pt-1 text-[15px] font-500 text-neutral-900' lang={langOf(pl.name)}>{pl.name}</p>
      <div class='mx-4 mb-1 h-px bg-neutral-100'></div>
      {@render items()}
      {#if nav.offline}
        <p class='px-4 pt-2 text-[12.5px] text-neutral-600'>离线时不能收藏、下载或删除歌单。</p>
      {/if}
    </div>
  </div>
{:else}
  <div class='fixed inset-0 z-[70]' role='presentation' onclick={close}></div>
  <div
    bind:this={box}
    class='fixed z-[71] w-[240px] rounded-xl bg-white p-1.5 shadow-float'
    style:left='{(rect?.left ?? 0)}px'
    style:top='{(rect?.bottom ?? 0) + 6}px'
    role='menu'
    tabindex='-1'
    aria-label='歌单操作'
    {onkeydown}
    {@attach focusFirst}
    transition:fly={{ y: -4, duration: 160, easing: t => 1 - (1 - t) ** 3 }}
  >
    {@render items()}
    {#if nav.offline}
      <p class='px-3 pb-1 pt-1.5 text-[12px] leading-[18px] text-neutral-600'>离线时不能收藏、下载或删除歌单。</p>
    {/if}
  </div>
{/if}

<style>
  @media (hover: hover) and (pointer: fine) {
    .item:not(:disabled):hover {
      background: #f5fcf9;
    }
  }
</style>
