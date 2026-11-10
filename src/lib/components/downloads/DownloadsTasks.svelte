<script lang="ts">
  import { WifiOff } from '@lucide/svelte';

  import type { DownloadTask } from '#lib/app/downloads.js';

  import { getAppView } from '../shared/app-context.svelte';
  import { desktopLayout } from '../shared/layout';
  import { formatCount } from '../shared/text';
  import Button from '../ui/Button.svelte';
  import VirtualList from '../ui/VirtualList.svelte';
  import DownloadTaskRow from './DownloadTaskRow.svelte';

  const view = getAppView();
  const phone = $derived(!desktopLayout.current);
  const downloads = $derived(view.state.downloads);
  const tasks = $derived([...downloads.tasks.values()]);
  const paused = $derived(downloads.paused !== null);
  const online = $derived(view.state.online);
  const signedIn = $derived(view.state.session.status === 'signedIn');
  const needsLogin = $derived(
    !signedIn && tasks.some((task) => task.status === 'queued'),
  );

  const cancel = (task: DownloadTask): void =>
    view.app.cancelDownload(task.song.id);
  const retry = (task: DownloadTask): void =>
    view.app.retryDownload(task.song.id);
</script>

{#snippet taskRow(task: DownloadTask)}
  <DownloadTaskRow
    {task}
    variant="page"
    {paused}
    {online}
    {signedIn}
    oncancel={() => cancel(task)}
    onretry={() => retry(task)}
  />
{/snippet}

{#if tasks.length > 0}
  <section class={phone ? 'pt-5' : 'mt-8'}>
    <div
      class={[
        'flex flex-wrap items-center gap-2',
        phone ? 'px-4 pb-1' : 'mb-3',
      ]}
    >
      <h2
        class={[
          'text-neutral-900 font-600',
          phone ? 'text-title-sm' : 'text-title',
        ]}
      >
        正在下载
      </h2>
      <span class="text-label text-neutral-500 tabular-nums"
        >{formatCount(tasks.length)} 首</span
      >
      {#if paused}
        <span class="ml-auto text-caption text-neutral-700"
          >存储空间不够，已暂停</span
        >
        <Button
          variant="download"
          class="px-4 md:h-9 text-caption!"
          onclick={() => view.app.resumeDownloads()}>继续下载</Button
        >
      {:else if needsLogin}
        <span class="ml-auto text-caption text-neutral-700">排队歌曲需登录</span
        >
      {:else if !online}
        <span
          class="ml-auto inline-flex items-center gap-1.5 text-caption text-neutral-600"
        >
          <WifiOff size={14} aria-hidden="true" />离线时暂停下载
        </span>
      {/if}
    </div>
    <div
      role="group"
      aria-label="正在下载的歌曲"
      class={phone ? '' : 'rounded-xl bg-white p-2 shadow-ambient'}
    >
      <VirtualList
        items={tasks}
        itemHeight={phone ? 64 : 56}
        getKey={(task: DownloadTask) => task.song.id}
        row={taskRow}
      />
    </div>
  </section>
{/if}
