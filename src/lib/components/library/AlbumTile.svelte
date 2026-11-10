<script lang="ts">
  import { resolve } from '$app/paths';

  import { langOf } from '../shared/text';
  import Cover from '../ui/Cover.svelte';
  import CollectButton from './CollectButton.svelte';
  import { FLIGHT_COVER_SIZE } from './flight';

  interface Props {
    id: number;
    name: string | null;
    coverUrl: string | null;
    detail: string;
    year?: number | null;
    phone?: boolean;
    collectable?: boolean;
  }

  const {
    id,
    name,
    coverUrl,
    detail,
    year = null,
    phone = false,
    collectable = false,
  }: Props = $props();
  const page = $derived(resolve('/albums/[id=neteaseId]', { id }));
</script>

<div class="relative min-w-0">
  <a
    href={resolve('/albums/[id=neteaseId]', { id })}
    class="group block min-w-0 rounded-lg"
  >
    <Cover
      url={coverUrl}
      size={FLIGHT_COVER_SIZE}
      fluid
      flight={page}
      class="rounded-lg shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95"
    />
    {#if name !== null}
      <span
        class={[
          'mt-2.5 block truncate text-neutral-900 font-500',
          phone ? 'text-body' : 'text-label',
        ]}
        lang={langOf(name)}>{name}</span
      >
    {/if}
    {#if detail || year !== null}
      <span
        class={[
          'min-w-0 flex gap-1 text-caption text-neutral-600 tabular-nums',
          name === null ? 'mt-2.5' : 'mt-0.5',
        ]}
      >
        {#if detail}<span class="truncate" lang={langOf(detail)}>{detail}</span
          >{/if}
        {#if year !== null}<span class="flex-none"
            >{detail ? `· ${year}` : year}</span
          >{/if}
      </span>
    {/if}
  </a>
  {#if collectable}
    <div class="pointer-events-none absolute inset-x-0 top-0 aspect-square">
      <CollectButton
        target={{ kind: 'album', id }}
        {name}
        look="corner"
        class="pointer-events-auto absolute bottom-2 right-2"
      />
    </div>
  {/if}
</div>
