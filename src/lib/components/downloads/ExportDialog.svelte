<!--
  导出（#79，ADR-0014）：把下载另存一份，连同歌曲信息写进听众这次选的文件夹。歌曲菜单（一首）和已下载页的多选（几首）都打开它，由浮层宿主挂载，外壳是 DialogShell 的 confirm 尺寸。
  - 先写明导出几首、共多大、会在选的文件夹里再占这么多空间；“选择文件夹”在这一下点按里弹出文件夹选择器（App 的 exportDownloads），听众取消就停在这一步。
  - 写的时候是“第 N/M 首 · X/Y MB”和一条薄荷进度线，可以取消：正在写的这首丢弃，已经写完的留着。Esc、返回、关闭键也是取消（overlays.svelte.ts 的 beforeClose）。
  - 写完说导出了几首、写进了哪个文件夹，附“从 Campanula 删除这 N 首”，点一下就删（导出的文件不受影响）；没导出的逐首说明原因。
  标题跟着步骤换，写的时候不换字（DESIGN.md Copy 第 6 条）。焦点每一步落在那一步的主要按钮上。
-->
<script lang='ts'>
  import { FolderOpen, Trash2 } from '@lucide/svelte'

  import { songTitle } from '#lib/api/library.js'
  import type { ExportState } from '#lib/app/export.js'

  import DialogBody from '../overlay/DialogBody.svelte'
  import DialogShell from '../overlay/DialogShell.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import type { ExportRequest } from '../overlay/overlay-requests'
  import { getAppView } from '../shared/app-context.svelte'
  import { formatCount, formatMegabytes, langOf } from '../shared/text'
  import Button from '../ui/Button.svelte'
  import { exportFailureText } from './view'

  const { exportDialog, multiSelect } = getOverlays()
  const view = getAppView()

  const exporting = $derived(view.state.exporting)
  let root = $state<HTMLElement>()
  let deleting = $state(false)

  /** 还在这台设备上的（打开以后被别的标签页删掉的不算） */
  const downloaded = (request: ExportRequest) => request.songs.filter(song => view.state.downloads.has(song.id))

  const titleOf = (request: ExportRequest): string => {
    if (exporting?.status === 'finished') {
      return exporting.exported.length > 0
        ? `已导出 ${formatCount(exporting.exported.length)} 首到「${exporting.folder}」`
        : '没能导出'
    }
    return `导出 ${formatCount(downloaded(request).length)} 首`
  }

  /** 收起：从多选打开的连多选一起收起 */
  const close = (request: ExportRequest): void => {
    void (request.multi
      ? multiSelect.leave()
      : exportDialog.close())
  }

  const deleteExported = async (request: ExportRequest, finished: Extract<ExportState, { status: 'finished' }>): Promise<void> => {
    deleting = true
    exportDialog.setBusy(true)
    try {
      await view.app.deleteDownloads(finished.exported.filter(song => view.state.downloads.has(song.id)).map(song => song.id))
    }
    finally {
      deleting = false
      exportDialog.setBusy(false)
    }
    close(request)
  }

  // 每一步把焦点交给那一步的主要按钮：确认时是“选择文件夹”，写的时候是“取消”，写完是“完成”
  const step = $derived(exporting?.status ?? 'confirm')
  $effect(() => {
    void step
    queueMicrotask(() => root?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }))
  })
</script>

<DialogShell layer={exportDialog} title={titleOf} size={() => 'confirm'}>
  {#snippet children(request: ExportRequest, sheet: boolean)}
    {@const songs = downloaded(request)}
    <div class='contents' bind:this={root}>
      <DialogBody {sheet}>
        {#snippet body()}
          {#if exporting === null}
            <p class='text-body text-neutral-700 tabular-nums'>共 {formatMegabytes(songs.reduce((sum, song) => sum + view.state.downloads.sizeOf(song.id), 0))} MB，会在选的文件夹里再占这么多空间</p>
          {:else if exporting.status === 'writing'}
            <p class='text-body text-neutral-700 tabular-nums' role='status'>
              第 {formatCount(exporting.done + 1)}/{formatCount(exporting.total)} 首 · {formatMegabytes(exporting.written)}/{formatMegabytes(exporting.bytes)} MB
            </p>
            <div class='mt-3 h-1 overflow-hidden rounded-full bg-primary-100' aria-hidden='true'>
              <div class='h-full rounded-full bg-primary-700 transition-[width] duration-state' style:width='{exporting.bytes > 0
                ? exporting.written / exporting.bytes * 100
                : 0}%'></div>
            </div>
          {:else if exporting.failed.length > 0}
            <p class='text-body text-neutral-700'>{formatCount(exporting.failed.length)} 首没导出：</p>
            <ul class='mt-2 flex flex-col gap-1.5 text-caption text-neutral-700'>
              {#each exporting.failed as { song, failure } (song.id)}
                <li><span lang={langOf(song.name)}>《{songTitle(song)}》</span>：{exportFailureText(failure)}</li>
              {/each}
            </ul>
          {/if}
        {/snippet}
        {#snippet actions()}
          {#if exporting === null}
            <Button variant='outline' onclick={() => exportDialog.close()}>取消</Button>
            <Button
              variant='primary'
              icon={FolderOpen}
              disabled={songs.length === 0}
              data-autofocus
              onclick={() => void view.app.exportDownloads(songs.map(song => song.id))}
            >选择文件夹</Button>
          {:else if exporting.status === 'writing'}
            <Button variant='outline' data-autofocus onclick={() => view.app.cancelExport()}>取消</Button>
          {:else}
            {#if exporting.exported.length > 0}
              <Button variant='outline' icon={Trash2} busy={deleting} onclick={() => void deleteExported(request, exporting)}>
                从 Campanula 删除这 {formatCount(exporting.exported.length)} 首
              </Button>
            {/if}
            <Button variant='primary' data-autofocus onclick={() => close(request)}>完成</Button>
          {/if}
        {/snippet}
      </DialogBody>
    </div>
  {/snippet}
</DialogShell>
