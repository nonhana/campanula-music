<script lang="ts">
  import { CircleAlert } from '@lucide/svelte';
  import type { ClassValue } from 'svelte/elements';

  import type { RequestFailure } from '#lib/app/api-client.js';

  import { failureText } from '../shared/failure';
  import { fade } from '../shared/motion';
  import Button from './Button.svelte';

  interface Props {
    more:
      | { status: 'notLoaded' | 'loading' }
      | { status: 'failed'; failure: RequestFailure }
      | null;
    onmore: () => void;
    failed?: string;
    class?: ClassValue;
  }

  const {
    more,
    onmore,
    failed = '没能加载更多',
    class: klass,
  }: Props = $props();

  let retrying = $state(false);
  const onclick = () => {
    retrying = more?.status === 'failed';
    onmore();
  };
</script>

{#if more}
  <div
    class={['flex flex-wrap items-center justify-center gap-3', klass]}
    out:fade
  >
    {#if more.status === 'failed'}
      <p
        class="min-w-0 flex items-center gap-2 text-caption text-neutral-700"
        role="alert"
        in:fade
      >
        <CircleAlert
          size={16}
          class="flex-none text-error-700"
          aria-hidden="true"
        />
        <span>{failed}：{failureText(more.failure)}</span>
      </p>
    {/if}
    <Button variant="outline" busy={more.status === 'loading'} {onclick}>
      {more.status === 'failed' || (more.status === 'loading' && retrying)
        ? '重试'
        : '显示更多'}
    </Button>
  </div>
{/if}
