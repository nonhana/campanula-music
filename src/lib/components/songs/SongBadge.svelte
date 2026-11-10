<script lang="ts">
  import type { SongBadgeKind } from './song-look';

  const { kind }: { kind: SongBadgeKind | null } = $props();
  const LABELS: Record<SongBadgeKind, string> = {
    noCopyright: '无版权',
    notDownloaded: '未下载',
    trial: '试听',
  };
</script>

{#if kind}
  <span
    class={[
      'flex-none rounded-sm px-1.5 text-micro font-500',
      kind === 'trial'
        ? 'bg-warning-50 text-warning-900'
        : 'bg-neutral-100 text-neutral-700',
    ]}>{LABELS[kind]}</span
  >
{/if}
