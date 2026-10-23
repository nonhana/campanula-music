<!--
  每日推荐页（#29）：桌面头部呼应首页的每日推荐方块：白色卡片里 88px 的日期大数字、“10月 · 星期三”、四张叠放的封面；
  右边标题、首数和时长（日期只给读屏，卡片上已经有）、播放全部；下面白色面板里带序号的歌曲行。
  手机是二级页面：返回栏、72px 的日期大数字和三张叠放的封面、标题、首数、播放全部、Auxio 式歌曲行。
  首数那一行在歌到之前先用全角空格占住高度，头部不跳。
  告诉 App 听众在看每日推荐（viewing）：今天这份要不要拉、登录后才拉由 App 决定；断网时标题说要联网，别的没拉成写原因，都能重试。
  点一首歌、播放全部都用整份每日推荐替换播放队列，播放来源是每日推荐。返回这一页时滚动位置回到原来的样子
-->
<script lang='ts'>
  import { getAppView } from '#lib/components/app-context.svelte.js'
  import DailyNumber from '#lib/components/daily/DailyNumber.svelte'
  import { DAILY_SOURCE, dailyCalendarDay, dailyFailure, totalDuration } from '#lib/components/daily/view.js'
  import { desktopLayout } from '#lib/components/layout.js'
  import Cover from '#lib/components/library/Cover.svelte'
  import PlayAllButton from '#lib/components/library/PlayAllButton.svelte'
  import SongList from '#lib/components/library/SongList.svelte'
  import { formatCount } from '#lib/components/library/view.js'
  import { fade, reveal } from '#lib/components/motion.js'
  import { pageHeading } from '#lib/components/shell/back-title.svelte.js'
  import { scrollSnapshot } from '#lib/components/snapshot.js'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'

  const view = getAppView()
  const signedIn = $derived(view.state.library !== null)
  const daily = $derived(view.state.daily)
  const songs = $derived(daily?.status === 'shown' ? daily.songs : null)
  const failed = $derived(daily?.status === 'failed' ? dailyFailure(daily.failure) : null)
  const date = $derived(dailyCalendarDay(daily))

  scrollSnapshot('/daily', () => null, () => {})

  // 听众在看每日推荐：今天这份要不要拉、登录后才拉，都由 App 决定
  $effect(() => view.app.viewing({ kind: 'daily' }))

  const EMPTY = { title: '今天没有每日推荐', body: '明天 6:00 以后再来看看' }
</script>

<svelte:head><title>每日推荐 · Campanula</title></svelte:head>

{#snippet covers(count: number, phone: boolean)}
  {#if songs}
    <span class='flex' aria-hidden='true' in:fade>
      {#each songs.slice(0, count) as song, i (song.id)}
        <Cover url={song.album.coverUrl} size={phone ? 48 : 44} eager class={['rounded-lg ring-2', phone ? 'ring-primary-50' : 'ring-white', i > 0 && (phone ? '-ml-4' : '-ml-3')]} />
      {/each}
    </span>
  {/if}
{/snippet}

{#snippet playAll()}
  <PlayAllButton {songs} source={DAILY_SOURCE} />
{/snippet}

{#snippet list(phone: boolean)}
  {#if failed}
    <div class={phone ? '' : 'rounded-xl bg-white p-2 shadow-ambient'} in:reveal>
      <StateBlock kind='error' title={failed.title} body={failed.body} action={{ label: '重试', run: () => void view.app.openDaily() }} />
    </div>
  {:else}
    <SongList {songs} source={DAILY_SOURCE} loadingLabel='正在加载每日推荐' empty={EMPTY} {phone} />
  {/if}
{/snippet}

{#if signedIn}
  {#if desktopLayout.current}
    <div class='pt-2'>
      <header class='flex gap-7'>
        <div class='size-[200px] flex flex-none flex-col rounded-xl bg-white p-5 shadow-ambient'>
          <DailyNumber day={date.day} size='page' />
          <span class='mt-2 block text-label text-neutral-600' aria-hidden='true'>{date.month}月 · {date.weekday}</span>
          <span class='mt-auto'>{@render covers(4, false)}</span>
        </div>
        <div class='min-w-0 flex flex-1 flex-col pt-1'>
          <h1 class='text-headline text-neutral-900 font-600'>每日推荐</h1>
          <p class='mt-2 text-label text-neutral-600 tabular-nums'>
            <span class='sr-only'>{date.month}月{date.day}日 {date.weekday}，</span>{#if songs}<span in:fade>{`${formatCount(songs.length)} 首 · ${totalDuration(songs)}`}</span>{:else}<span aria-hidden='true'>&nbsp;</span>{/if}
          </p>
          <div class='mt-auto flex items-center gap-2 pt-4'>{@render playAll()}</div>
        </div>
      </header>
      <div class='mt-6'>{@render list(false)}</div>
    </div>
  {:else}
    <header class='px-4 pt-2'>
      <div class='flex items-end gap-4'>
        <span class='flex flex-none items-end gap-2.5' aria-hidden='true'>
          <DailyNumber day={date.day} size='phone' />
          <span class='pb-1.5 text-label text-neutral-600'>{date.month}月<br />{date.weekday}</span>
        </span>
        <span class='mb-1 ml-auto'>{@render covers(3, true)}</span>
      </div>
      <h1 class='mt-4 text-headline-sm text-neutral-900 font-600' {@attach pageHeading('每日推荐')}>每日推荐<span class='sr-only'>，{date.month}月{date.day}日 {date.weekday}</span></h1>
      <p class='mt-1 text-caption text-neutral-600 tabular-nums'>
        {#if songs}<span in:fade>{`${formatCount(songs.length)} 首`}</span>{:else}<span aria-hidden='true'>&nbsp;</span>{/if}
      </p>
      <div class='mt-4'>{@render playAll()}</div>
    </header>
    <div class='pt-3'>{@render list(true)}</div>
  {/if}
{/if}
