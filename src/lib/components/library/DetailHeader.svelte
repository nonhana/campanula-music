<script lang="ts">
  import type { LucideIcon } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  import { desktopLayout } from '../shared/layout';
  import { fadeAway, reveal } from '../shared/motion';
  import { langOf } from '../shared/text';
  import { pageHeading } from '../shell/back-title.svelte';
  import Cover from '../ui/Cover.svelte';
  import Tag from '../ui/Tag.svelte';
  import DescriptionPreview from './DescriptionPreview.svelte';
  import { FLIGHT_COVER_SIZE } from './flight';

  interface Props {
    cover?: {
      url: string | null;
      round?: boolean;
      fallback?: LucideIcon;
      placeholder?: number;
    };
    artwork?: Snippet<[number, boolean]>;
    title: string;
    screenReaderTitle?: string;
    ready?: boolean;
    align?: 'start' | 'center';
    phoneLayout?: 'center' | 'row' | 'banner';
    meta?: Snippet<[boolean]>;
    tags?: readonly string[];
    description?: string | null;
    actions?: Snippet<[boolean]>;
    search?: Snippet<[boolean]>;
    note?: Snippet;
    flight?: string;
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
    description = null,
    actions,
    search,
    note,
    flight,
  }: Props = $props();

  const phone = $derived(!desktopLayout.current);
  // 按动作行自己的宽度切紧凑，不按视口：左栏收起、封面尺寸变化都会改可用宽度
  let toolbarWidth = $state(0);
  const compact = $derived(
    search !== undefined && toolbarWidth > 0 && toolbarWidth < 500,
  );
  const round = $derived(cover?.round ?? false);
  const PHONE_COVER_CLASS = 'mx-auto max-w-[168px]';
</script>

{#snippet titleBlock(onPhone: boolean, extra: string)}
  {#if onPhone}
    <h1
      class={[
        'line-clamp-2 break-words text-headline-sm text-neutral-900 font-600',
        extra,
      ]}
      lang={langOf(title)}
      {@attach pageHeading(title)}
    >
      {title}{#if screenReaderTitle}<span class="sr-only"
          >{screenReaderTitle}</span
        >{/if}
    </h1>
  {:else}
    <h1
      class={[
        'line-clamp-2 break-words text-headline text-neutral-900 font-600',
        extra,
      ]}
      lang={langOf(title)}
    >
      {title}
    </h1>
  {/if}
{/snippet}

{#snippet media(onPhone: boolean)}
  {#if artwork}
    <div class="flex-none">
      {@render artwork(onPhone ? 88 : FLIGHT_COVER_SIZE, onPhone)}
    </div>
  {:else if onPhone}
    <Cover
      url={cover?.url ?? null}
      size={FLIGHT_COVER_SIZE}
      fluid
      eager
      {flight}
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
      size={FLIGHT_COVER_SIZE}
      eager
      {flight}
      placeholder={cover?.placeholder}
      fallback={cover?.fallback}
      class={round
        ? 'rounded-full shadow-ambient'
        : 'rounded-xl shadow-ambient'}
    />
  {/if}
{/snippet}

{#snippet metaBlock(onPhone: boolean)}
  {#if meta}
    <p
      class={[
        'flex flex-wrap items-center gap-x-1.5 text-neutral-600 tabular-nums',
        onPhone ? 'text-caption' : 'mt-2 text-label',
        onPhone && phoneLayout === 'center' && 'mt-1.5 justify-center',
        onPhone && phoneLayout === 'row' && 'mt-0.5',
        onPhone && phoneLayout === 'banner' && 'mt-1',
      ]}
    >
      {@render meta(onPhone)}
    </p>
  {/if}
{/snippet}

{#snippet actionsBlock(onPhone: boolean)}
  {#if onPhone}
    {#if actions}
      <div
        class={[
          'flex flex-wrap items-center gap-2',
          phoneLayout === 'center' ? 'mt-4 min-h-11 justify-center' : 'mt-4',
        ]}
      >
        {@render actions(false)}
      </div>
    {/if}
  {:else}
    {#if actions || search}
      <div class={align === 'center' ? 'mt-6' : 'mt-auto pt-4'}>
        <div
          class="min-w-0 flex items-center gap-3"
          bind:clientWidth={toolbarWidth}
        >
          {#if actions}
            <div class="flex flex-none items-center gap-2">
              {@render actions(compact)}
            </div>
          {/if}
          {#if search}
            <div class="min-w-0 flex flex-1 justify-end">
              {@render search(compact)}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
{/snippet}

{#snippet extraBlocks(onPhone: boolean)}
  {#if tags.length > 0}
    <p
      class={[
        'mt-2.5 flex flex-wrap gap-1.5',
        onPhone && phoneLayout === 'center' && 'justify-center',
      ]}
    >
      {#each tags as tag (tag)}<Tag>{tag}</Tag>{/each}
    </p>
  {/if}
  {#if description && !onPhone}<div class="mt-2">
      <DescriptionPreview text={description} name={title} />
    </div>{/if}
  {#if note}<div class={onPhone ? 'mt-4' : 'mt-2'}>{@render note()}</div>{/if}
  {@render actionsBlock(onPhone)}
  {#if description && onPhone}<div class="mt-4">
      <DescriptionPreview text={description} name={title} phone />
    </div>{/if}
{/snippet}

{#if artwork || ready}
  {#if phone && phoneLayout === 'banner'}
    <header class="px-4 pt-2" in:reveal>
      {@render media(true)}
      {@render titleBlock(true, 'mt-4')}
      {@render metaBlock(true)}
      {@render extraBlocks(true)}
    </header>
  {:else if phone && phoneLayout === 'row'}
    <header class="px-4 pt-2" in:reveal>
      <div class="flex items-center gap-4">
        {@render media(true)}
        <div class="min-w-0 flex-1">
          {@render titleBlock(true, '')}
          {@render metaBlock(true)}
        </div>
      </div>
      {@render extraBlocks(true)}
    </header>
  {:else if phone}
    <header class="px-4 pt-2 text-center" in:reveal>
      {@render media(true)}
      {@render titleBlock(true, 'mt-4')}
      {@render metaBlock(true)}
      {@render extraBlocks(true)}
    </header>
  {:else}
    <header
      class={['flex pt-2', align === 'center' ? 'items-center gap-8' : 'gap-7']}
      in:reveal
    >
      {@render media(false)}
      <div
        class={[
          'min-w-0 flex flex-1 flex-col',
          align === 'center' ? 'justify-center' : 'pt-1',
        ]}
      >
        {@render titleBlock(false, '')}
        {@render metaBlock(false)}
        {@render extraBlocks(false)}
      </div>
    </header>
  {/if}
{:else if phone}
  <header class="px-4 pt-2 text-center" out:fadeAway aria-hidden="true">
    <span
      class={[
        'bone block aspect-square w-full',
        PHONE_COVER_CLASS,
        round ? 'rounded-full' : 'rounded-xl',
      ]}
    ></span>
    <span class="mx-auto mt-4 h-8 w-1/2 flex items-center"
      ><span class="bone h-6 w-full rounded-full"></span></span
    >
    <span class="mx-auto mt-1.5 h-5 w-1/3 flex items-center"
      ><span class="bone h-3 w-full rounded-full"></span></span
    >
    {#if actions}
      <span class="mt-4 h-11 flex items-center justify-center"
        ><span class="bone h-10 w-30 rounded-full"></span></span
      >
    {/if}
  </header>
{:else}
  <header
    class={[
      'pt-2',
      align === 'center' ? 'flex items-center gap-8' : 'flex gap-7',
    ]}
    out:fadeAway
    aria-hidden="true"
  >
    <span
      class={[
        'bone aspect-square flex-none',
        round ? 'rounded-full' : 'rounded-xl',
      ]}
      style:width={`${FLIGHT_COVER_SIZE}px`}
    ></span>
    <div
      class={['min-w-0 flex flex-1 flex-col', align === 'center' ? '' : 'pt-1']}
    >
      <span class="h-9 w-2/5 flex items-center"
        ><span class="bone h-7 w-full rounded-full"></span></span
      >
      <span class="mt-2 h-5 w-1/4 flex items-center"
        ><span class="bone h-3.5 w-full rounded-full"></span></span
      >
      {#if actions || search}
        <span class={align === 'center' ? 'mt-6' : 'mt-auto pt-4'}
          ><span class="bone h-10 w-30 rounded-full"></span></span
        >
      {/if}
    </div>
  </header>
{/if}
