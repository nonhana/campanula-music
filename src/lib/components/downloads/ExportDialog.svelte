<script lang="ts">
  import { FolderOpen, Trash2 } from '@lucide/svelte';

  import { songTitle } from '#lib/api/library.js';
  import type { ExportState } from '#lib/app/export.js';

  import DialogBody from '../overlay/DialogBody.svelte';
  import DialogShell from '../overlay/DialogShell.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import type { ExportRequest } from '../overlay/overlay-requests';
  import { getAppView } from '../shared/app-context.svelte';
  import { formatCount, formatMegabytes, langOf } from '../shared/text';
  import Button from '../ui/Button.svelte';
  import { exportFailureText } from './view';

  const { exportDialog, multiSelect } = getOverlays();
  const view = getAppView();

  const exporting = $derived(view.state.exporting);
  let root = $state<HTMLElement>();
  let deleting = $state(false);

  const downloaded = (request: ExportRequest) =>
    request.songs.filter((song) => view.state.downloads.has(song.id));

  const titleOf = (request: ExportRequest): string => {
    if (exporting?.status === 'finished') {
      return exporting.exported.length > 0
        ? `已导出 ${formatCount(exporting.exported.length)} 首到「${exporting.folder}」`
        : '没能导出';
    }
    return `导出 ${formatCount(downloaded(request).length)} 首`;
  };

  const close = (request: ExportRequest): void => {
    void (request.multi ? multiSelect.leave() : exportDialog.close());
  };

  const deleteExported = async (
    request: ExportRequest,
    finished: Extract<ExportState, { status: 'finished' }>,
  ): Promise<void> => {
    deleting = true;
    exportDialog.setBusy(true);
    try {
      await view.app.deleteDownloads(
        finished.exported
          .filter((song) => view.state.downloads.has(song.id))
          .map((song) => song.id),
      );
    } finally {
      deleting = false;
      exportDialog.setBusy(false);
    }
    close(request);
  };

  const step = $derived(exporting?.status ?? 'confirm');
  $effect(() => {
    void step;
    queueMicrotask(() =>
      root
        ?.querySelector<HTMLElement>('[data-autofocus]')
        ?.focus({ preventScroll: true }),
    );
  });
</script>

<DialogShell layer={exportDialog} title={titleOf} size={() => 'confirm'}>
  {#snippet children(request: ExportRequest, sheet: boolean)}
    {@const songs = downloaded(request)}
    <div class="contents" bind:this={root}>
      <DialogBody {sheet}>
        {#snippet body()}
          {#if exporting === null}
            <p class="text-body text-neutral-700 tabular-nums">
              {formatMegabytes(
                songs.reduce(
                  (sum, song) => sum + view.state.downloads.sizeOf(song.id),
                  0,
                ),
              )} MB
            </p>
          {:else if exporting.status === 'writing'}
            <p class="text-body text-neutral-700 tabular-nums" role="status">
              第 {formatCount(exporting.done + 1)}/{formatCount(
                exporting.total,
              )} 首 · {formatMegabytes(exporting.written)}/{formatMegabytes(
                exporting.bytes,
              )} MB
            </p>
            <div
              class="mt-3 h-1 overflow-hidden rounded-full bg-primary-100"
              aria-hidden="true"
            >
              <div
                class="h-full rounded-full bg-primary-700 transition-[width] duration-state"
                style:width="{exporting.bytes > 0
                  ? (exporting.written / exporting.bytes) * 100
                  : 0}%"
              ></div>
            </div>
          {:else if exporting.failed.length > 0}
            <p class="text-body text-neutral-700">
              {formatCount(exporting.failed.length)} 首没导出：
            </p>
            <ul
              class="mt-2 flex flex-col gap-1.5 text-caption text-neutral-700"
            >
              {#each exporting.failed as { song, failure } (song.id)}
                <li>
                  <span lang={langOf(song.name)}>《{songTitle(song)}》</span
                  >：{exportFailureText(failure)}
                </li>
              {/each}
            </ul>
          {/if}
        {/snippet}
        {#snippet actions()}
          {#if exporting === null}
            <Button variant="outline" onclick={() => exportDialog.close()}
              >取消</Button
            >
            <Button
              variant="primary"
              icon={FolderOpen}
              disabled={songs.length === 0}
              data-autofocus
              onclick={() =>
                void view.app.exportDownloads(songs.map((song) => song.id))}
              >选择文件夹</Button
            >
          {:else if exporting.status === 'writing'}
            <Button
              variant="outline"
              data-autofocus
              onclick={() => view.app.cancelExport()}>取消</Button
            >
          {:else}
            {#if exporting.exported.length > 0}
              <Button
                variant="outline"
                icon={Trash2}
                busy={deleting}
                onclick={() => void deleteExported(request, exporting)}
              >
                删除 Campanula 内的下载
              </Button>
            {/if}
            <Button
              variant="primary"
              data-autofocus
              onclick={() => close(request)}>完成</Button
            >
          {/if}
        {/snippet}
      </DialogBody>
    </div>
  {/snippet}
</DialogShell>
