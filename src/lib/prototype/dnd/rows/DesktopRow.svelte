<!--
  PROTOTYPE：桌面歌曲行（56px，照视觉原型）。单击整行播放；Ctrl/⌘ 点选、Shift 连选；右键打开“更多”菜单。
  三种拖动方案只改“抓手”：A 整行都能拖；B 左侧常驻把手；C 进入编辑模式后才有勾选框和右侧把手。
-->
<script lang='ts'>
  import type { Attachment } from 'svelte/attachments'
  import type { Song } from '../data'
  import { Check, Ellipsis, GripVertical, Heart } from '@lucide/svelte'
  import Cover from '../Cover.svelte'
  import { artistLine, formatDuration } from '../data'
  import { isLiked, player } from '../store.svelte'
  import DownloadMark from './DownloadMark.svelte'
  import NowBars from './NowBars.svelte'
  import SongBadges from './SongBadges.svelte'

  interface Props {
    song: Song
    /** 1 起算的位置 */
    n: number
    now?: boolean
    /** 编辑模式：每行都有勾选框 */
    selecting?: boolean
    selected?: boolean
    /** 把手的位置 */
    gripAt?: 'none' | 'lead' | 'end'
    ghost?: boolean
    count?: number
    attachRoot?: Attachment<HTMLElement>
    attachGrip?: Attachment<HTMLElement>
    onactivate?: (e: MouseEvent) => void
    /** 由整行接住指针点按（见 PhoneRow 的说明：svelte-dnd-action 不肯从按钮上开始拖） */
    rowclick?: (e: MouseEvent) => void
    onmore?: (e: MouseEvent) => void
    onmenu?: (e: MouseEvent) => void
  }

  const { song, n, now = false, selecting = false, selected = false, gripAt = 'none', ghost = false, count = 1, attachRoot, attachGrip, onactivate, rowclick, onmore, onmenu }: Props = $props()
  const off = $derived(Boolean(song.unavailable))

  function onRootClick(e: MouseEvent) {
    if (rowclick && !(e.target as Element).closest('.main, [data-more], [data-grip]'))
      rowclick(e)
  }
  const cols = $derived(gripAt === 'lead'
    ? 'grid-cols-[24px_36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px]'
    : 'grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px]')
</script>

{#snippet grip()}
  <span
    class='grip relative z-1 grid h-10 w-6 place-items-center rounded-md text-neutral-500'
    data-grip
    role='img'
    aria-label='拖动排序：{song.title}'
    {@attach attachGrip}
  >
    <GripVertical size={18} aria-hidden='true' />
  </span>
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class={['drow relative h-full rounded-xl', off && 'is-off', selected && 'is-selected', ghost && 'is-ghost', rowclick && 'is-rowclick']}
  data-key={song.id}
  role='presentation'
  oncontextmenu={onmenu}
  onclick={rowclick ? onRootClick : undefined}
  {@attach attachRoot}
>
  {#if now && !ghost}<span class='wash' aria-hidden='true'></span>{/if}
  <div class={['body relative grid h-full items-center gap-4 pl-2 pr-1', cols, gripAt === 'lead' && 'gap-x-3']}>
    {#if gripAt === 'lead'}{@render grip()}{/if}
    <span class='grid place-items-center text-[13px] text-neutral-500 tnum'>
      {#if selecting}
        <span class={['grid size-[18px] place-items-center rounded-[5px] border-[1.5px]', selected ? 'border-primary-900 bg-primary-900 text-white' : 'border-neutral-500 bg-white']} aria-hidden='true'>
          {#if selected}<Check size={12} strokeWidth={3} />{/if}
        </span>
      {:else if selected}
        <Check size={16} strokeWidth={2.5} class='text-primary-900' aria-hidden='true' />
      {:else if now}
        <NowBars playing={player.playing} />
      {:else}
        {n.toLocaleString('en-US')}
      {/if}
    </span>
    <span class='flex min-w-0 items-center gap-3'>
      <span class='relative size-10 flex-none'>
        <Cover cover={song.cover} class='size-10 rounded-lg' />
        {#if count > 1}
          <span class='absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary-950 px-1.5 text-[11px] font-600 text-white tnum ring-2 ring-white'>{count}</span>
        {/if}
      </span>
      <button
        type='button'
        class={['main min-w-0 flex-1 text-left', rowclick && 'no-hit']}
        aria-disabled={off && !selecting ? 'true' : undefined}
        role={selecting ? 'checkbox' : undefined}
        aria-checked={selecting ? selected : undefined}
        aria-current={now ? 'true' : undefined}
        tabindex={ghost ? -1 : 0}
        onclick={onactivate}
      >
        <span class='flex min-w-0 items-center gap-2'>
          <span class={['truncate text-[14px] leading-5 font-500', now ? 'text-primary-950' : 'text-neutral-900']} lang={song.lang}>{song.title}</span>
          <SongBadges {song} />
        </span>
        <span class='block truncate text-[13px] leading-5 text-neutral-600' lang={song.lang}>{artistLine(song)}</span>
      </button>
    </span>
    <span class='truncate text-[13px] text-neutral-600' lang={song.lang}>{song.album}</span>
    <span class='flex items-center gap-3'>
      {#if isLiked(song.id)}
        <Heart size={15} class='flex-none text-accent-600' fill='currentColor' aria-label='已红心' />
      {/if}
      <DownloadMark {song} />
    </span>
    <span class='text-right text-[13px] text-neutral-500 tnum'>{formatDuration(song.duration)}</span>
    {#if gripAt === 'end'}
      {@render grip()}
    {:else}
      <button
        type='button'
        class='more relative z-1 grid size-9 place-items-center rounded-lg text-neutral-600'
        data-more
        aria-label='更多操作：{song.title}'
        aria-haspopup='menu'
        tabindex={ghost ? -1 : 0}
        onclick={onmore}
      >
        <Ellipsis size={18} aria-hidden='true' />
      </button>
    {/if}
  </div>
</div>

<style>
  .drow {
    user-select: none;
    transition: background-color 120ms ease-out;
  }

  .is-selected {
    background: #e8f8f1;
  }

  .is-ghost {
    background: #fff;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
  }

  /* 晨光行（静态版）：白色面板上用薄荷雾 */
  .wash {
    position: absolute;
    inset: 0 0 0 104px;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(90deg, #e8f8f1 calc(42% - 40px), transparent 42%);
    mask-image: linear-gradient(90deg, transparent 0, #000 16px);
  }

  .main::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 12px;
  }

  .main[aria-disabled='true'] {
    cursor: not-allowed;
  }

  /* 整行接住点按时：按钮不接指针（键盘仍能聚焦、按回车） */
  .main.no-hit {
    pointer-events: none;
  }

  .is-rowclick:not(.is-off) {
    cursor: pointer;
  }

  .grip {
    cursor: grab;
    touch-action: none;
  }

  .is-off:not(.is-selected) > .body {
    opacity: 0.45;
  }

  @media (hover: hover) and (pointer: fine) {
    .drow:not(.is-off, .is-selected, .is-ghost):hover {
      background: #f9fafb;
    }

    .more:hover,
    .grip:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>
