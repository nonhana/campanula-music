<script lang="ts">
  import type { DownloadTask } from '#lib/app/downloads.js';

  import DownloadTaskRow from './DownloadTaskRow.svelte';

  const {
    content,
    phase,
    paused,
    online,
    signedIn,
  }: {
    content: DownloadTask;
    phase: 'run' | 'exit';
    paused: boolean;
    online: boolean;
    signedIn: boolean;
  } = $props();
</script>

<div
  class={['leaving-shell', phase === 'exit' && 'leaving-exit']}
  aria-hidden="true"
>
  <div class="min-h-0 overflow-hidden">
    <DownloadTaskRow
      task={content}
      variant="panel"
      completed
      {paused}
      {online}
      {signedIn}
    />
  </div>
</div>

<style>
  .leaving-shell {
    display: grid;
    grid-template-rows: 1fr;
    transition:
      grid-template-rows var(--move-state) var(--ease-out-soft),
      opacity var(--duration-state) var(--ease-out-soft);
  }

  .leaving-exit {
    grid-template-rows: 0fr;
    opacity: 0;
  }
</style>
