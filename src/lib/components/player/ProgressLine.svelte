<script lang="ts">
  import { getAppView } from '../shared/app-context.svelte';
  import { progressOf } from './now';

  const view = getAppView();
  const progress = $derived(progressOf(view.state.player));
</script>

<div
  class="absolute inset-x-0 bottom-0 h-[2px] bg-primary-100"
  aria-hidden="true"
>
  <div
    class="h-full bg-primary-700 transition-[width] duration-move-tick ease-linear"
    style:width="{progress * 100}%"
  ></div>
</div>
