<!--
  每日推荐页（#29）：桌面头部呼应首页的方块（88px 日期、四张叠放的封面，右边标题、首数、时长、播放全部）；
  手机是返回栏 + 72px 日期 + 三张封面 + 标题 + 播放全部 + Auxio 式歌曲行。头部交给 DetailHeader（#75），没有封面飞行。
  首数那一行在歌到之前先用全角空格占住高度，头部不跳。点一首或播放全部都用整份每日推荐替换播放队列。
-->
<script lang='ts'>
  import DailyNumber from '#lib/components/daily/DailyNumber.svelte'
  import { DAILY_SOURCE, dailyCalendarDay, dailyFailure, totalDuration } from '#lib/components/daily/view.js'
  import DetailHeader from '#lib/components/library/DetailHeader.svelte'
  import { selectionActions } from '#lib/components/library/selection-actions.svelte.js'
  import { getAppView } from '#lib/components/shared/app-context.svelte.js'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { fade, reveal } from '#lib/components/shared/motion.js'
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js'
  import { formatCount } from '#lib/components/shared/text.js'
  import PlayAllButton from '#lib/components/songs/PlayAllButton.svelte'
  import SongList from '#lib/components/songs/SongList.svelte'
  import type { SongListView } from '#lib/components/songs/view.js'
  import Cover from '#lib/components/ui/Cover.svelte'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'

  const view = getAppView()
  const signedIn = $derived(view.state.library !== null)
  const daily = $derived(view.state.daily)
  const songs = $derived(daily?.status === 'shown'
    ? daily.songs
    : null)
  const failed = $derived(daily?.status === 'failed'
    ? dailyFailure(daily.failure)
    : null)
  const date = $derived(dailyCalendarDay(daily))
  const phone = $derived(!desktopLayout.current)

  scrollSnapshot('/daily', () => null, () => {})

  // 听众在看每日推荐：今天这份要不要拉、登录后才拉，都由 App 决定
  $effect(() => view.app.viewing({ kind: 'daily' }))

  const listView = $derived.by((): SongListView => {
    if (!songs)
      return { kind: 'loading' }
    if (songs.length === 0)
      return { kind: 'empty', title: '今天没有每日推荐', body: '明天 6:00 以后再来看看' }
    return { kind: 'songs', songs }
  })

  const actions = selectionActions()
  /** 每日推荐能做的事（#82）：加入歌单、下载；来源记成单独下载（规则⑦） */
  const select = $derived({
    actions: [
      actions.addToPlaylist(),
      actions.download(() => ({ kind: 'single' })),
    ],
  })
</script>

<svelte:head><title>每日推荐 · Campanula</title></svelte:head>

{#snippet covers(count: number, onPhone: boolean)}
  {#if songs}
    <span class='flex' aria-hidden='true' in:fade>
      {#each songs.slice(0, count) as song, i (song.id)}
        <Cover url={song.album.coverUrl} size={onPhone ? 48 : 44} eager class={[
          'rounded-lg ring-2',
          onPhone ? 'ring-primary-50' : 'ring-white',
          i > 0 && (onPhone ? '-ml-4' : '-ml-3'),
        ]} />
      {/each}
    </span>
  {/if}
{/snippet}

{#snippet playAll()}
  <PlayAllButton {songs} source={DAILY_SOURCE} />
{/snippet}

{#snippet list(onPhone: boolean)}
  {#if failed}
    <div class={onPhone ? '' : 'rounded-xl bg-white p-2 shadow-ambient'} in:reveal>
      <StateBlock kind='error' title={failed.title} body={failed.body} action={{
        label: '重试',
        run: () => void view.app.openDaily(),
      }} />
    </div>
  {:else}
    <SongList list={listView} source={DAILY_SOURCE} loadingLabel='正在加载每日推荐' phone={onPhone} virtual={false} staggerRows={false} {select} />
  {/if}
{/snippet}

{#if signedIn}
  <DetailHeader
    title='每日推荐'
    screenReaderTitle={`，${date.month}月${date.day}日 ${date.weekday}`}
    phoneLayout='banner'
  >
    {#snippet artwork(_size: number, onPhone: boolean)}
      {#if onPhone}
        <div class='w-full flex items-end gap-4'>
          <span class='flex flex-none items-end gap-2.5' aria-hidden='true'>
            <DailyNumber day={date.day} size='phone' />
            <span class='pb-1.5 text-label text-neutral-600'>{date.month}月<br />{date.weekday}</span>
          </span>
          <span class='mb-1 ml-auto'>{@render covers(3, true)}</span>
        </div>
      {:else}
        <div class='size-[200px] flex flex-none flex-col rounded-xl bg-white p-5 shadow-ambient'>
          <DailyNumber day={date.day} size='page' />
          <span class='mt-2 block text-label text-neutral-600' aria-hidden='true'>{date.month}月 · {date.weekday}</span>
          <span class='mt-auto'>{@render covers(4, false)}</span>
        </div>
      {/if}
    {/snippet}
    {#snippet meta(onPhone: boolean)}
      {#if onPhone}
        {#if songs}<span in:fade>{`${formatCount(songs.length)} 首`}</span>{:else}<span aria-hidden='true'>&nbsp;</span>{/if}
      {:else}
        <span class='sr-only'>{date.month}月{date.day}日 {date.weekday}，</span>{#if songs}<span in:fade>{`${formatCount(songs.length)} 首 · ${totalDuration(songs)}`}</span>{:else}<span aria-hidden='true'>&nbsp;</span>{/if}
      {/if}
    {/snippet}
    {#snippet actions()}{@render playAll()}{/snippet}
  </DetailHeader>
  <div class={phone
    ? (failed ? 'pt-3' : 'pt-1')
    : 'mt-6'}>{@render list(phone)}</div>
{/if}
