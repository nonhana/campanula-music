<!--
  页头“下载”打开的选歌弹窗（#39）：和添加歌曲同一套 DialogShell，桌面 560px、手机接近全屏的底部弹层。
  标题下面写是哪张歌单 / 专辑；内容在 DownloadPickerPanel。正在加进队列时关不掉（downloadPicker.busy）。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'

  import { playlistName } from '#lib/api/library.js'

  import DialogShell from '../overlay/DialogShell.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import type { DownloadPickerRequest } from '../overlay/overlay-requests'
  import { getAppView } from '../shared/app-context.svelte'
  import { langOf } from '../shared/text'
  import TextButton from '../ui/TextButton.svelte'
  import DownloadPickerPanel from './DownloadPickerPanel.svelte'

  const view = getAppView()
  const { downloadPicker } = getOverlays()

  const nameOf = (request: DownloadPickerRequest): string => {
    if (request.kind === 'album') {
      const page = view.state.library?.albumPage(request.albumId) ?? null
      return page?.status === 'shown'
        ? page.content.album.name ?? '未知专辑'
        : ''
    }
    const page = view.state.library?.playlistPage(request.playlistId) ?? null
    return page
      ? playlistName({ name: page.info?.name ?? null, kind: page.kind })
      : ''
  }
</script>

<DialogShell layer={downloadPicker} title={() => '下载歌曲'} size={() => 'picker'}>
  {#snippet subtitle(request: DownloadPickerRequest)}
    {@const name = nameOf(request)}
    {#if name}
      <p class='truncate text-caption text-neutral-600' lang={langOf(name)}>「{name}」</p>
    {/if}
  {/snippet}
  {#snippet children(request: DownloadPickerRequest, sheet: boolean, heading: Snippet<[classes: string]>)}
    {#if sheet}
      <div class='flex flex-none items-center gap-2 px-4 pb-2'>
        {@render heading('min-w-0 flex-1 truncate text-title-sm text-neutral-900 font-600')}
        <TextButton tone='neutral' size='body' disabled={downloadPicker.busy} onclick={() => downloadPicker.close()}>取消</TextButton>
      </div>
    {/if}
    <DownloadPickerPanel {request} {sheet} />
  {/snippet}
</DialogShell>
