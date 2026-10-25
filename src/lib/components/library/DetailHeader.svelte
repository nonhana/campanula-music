<!--
  详情页头（#75）：专辑、歌单、歌手、每日推荐、已下载共用这一份。
  封面图可以是方（专辑、歌单）、圆（歌手）或自定义图（每日推荐、已下载）；标题、信息行、可选标签和动作由调用方给。
  模块自己负责桌面 / 手机的布局断点、就绪前的骨架、淡入、手机返回栏的页名（pageHeading）和封面飞行终点。
  尺寸：桌面封面图 200px、手机 168px；封面飞行的缩略图取 FLIGHT_COVER_SIZE（ADR-0011）。
  手机三种排法：居中（专辑、歌单、歌手）、图在左标题在右（已下载）、图独占一行（每日推荐）。
  桌面动作：歌单、专辑、每日推荐、已下载贴底；歌手页头内容居中，动作跟在信息行下面（align='center'）。
  页头只放动作，不放搜索：搜索跟着它过滤的列表走（歌单在 PlaylistSongs、已下载在 DownloadsPage），避免动作行越加越长时把搜索挤成孤立的一行（#39 UI 调整）。
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { Snippet } from 'svelte'

  import { desktopLayout } from '../shared/layout'
  import { fadeAway, reveal } from '../shared/motion'
  import { langOf } from '../shared/text'
  import { pageHeading } from '../shell/back-title.svelte'
  import Cover from '../ui/Cover.svelte'
  import Tag from '../ui/Tag.svelte'
  import { FLIGHT_COVER_SIZE } from './flight'

  interface Props {
    /** 有 artwork 时不用它 */
    cover?: { url: string | null, round?: boolean, fallback?: LucideIcon }
    /** 参数是桌面 / 手机上的参考尺寸、是不是手机布局 */
    artwork?: Snippet<[number, boolean]>
    title: string
    /** 桌面上日期在信息行里，这里不重复 */
    screenReaderTitle?: string
    /** 自定义图的页头一直画内容 */
    ready?: boolean
    /** 贴顶（歌单、专辑、每日推荐、已下载）或居中（歌手） */
    align?: 'start' | 'center'
    /** 封面图居中 / 图在左标题在右 / 图独占一行 */
    phoneLayout?: 'center' | 'row' | 'banner'
    meta?: Snippet<[boolean]>
    tags?: readonly string[]
    actions?: Snippet
    note?: Snippet
    /** 放封面飞行的终点（ADR-0011）；不给就不飞 */
    flight?: string
  }

  const {
    cover,
    artwork,
    title,
    screenReaderTitle,
    ready = true,
    align = 'start',
    phoneLayout = 'center',
    meta,
    tags = [],
    actions,
    note,
    flight,
  }: Props = $props()

  const phone = $derived(!desktopLayout.current)
  const round = $derived(cover?.round ?? false)
  /** 真实封面图和骨架共用，168 只写一次 */
  const PHONE_COVER_CLASS = 'mx-auto max-w-[168px]'
</script>

{#snippet titleBlock(onPhone: boolean, extra: string)}
  {#if onPhone}
    <h1 class={['line-clamp-2 break-words text-headline-sm text-neutral-900 font-600', extra]} lang={langOf(title)} {@attach pageHeading(title)}>{title}{#if screenReaderTitle}<span class='sr-only'>{screenReaderTitle}</span>{/if}</h1>
  {:else}
    <h1 class={['line-clamp-2 break-words text-headline text-neutral-900 font-600', extra]} lang={langOf(title)}>{title}</h1>
  {/if}
{/snippet}

{#snippet media(onPhone: boolean)}
  {#if artwork}
    <div class='flex-none'>{@render artwork(onPhone ? 88 : FLIGHT_COVER_SIZE, onPhone)}</div>
  {:else if onPhone}
    <Cover
      url={cover?.url ?? null}
      size={FLIGHT_COVER_SIZE}
      fluid
      eager
      {flight}
      fallback={cover?.fallback}
      class={[
        PHONE_COVER_CLASS,
        round ? 'rounded-full shadow-ambient' : 'rounded-xl shadow-ambient',
      ]}
    />
  {:else}
    <Cover
      url={cover?.url ?? null}
      size={FLIGHT_COVER_SIZE}
      eager
      {flight}
      fallback={cover?.fallback}
      class={round ? 'rounded-full shadow-ambient' : 'rounded-xl shadow-ambient'}
    />
  {/if}
{/snippet}

{#snippet metaBlock(onPhone: boolean)}
  {#if meta}
    <p class={[
      'flex flex-wrap items-center gap-x-1.5 text-neutral-600 tabular-nums',
      onPhone ? 'text-caption' : 'mt-2 text-label',
      onPhone && phoneLayout === 'center' && 'mt-1.5 justify-center',
      onPhone && phoneLayout === 'row' && 'mt-0.5',
      onPhone && phoneLayout === 'banner' && 'mt-1',
    ]}>{@render meta(onPhone)}</p>
  {/if}
{/snippet}

{#snippet actionsBlock(onPhone: boolean)}
  {#if onPhone}
    {#if actions}
      <div class={[
        'flex flex-wrap items-center gap-2',
        phoneLayout === 'center'
          ? 'mt-4 justify-center'
          : 'mt-4',
      ]}>{@render actions()}</div>
    {/if}
  {:else}
    {#if actions}
      <div class={align === 'center'
        ? 'mt-6 flex items-center gap-2'
        : 'mt-auto flex flex-wrap items-center gap-2 pt-4'}>{@render actions()}</div>
    {/if}
  {/if}
{/snippet}

{#snippet extraBlocks(onPhone: boolean)}
  {#if tags.length > 0}
    <p class={['mt-2.5 flex flex-wrap gap-1.5', onPhone && phoneLayout === 'center' && 'justify-center']}>
      {#each tags as tag (tag)}<Tag>{tag}</Tag>{/each}
    </p>
  {/if}
  {#if note}<div class={onPhone ? 'mt-4' : 'mt-2'}>{@render note()}</div>{/if}
  {@render actionsBlock(onPhone)}
{/snippet}

{#if artwork || ready}
  {#if phone && phoneLayout === 'banner'}
    <header class='px-4 pt-2' in:reveal>
      {@render media(true)}
      {@render titleBlock(true, 'mt-4')}
      {@render metaBlock(true)}
      {@render extraBlocks(true)}
    </header>
  {:else if phone && phoneLayout === 'row'}
    <header class='px-4 pt-2' in:reveal>
      <div class='flex items-center gap-4'>
        {@render media(true)}
        <div class='min-w-0 flex-1'>
          {@render titleBlock(true, '')}
          {@render metaBlock(true)}
        </div>
      </div>
      {@render extraBlocks(true)}
    </header>
  {:else if phone}
    <header class='px-4 pt-2 text-center' in:reveal>
      {@render media(true)}
      {@render titleBlock(true, 'mt-4')}
      {@render metaBlock(true)}
      {@render extraBlocks(true)}
    </header>
  {:else}
    <header class={[
      'flex pt-2',
      align === 'center'
        ? 'items-center gap-8'
        : 'gap-7',
    ]} in:reveal>
      {@render media(false)}
      <div class={[
        'min-w-0 flex flex-1 flex-col',
        align === 'center'
          ? 'justify-center'
          : 'pt-1',
      ]}>
        {@render titleBlock(false, '')}
        {@render metaBlock(false)}
        {@render extraBlocks(false)}
      </div>
    </header>
  {/if}
{:else if phone}
  <header class='px-4 pt-2 text-center' out:fadeAway aria-hidden='true'>
    <span class={[
      'bone block aspect-square w-full',
      PHONE_COVER_CLASS,
      round ? 'rounded-full' : 'rounded-xl',
    ]}></span>
    <span class='mx-auto mt-4 h-8 w-1/2 flex items-center'><span class='bone h-6 w-full rounded-full'></span></span>
    <span class='mx-auto mt-1.5 h-5 w-1/3 flex items-center'><span class='bone h-3 w-full rounded-full'></span></span>
  </header>
{:else}
  <header class={[
    'pt-2',
    align === 'center'
      ? 'flex items-center gap-8'
      : 'flex gap-7',
  ]} out:fadeAway aria-hidden='true'>
    <span class={[
      'bone aspect-square flex-none',
      round ? 'rounded-full' : 'rounded-xl',
    ]} style:width={`${FLIGHT_COVER_SIZE}px`}></span>
    <div class={[
      'min-w-0 flex flex-1 flex-col',
      align === 'center'
        ? ''
        : 'pt-1',
    ]}>
      <span class='h-9 w-2/5 flex items-center'><span class='bone h-7 w-full rounded-full'></span></span>
      <span class='mt-2 h-5 w-1/4 flex items-center'><span class='bone h-3.5 w-full rounded-full'></span></span>
    </div>
  </header>
{/if}
