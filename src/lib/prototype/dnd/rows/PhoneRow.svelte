<!--
  PROTOTYPE：手机歌曲行（Auxio 式，56px，无分隔线；照视觉原型）。
  三种拖动方案只改这一行的“抓手”：A 整行长按；B 右侧常驻把手；C 进入编辑模式后才出现把手和勾选框。
  长按、拖动由外面的列表（各个引擎）处理，这里只负责样子和点按。
-->
<script lang='ts'>
  import type { Attachment } from 'svelte/attachments'
  import type { Song } from '../data'
  import { Check, Ellipsis, GripVertical } from '@lucide/svelte'
  import Cover from '../Cover.svelte'
  import { artistLine } from '../data'
  import { player } from '../store.svelte'
  import DownloadMark from './DownloadMark.svelte'
  import NowBars from './NowBars.svelte'
  import SongBadges from './SongBadges.svelte'

  interface Props {
    song: Song
    now?: boolean
    /** 显示勾选框（选择模式 / 编辑模式） */
    selecting?: boolean
    selected?: boolean
    /** 显示拖动把手 */
    grip?: boolean
    /** 作为跟手的“浮起行”渲染 */
    ghost?: boolean
    /** 长按到时、还没开始拖：轻轻浮起 */
    lifted?: boolean
    /** 一起拖的歌数（大于 1 时在封面上标出来） */
    count?: number
    attachRoot?: Attachment<HTMLElement>
    attachGrip?: Attachment<HTMLElement>
    onactivate?: (e: MouseEvent) => void
    /**
     * 由整行接住指针点按（按钮只留给键盘）。svelte-dnd-action 不肯从带 value 的元素（按钮、输入框）上开始拖，
     * 而整行可点的区域是一个按钮，所以那个实现里改由整行接住点按。
     */
    rowclick?: (e: MouseEvent) => void
    onmore?: (e: MouseEvent) => void
    onmenu?: (e: MouseEvent) => void
  }

  const { song, now = false, selecting = false, selected = false, grip = false, ghost = false, lifted = false, count = 1, attachRoot, attachGrip, onactivate, rowclick, onmore, onmenu }: Props = $props()
  const off = $derived(Boolean(song.unavailable))

  // 触屏轻点时，库会自己补发一次 click，浏览器也会发一次：同一行 450ms 内只认第一次
  let lastRootClick = 0
  function onRootClick(e: MouseEvent) {
    if (!rowclick || (e.target as Element).closest('.main, [data-more], [data-grip]'))
      return
    const t = performance.now()
    if (t - lastRootClick < 450)
      return
    lastRootClick = t
    rowclick(e)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class={['prow relative h-full', off && 'is-off', selected && 'is-selected', lifted && 'is-lifted', ghost && 'is-ghost']}
  data-key={song.id}
  role='presentation'
  oncontextmenu={onmenu}
  onclick={rowclick ? onRootClick : undefined}
  {@attach attachRoot}
>
  {#if now && !ghost}<span class='wash' aria-hidden='true'></span>{/if}
  <div class={['body relative flex h-full items-center pr-1', selecting ? 'gap-3 pl-3' : 'gap-3.5 pl-4']}>
    {#if selecting}
      <span class={['check grid size-[22px] flex-none place-items-center rounded-md border-[1.5px]', selected ? 'border-primary-900 bg-primary-900 text-white' : 'border-neutral-500 bg-white']} aria-hidden='true'>
        {#if selected}<Check size={14} strokeWidth={3} />{/if}
      </span>
    {/if}
    <span class='relative size-12 flex-none'>
      <Cover cover={song.cover} class='size-12 rounded-lg' />
      {#if now && !ghost}
        <span class='pointer-events-none absolute inset-0 grid place-items-center' aria-hidden='true'>
          <span class='chip grid size-7 place-items-center rounded-full bg-white/92'><NowBars playing={player.playing} /></span>
        </span>
      {/if}
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
      <span class='flex min-w-0 items-center gap-1.5'>
        <span class={['truncate text-[15px] leading-5 font-500', now ? 'text-primary-950' : 'text-neutral-900']} lang={song.lang}>{song.title}</span>
        <SongBadges {song} />
      </span>
      <span class='mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] leading-[18px] text-neutral-600'>
        <span class='flex-none empty:hidden'><DownloadMark {song} variant='inline' /></span>
        <span class='truncate' lang={song.lang}>{artistLine(song)}</span>
      </span>
    </button>
    {#if grip}
      <span
        class='grip relative z-1 grid size-11 flex-none place-items-center rounded-full text-neutral-500'
        data-grip
        role='img'
        aria-label='按住拖动：{song.title}'
        {@attach attachGrip}
      >
        <GripVertical size={20} aria-hidden='true' />
      </span>
    {/if}
    {#if !selecting}
      <button
        type='button'
        class='more relative z-1 grid size-11 flex-none place-items-center rounded-full text-neutral-600 active:bg-primary-100'
        data-more
        aria-label='更多操作：{song.title}'
        aria-haspopup='menu'
        tabindex={ghost ? -1 : 0}
        onclick={onmore}
      >
        <Ellipsis size={20} aria-hidden='true' />
      </button>
    {/if}
  </div>
</div>

<style>
  .prow {
    -webkit-touch-callout: none;
    user-select: none;
    transition: background-color 140ms ease-out, box-shadow 160ms ease-out, transform 160ms ease-out;
  }

  .is-selected {
    background: #e8f8f1;
  }

  .is-lifted,
  .is-ghost {
    z-index: 2;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
  }

  .is-lifted {
    transform: scale(1.015);
  }

  /* 晨光行（静态版）：手机行放在晨光底上，光用薄荷玻璃 */
  .wash {
    position: absolute;
    inset: 0 0 0 70px;
    pointer-events: none;
    background: linear-gradient(90deg, #d1f1e3 calc(42% - 40px), transparent 42%);
    mask-image: linear-gradient(90deg, transparent 0, #000 16px);
  }

  .chip {
    box-shadow: 0 1px 3px rgb(17 24 39 / 0.18);
  }

  .main::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .main:not([aria-disabled='true']):active::after {
    background: rgb(17 24 39 / 0.04);
  }

  /* 整行接住点按时：按钮不接指针（键盘仍能聚焦、按回车），按下的反馈画在整行上 */
  .main.no-hit {
    pointer-events: none;
  }

  .prow:has(.no-hit):not(.is-off):active {
    background-color: rgb(17 24 39 / 0.04);
  }

  .grip {
    touch-action: none;
    cursor: grab;
  }

  .is-off:not(.is-selected) > .body {
    opacity: 0.45;
  }

  @media (hover: hover) and (pointer: fine) {
    .grip:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>
