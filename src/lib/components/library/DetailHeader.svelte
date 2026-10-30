<!--
  详情页头（#75）：专辑、歌单、歌手、每日推荐、已下载共用这一份。
  封面图可以是方（专辑、歌单）、圆（歌手）或自定义图（每日推荐、已下载）；标题、信息行、可选标签和动作由调用方给。
  模块自己负责桌面 / 手机的布局断点、就绪前的骨架、淡入和手机返回栏的页名（pageHeading）。
  尺寸：桌面封面图 200px、手机 168px；封面图取格子那一张 TILE_COVER_SIZE，从格子点进来时直接用缓存里的图。
  手机三种排法：居中（专辑、歌单、歌手）、图在左标题在右（已下载）、图独占一行（每日推荐）。
  桌面动作：歌单、专辑、每日推荐、已下载贴底；歌手页头内容居中，动作跟在信息行下面（align='center'）。
  桌面动作行是一条不会换行的工具栏：左边动作、右边搜索；按工具栏自身宽度决定紧凑，动作太多时由调用方把管理动作收进 •••。
  手机不塞搜索：手机页头是居中的，搜索仍在页头下方（歌单在简介后、已下载在“正在下载”前）。
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
  import { TILE_COVER_SIZE } from './tile-grid'

  interface Props {
    /** 有 artwork 时不用它；placeholder 是先铺的小缩略图按多大取（Cover 的 placeholder），大图到了再淡上去 */
    cover?: { url: string | null, round?: boolean, fallback?: LucideIcon, placeholder?: number }
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
    /** 参数是桌面工具栏是否放不下完整动作（手机固定 false） */
    actions?: Snippet<[boolean]>
    /** 桌面动作行右端的搜索；手机不渲染，调用方仍把搜索放在页头下方 */
    search?: Snippet<[boolean]>
    note?: Snippet
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
    search,
    note,
  }: Props = $props()

  const phone = $derived(!desktopLayout.current)
  /** 桌面动作行的实际宽度；按它切紧凑，不按视口（左栏收起、封面尺寸变化都会改可用宽度） */
  let toolbarWidth = $state(0)
  /** 完整动作 + 搜索最小宽度放不下时，调用方把添加 / 多选收进 ••• */
  const compact = $derived(search !== undefined && toolbarWidth > 0 && toolbarWidth < 500)
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
    <div class='flex-none'>{@render artwork(onPhone ? 88 : TILE_COVER_SIZE, onPhone)}</div>
  {:else if onPhone}
    <Cover
      url={cover?.url ?? null}
      size={TILE_COVER_SIZE}
      fluid
      eager
      placeholder={cover?.placeholder}
      fallback={cover?.fallback}
      class={[
        PHONE_COVER_CLASS,
        round ? 'rounded-full shadow-ambient' : 'rounded-xl shadow-ambient',
      ]}
    />
  {:else}
    <Cover
      url={cover?.url ?? null}
      size={TILE_COVER_SIZE}
      eager
      placeholder={cover?.placeholder}
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
      ]}>{@render actions(false)}</div>
    {/if}
  {:else}
    {#if actions || search}
      <div class={align === 'center'
        ? 'mt-6'
        : 'mt-auto pt-4'}>
        <div class='min-w-0 flex items-center gap-3' bind:clientWidth={toolbarWidth}>
          {#if actions}
            <div class='flex flex-none items-center gap-2'>{@render actions(compact)}</div>
          {/if}
          {#if search}
            <div class='min-w-0 flex flex-1 justify-end'>{@render search(compact)}</div>
          {/if}
        </div>
      </div>
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
    ]} style:width={`${TILE_COVER_SIZE}px`}></span>
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
