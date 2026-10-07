<!--
  PROTOTYPE：曲库里的一张歌单。grid：封面格子（照视觉原型）；list：方案 C 排序时的紧凑列表行。
  拖动由外面的排序容器处理，这里只管样子；把手只在方案 B（封面角上）和方案 C（列表行右边）出现。
-->
<script lang='ts'>
  import type { Attachment } from 'svelte/attachments'
  import type { Playlist } from '../data'
  import { GripVertical, Lock } from '@lucide/svelte'
  import Cover from '../Cover.svelte'
  import { formatCount, langOf } from '../data'
  import { clickSuppressed } from '../interact'
  import { library, tracksOf } from '../store.svelte'

  interface Props {
    pl: Playlist
    layout: 'grid' | 'list'
    phone: boolean
    grip?: boolean
    /** 跟手浮起的那一张 */
    ghost?: boolean
    attachRoot?: Attachment<HTMLElement>
    attachGrip?: Attachment<HTMLElement>
    onopen?: () => void
    /** 由整个格子接住指针点按（按钮只留给键盘）：svelte-dnd-action 不肯从按钮上开始拖，见 PhoneRow 的说明 */
    rowclick?: boolean
  }

  const { pl, layout, phone, grip = false, ghost = false, attachRoot, attachGrip, onopen, rowclick = false }: Props = $props()
  const count = $derived(tracksOf(pl.id).local.length)

  let lastOpen = 0

  function open() {
    // 长按、拖完之后浏览器补发的 click 不算；svelte-dnd-action 在触屏轻点时还会自己再补一次，450ms 内只认第一次
    const t = performance.now()
    if (clickSuppressed() || t - lastOpen < 450)
      return
    lastOpen = t
    onopen?.()
  }

  function onRootClick(e: MouseEvent) {
    if (!(e.target as Element).closest('[data-grip]'))
      open()
  }
</script>

{#if layout === 'grid'}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class={['tile relative rounded-xl', ghost && 'is-ghost']}
    data-key={pl.id}
    role='presentation'
    onclick={rowclick ? onRootClick : undefined}
    {@attach attachRoot}
  >
    <button type='button' class={['open block w-full min-w-0 text-left', rowclick && 'no-hit']} tabindex={ghost ? -1 : 0} onclick={open}>
      <Cover cover={library.coverOf(pl)} class='w-full rounded-xl shadow-ambient' />
      <span class={['mt-2 block truncate font-500 text-neutral-900', phone ? 'text-[15px]' : 'mt-2.5 text-[14px]']} lang={langOf(pl.name)}>{pl.name}</span>
      <span class={['mt-0.5 flex min-w-0 items-center gap-1 text-neutral-600', phone ? 'text-[13px]' : 'text-[12.5px]']}>
        <span class='flex-none tnum'>{formatCount(count)} 首</span>
        {#if pl.isPrivate}<Lock size={12} class='flex-none' aria-label='隐私' />{/if}
      </span>
    </button>
    {#if grip}
      <span
        class='grip absolute right-1.5 top-1.5 z-1 grid size-10 place-items-center rounded-full bg-white/92 text-neutral-700 shadow-ambient'
        data-grip
        role='img'
        aria-label='拖动排序：{pl.name}'
        {@attach attachGrip}
      >
        <GripVertical size={18} aria-hidden='true' />
      </span>
    {/if}
  </div>
{:else}
  <div class={['lrow relative flex h-16 items-center gap-3 rounded-xl bg-white pl-3 pr-1', ghost && 'is-ghost']} data-key={pl.id} {@attach attachRoot}>
    <Cover cover={library.coverOf(pl)} class='size-12 flex-none rounded-lg' />
    <span class='min-w-0 flex-1'>
      <span class='block truncate text-[15px] leading-5 font-500 text-neutral-900' lang={langOf(pl.name)}>{pl.name}</span>
      <span class='mt-0.5 flex items-center gap-1 text-[13px] text-neutral-600'>
        <span class='tnum'>{formatCount(count)} 首</span>
        {#if pl.isPrivate}<Lock size={12} aria-label='隐私' />{/if}
      </span>
    </span>
    <span
      class='grip grid size-11 flex-none place-items-center rounded-full text-neutral-500'
      data-grip
      role='img'
      aria-label='拖动排序：{pl.name}'
      {@attach attachGrip}
    >
      <GripVertical size={20} aria-hidden='true' />
    </span>
  </div>
{/if}

<style>
  .tile,
  .lrow {
    -webkit-touch-callout: none;
    user-select: none;
  }

  .open.no-hit {
    pointer-events: none;
  }

  /* 用 scale 而不是 transform：dnd-kit 拖动时会用 !important 接管 transform */
  .tile.is-ghost {
    scale: 1.04;
  }

  .tile.is-ghost :global(img) {
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
  }

  .lrow.is-ghost {
    scale: 1.02;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
  }

  .grip {
    cursor: grab;
    touch-action: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .grip:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .tile:not(.is-ghost):hover :global(img) {
      box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
    }
  }
</style>
