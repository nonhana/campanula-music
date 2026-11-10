<script lang="ts">
  import { ChevronRight } from '@lucide/svelte';

  import { getOverlays } from '../overlay/overlay-context';
  import { langOf } from '../shared/text';

  interface Props {
    text: string;
    name: string;
    phone?: boolean;
  }

  const { text, name, phone = false }: Props = $props();
  const { descriptionDialog } = getOverlays();
  let preview = $state<HTMLElement>();
  let clipped = $state(false);

  $effect(() => {
    void text;
    const element = preview;
    if (!element) return;
    const measure = () => {
      clipped = phone
        ? element.scrollHeight > element.clientHeight + 1
        : element.scrollWidth > element.clientWidth + 1;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });

  const open = (event: MouseEvent) =>
    descriptionDialog.open({
      name,
      text,
      from: event.currentTarget as HTMLElement,
    });
</script>

{#snippet line(classes: string)}
  <span bind:this={preview} class={['min-w-0', classes]} lang={langOf(text)}
    >{text}</span
  >
{/snippet}

<section aria-label="简介">
  {#if phone && clipped}
    <button
      type="button"
      class="w-full flex items-center gap-3 rounded-xl bg-white p-4 text-left text-neutral-600 shadow-ambient"
      aria-haspopup="dialog"
      aria-label="查看简介"
      onclick={open}
    >
      {@render line(
        'flex-1 line-clamp-2 whitespace-pre-line break-words text-caption',
      )}
      <ChevronRight
        size={18}
        class="flex-none text-neutral-500"
        aria-hidden="true"
      />
    </button>
  {:else if phone}
    <p
      class="flex rounded-xl bg-white p-4 text-left text-neutral-600 shadow-ambient"
    >
      {@render line(
        'flex-1 line-clamp-2 whitespace-pre-line break-words text-caption',
      )}
    </p>
  {:else if clipped}
    <button
      type="button"
      class="h-7 max-w-full flex items-center gap-1 rounded text-left text-label text-neutral-600 transition-colors duration-feedback mouse:hover:text-neutral-900"
      aria-haspopup="dialog"
      aria-label="查看简介"
      onclick={open}
    >
      {@render line('truncate')}
      <ChevronRight size={16} class="flex-none" aria-hidden="true" />
    </button>
  {:else}
    <p class="h-7 flex items-center text-label text-neutral-600">
      {@render line('truncate')}
    </p>
  {/if}
</section>
