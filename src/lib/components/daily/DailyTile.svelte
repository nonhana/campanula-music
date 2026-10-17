<!--
  桌面首页的每日推荐方块（#29，DESIGN.md Layout · 桌面首页）：左上 56px 的日期大数字和“10月 · 星期三”，右上三张叠放的封面，
  左下“每日推荐”和首数。点方块打开每日推荐页；右下角的圆形播放键是播放全部（不是方块的一部分，键盘也能单独到）。
  1280px 及以上在我喜欢的音乐右边，280px 宽；窄于 1280px 排在它下面，排成一行。
  挂上时交给 App 拉今天这份（openDaily）：拉的时候封面和首数是骨架，没拉成用一句短话说为什么（到每日推荐页里重试）
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { Play } from '@lucide/svelte'
  import { playable } from '#lib/api/library.js'
  import { getAppView } from '../app-context.svelte'
  import Cover from '../library/Cover.svelte'
  import { formatCount } from '../library/view'
  import { fade } from '../motion'
  import DailyNumber from './DailyNumber.svelte'
  import { DAILY_SOURCE, dailyCalendarDay, dailyFailure } from './view'

  const view = getAppView()
  const daily = $derived(view.state.daily)
  const songs = $derived(daily?.status === 'shown' ? daily.songs : null)
  const date = $derived(dailyCalendarDay(daily))
  /** 首数那一行：拉到了写几首，没拉成说为什么；正在拉是骨架 */
  const status = $derived(
    songs ? `${formatCount(songs.length)} 首` : daily?.status === 'failed' ? dailyFailure(daily.failure).brief : null,
  )

  $effect(() => {
    void view.app.openDaily()
  })
</script>

<div class='relative'>
  <!-- 窄于 1280px：日期、名字和首数、封面排成一行，右边留给播放键 -->
  <a
    href={resolve('/daily')}
    class='size-full flex items-center gap-6 rounded-xl bg-white py-4 pl-5 pr-20 shadow-ambient transition-shadow duration-feedback xl:(flex-col items-stretch gap-0 p-5) mouse:hover:shadow-float'
    aria-label='每日推荐，{date.month}月{date.day}日 {date.weekday}{status ? `，${status}` : ''}'
  >
    <span class='contents xl:(flex items-start justify-between gap-3)'>
      <span class='flex-none'>
        <DailyNumber day={date.day} size='tile' />
        <span class='mt-2 block text-caption text-neutral-600'>{date.month}月 · {date.weekday}</span>
      </span>
      <span class='order-last ml-auto flex xl:(order-none ml-0 pt-1)' aria-hidden='true'>
        {#if songs}
          {#each songs.slice(0, 3) as song, i (song.id)}
            <span in:fade><Cover url={song.album.coverUrl} size={44} class={['rounded-lg ring-2 ring-white', i > 0 && '-ml-4']} /></span>
          {/each}
        {:else if daily?.status !== 'failed'}
          {#each [0, 1, 2] as i (i)}
            <span class={['bone size-11 rounded-lg ring-2 ring-white', i > 0 && '-ml-4']}></span>
          {/each}
        {/if}
      </span>
    </span>
    <span class='block xl:(mt-auto pr-14)'>
      <span class='block text-body text-neutral-900 font-600'>每日推荐</span>
      {#if status}
        <span class='block text-caption text-neutral-600 tabular-nums' in:fade>{status}</span>
      {:else}
        <span class='bone mt-1.5 block h-3.5 w-12 rounded-full' aria-hidden='true'></span>
      {/if}
    </span>
  </a>
  <button
    type='button'
    class='absolute inset-y-0 right-5 grid my-auto size-11 place-items-center rounded-full bg-primary-900 text-white transition-[background-color,color,transform] duration-feedback xl:(bottom-5 top-auto my-0) enabled:press disabled:(cursor-not-allowed bg-neutral-200 text-neutral-500) mouse:enabled:hover:bg-primary-950'
    aria-label='播放每日推荐'
    disabled={!songs?.some(playable)}
    onclick={() => view.app.playAll(DAILY_SOURCE)}
  >
    <Play size={18} fill='currentColor' class='ml-0.5' aria-hidden='true' />
  </button>
</div>
