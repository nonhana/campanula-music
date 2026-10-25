<!--
  按歌单删除下载（#40）：列出这台设备上从哪几张歌单下载过、各有几首。只有歌单（专辑、单独下载的不在这里），
  点“删除”先确认；别处也下载过的歌会留着，只去掉这张歌单（规则⑦）。没登录时也能用：来源记在下载里，不靠曲库副本。
  下载还没从本机读出来、一张歌单都没有时各写一句。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'

  import DialogBody from '../overlay/DialogBody.svelte'
  import DialogShell from '../overlay/DialogShell.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import type { DialogRequest } from '../overlay/overlay-requests'
  import { getAppView } from '../shared/app-context.svelte'
  import { formatCount, langOf } from '../shared/text'
  import TextButton from '../ui/TextButton.svelte'
  import { playlistDownloadSources } from './view'

  const view = getAppView()
  const { playlistDownloads, deletePlaylistDownloadsConfirm } = getOverlays()
  // 弹窗没开时不算：几千首下载不必跟着每次进度重算
  const sources = $derived(playlistDownloads.request
    ? playlistDownloadSources(view.state.downloads)
    : [])
</script>

<DialogShell layer={playlistDownloads} title={() => '按歌单删除下载'} size={() => 'form'}>
  {#snippet children(_request: DialogRequest, sheet: boolean, heading: Snippet<[classes: string]>)}
    {#if sheet}
      <div class='flex flex-none items-center gap-2 px-4 pb-2'>
        {@render heading('min-w-0 flex-1 truncate text-title-sm text-neutral-900 font-600')}
        <TextButton tone='neutral' size='body' onclick={() => playlistDownloads.close()}>完成</TextButton>
      </div>
    {/if}
    <DialogBody {sheet}>
      {#snippet body()}
        <p class='text-caption text-neutral-600'>只删从这张歌单下载的歌；别的歌单、专辑也下载过，或者单独下载过的，会留着。</p>
        {#if view.state.downloads.songs === null}
          <p class='mt-4 text-body text-neutral-700'>正在读出这台设备上的下载…</p>
        {:else if sources.length === 0}
          <p class='mt-4 text-body text-neutral-700'>这台设备上还没有从歌单下载的歌</p>
        {:else}
          <ul class='mt-2 divide-y divide-neutral-100'>
            {#each sources as source (source.id)}
              <li class='min-h-14 flex items-center gap-3 py-1'>
                <span class='min-w-0 flex-1 truncate text-body text-neutral-900' lang={langOf(source.name)}>{source.name}</span>
                <span class='flex-none text-caption text-neutral-600 tabular-nums'>{formatCount(source.count)} 首</span>
                <TextButton
                  tone='neutral'
                  size='body'
                  class='-mr-3'
                  aria-label={`删除从「${source.name}」下载的 ${formatCount(source.count)} 首`}
                  onclick={(event: MouseEvent) => deletePlaylistDownloadsConfirm.open({
                    playlistId: source.id,
                    name: source.name,
                    count: source.count,
                    from: event.currentTarget as HTMLElement,
                  })}
                >删除</TextButton>
              </li>
            {/each}
          </ul>
        {/if}
      {/snippet}
    </DialogBody>
  {/snippet}
</DialogShell>
