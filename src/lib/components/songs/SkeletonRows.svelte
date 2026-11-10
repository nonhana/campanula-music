<!-- 最外层已经带 out:fadeAway，外面不要再包一层淡出 -->
<script lang="ts">
  import type { ClassValue } from 'svelte/elements';

  import { fadeAway } from '../shared/motion';
  import { SONG_COLUMNS, SONG_GRID } from './SongRow.svelte';

  interface Props {
    count: number;
    look?: 'desktop' | 'phone' | 'numbered' | 'pick';
    trailing?: boolean;
    label: string;
    class?: ClassValue;
  }

  const {
    count,
    look = 'desktop',
    trailing = false,
    label,
    class: klass,
  }: Props = $props();
  const widths = [72, 54, 81, 63, 48, 76, 58, 69, 51, 66];
</script>

{#snippet phoneRow(w: number)}
  <div
    class="grid grid-cols-[48px_minmax(0,1fr)_44px] h-14 items-center gap-3.5 pl-4 pr-1"
  >
    <span class="bone size-12 rounded-md"></span>
    <span class="flex flex-col gap-2">
      <span class="bone h-3.5 rounded-full" style:width="{w}%"></span>
      <span class="bone h-3 rounded-full" style:width="{Math.round(w * 0.55)}%"
      ></span>
    </span>
  </div>
{/snippet}

<div
  class={klass}
  role="status"
  aria-busy="true"
  aria-label={label}
  out:fadeAway
>
  {#each { length: count }, i (i)}
    {@const w = widths[i % widths.length]!}
    {#if look === 'phone'}
      {@render phoneRow(w)}
    {:else if look === 'numbered'}
      <!-- 对齐 SongList 的带曲序行：36px 序号列、行往左收 8px -->
      <div class="h-14 flex items-center">
        <span class="w-9 flex-none pl-4"
          ><span class="bone h-3 w-2.5 rounded-full"></span></span
        >
        <div class="min-w-0 flex-1 -ml-2">{@render phoneRow(w)}</div>
      </div>
    {:else if look === 'pick'}
      <div class="h-14 flex items-center gap-3 pl-4 pr-3">
        <span class="bone size-[22px] flex-none rounded-md"></span>
        <span class="bone size-10 flex-none rounded-md"></span>
        <span class="min-w-0 flex flex-1 flex-col gap-2">
          <span class="bone h-3.5 rounded-full" style:width="{w}%"></span>
          <span
            class="bone h-3 rounded-full"
            style:width="{Math.round(w * 0.5)}%"
          ></span>
        </span>
        {#if trailing}<span class="bone h-3 w-12 flex-none rounded-full"
          ></span>{/if}
      </div>
    {:else}
      <div class={[SONG_GRID, 'h-14']}>
        <span class={['bone h-3 w-4 rounded-full', SONG_COLUMNS.index]}></span>
        <span class="flex items-center gap-3">
          <span class="bone size-10 flex-none rounded-md"></span>
          <span class="flex flex-1 flex-col gap-2">
            <span class="bone h-3.5 rounded-full" style:width="{w}%"></span>
            <span
              class="bone h-3 rounded-full"
              style:width="{Math.round(w * 0.5)}%"
            ></span>
          </span>
        </span>
        <span class="bone h-3 rounded-full" style:width="{Math.round(w * 0.7)}%"
        ></span>
        <span></span>
        <span class={['bone h-3 w-8 rounded-full', SONG_COLUMNS.duration]}
        ></span>
      </div>
    {/if}
  {/each}
</div>
