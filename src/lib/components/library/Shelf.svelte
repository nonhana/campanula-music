<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ClassValue } from 'svelte/elements';

  import { dragScroll } from '../shared/drag-scroll';
  import Scrollbar from '../ui/Scrollbar.svelte';

  interface Props {
    label: string;
    class?: ClassValue;
    phone?: boolean;
    children: Snippet;
  }

  const { label, class: klass, phone = false, children }: Props = $props();

  const keepInView = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement)
      event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
</script>

<!-- data-shelf 让页面返回时按它恢复横向滚动位置 -->
<div
  class={['overflow-x-auto', !phone && '-mx-2']}
  data-shelf={label}
  {@attach dragScroll}
>
  <Scrollbar axis="x" />
  <ul
    class={['w-max flex pb-3 pt-1', phone ? 'px-4' : 'px-2', klass]}
    aria-label={label}
    onfocusin={keepInView}
    data-reveal-group
  >
    {@render children()}
  </ul>
</div>
