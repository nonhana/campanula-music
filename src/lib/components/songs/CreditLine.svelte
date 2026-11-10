<script lang="ts">
  import type { ClassValue } from 'svelte/elements';

  import type { Credit } from '#lib/api/library.js';
  import { creditLine } from '#lib/api/library.js';

  import { langOf } from '../shared/text';
  import CreditName from './CreditName.svelte';

  interface Props {
    artists: readonly Credit[];
    linked: boolean;
    tabbable?: boolean;
    spoken?: boolean;
    padded?: boolean;
    class?: ClassValue;
  }

  const {
    artists,
    linked,
    tabbable = false,
    spoken = true,
    padded = false,
    class: klass,
  }: Props = $props();
  const named = $derived(artists.filter((artist) => artist.name !== null));
  const line = $derived(creditLine(artists));
</script>

<span
  class={klass}
  lang={langOf(line)}
  aria-hidden={spoken ? undefined : 'true'}
  >{#each named as artist, i (i)}{#if i > 0}
      /
    {/if}<CreditName
      kind="artist"
      target={artist}
      {linked}
      {tabbable}
      {padded}
    />{:else}{line}{/each}</span
>
