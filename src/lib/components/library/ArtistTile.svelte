<script lang="ts">
  import { resolve } from '$app/paths';
  import { UserRound } from '@lucide/svelte';

  import { langOf } from '../shared/text';
  import Cover from '../ui/Cover.svelte';
  import CollectButton from './CollectButton.svelte';
  import { FLIGHT_COVER_SIZE } from './flight';

  interface Props {
    id: number;
    name: string | null;
    avatarUrl: string | null;
    detail?: string;
    collectable?: boolean;
  }

  const {
    id,
    name,
    avatarUrl,
    detail = '',
    collectable = false,
  }: Props = $props();
  const page = $derived(resolve('/artists/[id=neteaseId]', { id }));
</script>

<div class="relative min-w-0">
  <a
    href={resolve('/artists/[id=neteaseId]', { id })}
    class="group block min-w-0 rounded-lg text-center"
  >
    <Cover
      url={avatarUrl}
      size={FLIGHT_COVER_SIZE}
      fluid
      flight={page}
      fallback={UserRound}
      class="rounded-full shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95"
    />
    {#if name !== null}
      <span
        class="mt-2.5 block truncate text-label text-neutral-900 font-500"
        lang={langOf(name)}>{name}</span
      >
    {/if}
    {#if detail}
      <span
        class={[
          'block truncate text-caption text-neutral-600 tabular-nums',
          name === null ? 'mt-2.5' : 'mt-0.5',
        ]}>{detail}</span
      >
    {/if}
  </a>
  {#if collectable}
    <div class="pointer-events-none absolute inset-x-0 top-0 aspect-square">
      <CollectButton
        target={{ kind: 'artist', id }}
        {name}
        look="corner"
        class="pointer-events-auto absolute bottom-[calc(14.6%-16px)] right-[calc(14.6%-16px)]"
      />
    </div>
  {/if}
</div>
