<!--
  PROTOTYPE：已下载页上方的“正在下载”：下载中（蜜桃进度条 + 百分比）、排队中、下载失败（重试）。
  下载要联网：离线时下载中的写“已暂停”，重试不可用并写明原因。
-->
<script lang='ts'>
  import type { DownloadState } from '$lib/prototype/data'
  import { downloadTasks } from '$lib/prototype/catalog'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { CircleAlert, Clock, WifiOff } from '@lucide/svelte'
  import { SvelteSet } from 'svelte/reactivity'

  interface Props {
    phone: boolean
  }

  const { phone }: Props = $props()

  /** 原型里“重试”只是把失败的改成排队中 */
  const retried = new SvelteSet<string>()

  function stateOf(id: string, s: DownloadState | undefined) {
    return retried.has(id) ? 'queued' : s
  }
</script>

<section class={phone ? 'pt-5' : 'mt-8'} aria-labelledby='dl-tasks'>
  <div class={['flex items-baseline gap-2', phone ? 'px-4 pb-1' : 'mb-3']}>
    <h2 id='dl-tasks' class={['font-600 text-neutral-900', phone ? 'text-[17px] leading-6' : 'text-[20px] leading-7']}>正在下载</h2>
    <span class='text-[14px] text-neutral-500 tnum'>{downloadTasks.length} 首</span>
    {#if nav.offline}
      <span class='ml-auto inline-flex items-center gap-1.5 self-center text-[13px] text-neutral-600'>
        <WifiOff size={14} aria-hidden='true' />离线时暂停下载
      </span>
    {/if}
  </div>

  <ul class={phone ? '' : 'rounded-2xl bg-white p-2 shadow-ambient'}>
    {#each downloadTasks as song (song.id)}
      {@const st = stateOf(song.id, song.download)}
      {@const pct = Math.round((song.downloadProgress ?? 0) * 100)}
      <li class={['grid items-center', phone ? 'h-16 grid-cols-[48px_minmax(0,1fr)_auto] gap-3.5 pl-4 pr-3' : 'h-14 grid-cols-[40px_minmax(0,1fr)_240px_96px] gap-4 pl-3 pr-2']}>
        <Cover cover={song.cover} class={phone ? 'size-12 rounded-lg' : 'size-10 rounded-lg'} />
        <span class='min-w-0'>
          <span class={['block truncate font-500 text-neutral-900', phone ? 'text-[15px] leading-5' : 'text-[14px] leading-5']} lang={song.lang}>{song.title}</span>
          {#if phone}
            <span class='mt-1 flex min-w-0 items-center gap-2 text-[13px] leading-[18px]'>
              {@render status(st, pct)}
            </span>
          {:else}
            <span class='block truncate text-[13px] leading-5 text-neutral-600' lang={song.lang}>{artistLine(song)}</span>
          {/if}
        </span>
        {#if !phone}
          <span class='flex min-w-0 items-center gap-2.5 text-[13px]'>{@render status(st, pct)}</span>
        {/if}
        <span class='flex justify-end'>
          {#if st === 'failed'}
            <button
              class={['retry rounded-full border border-neutral-200 bg-white font-500 text-primary-900 disabled:text-neutral-500', phone ? 'h-11 px-4 text-[14px] active:bg-primary-100' : 'h-8 px-4 text-[13px]']}
              disabled={nav.offline}
              title={nav.offline ? '离线时不能下载' : undefined}
              onclick={() => retried.add(song.id)}
            >重试<span class='sr-only'>：{song.title}</span></button>
          {/if}
        </span>
      </li>
    {/each}
  </ul>
</section>

{#snippet status(st: string | undefined, pct: number)}
  {#if st === 'downloading'}
    <span class={['relative h-1.5 flex-none overflow-hidden rounded-full bg-secondary-100', phone ? 'w-24' : 'w-32']} aria-hidden='true'>
      <span class='absolute inset-y-0 left-0 rounded-full bg-secondary-700' style:width='{pct}%'></span>
    </span>
    <span class='text-secondary-900 tnum'>{nav.offline ? '已暂停' : '下载中'} {pct}%</span>
  {:else if st === 'queued'}
    <Clock size={14} class='flex-none text-neutral-500' aria-hidden='true' />
    <span class='text-neutral-600'>排队中</span>
  {:else if st === 'failed'}
    <CircleAlert size={14} class='flex-none text-error-700' aria-hidden='true' />
    <span class='text-error-700'>下载失败</span>
  {/if}
{/snippet}

<style>
  @media (hover: hover) and (pointer: fine) {
    .retry:not(:disabled):hover {
      background: #e8f8f1;
      color: #1a5b43;
      border-color: #b9ead5;
    }
  }
</style>
