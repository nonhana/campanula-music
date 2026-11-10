<!-- 每格的 id 是 id 加 -键-tab，aria-controls 指向 id 加 -键，tabpanel 由调用方画 -->
<script lang="ts" generics="K extends string">
  import { tick } from 'svelte';
  import type { ClassValue } from 'svelte/elements';

  interface Props {
    options: readonly { key: K; label: string }[];
    value: K;
    onchange: (key: K) => void;
    role: 'radio' | 'tab';
    id: string;
    label?: string;
    labelledby?: string;
    describedby?: string;
    class?: ClassValue;
    look?: 'track' | 'text';
  }

  const {
    options,
    value,
    onchange,
    role,
    id,
    label,
    labelledby,
    describedby,
    class: klass,
    look = 'track',
  }: Props = $props();

  let group = $state<HTMLElement>();
  const index = $derived(options.findIndex((option) => option.key === value));

  const STEPS: Record<string, (at: number, last: number) => number> = {
    ArrowRight: (at) => at + 1,
    ArrowLeft: (at) => at - 1,
    Home: () => 0,
    End: (_, last) => last,
  };
  const RADIO_STEPS: Record<string, (at: number) => number> = {
    ArrowDown: (at) => at + 1,
    ArrowUp: (at) => at - 1,
  };

  const onkeydown = async (event: KeyboardEvent) => {
    const step =
      STEPS[event.key] ??
      (role === 'radio' ? RADIO_STEPS[event.key] : undefined);
    if (!step) return;
    event.preventDefault();
    const count = options.length;
    const next = options[(step(index, count - 1) + count) % count]!;
    onchange(next.key);
    await tick();
    group
      ?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-${next.key}-tab`)}`)
      ?.focus();
  };
</script>

<div
  bind:this={group}
  class={[
    look === 'track'
      ? 'relative flex rounded-full bg-primary-50 p-1'
      : 'flex items-center',
    klass,
  ]}
  role={role === 'radio' ? 'radiogroup' : 'tablist'}
  aria-label={label}
  aria-labelledby={labelledby}
  aria-describedby={describedby}
  tabindex="-1"
  {onkeydown}
>
  {#if look === 'track'}
    <span
      class="thumb absolute inset-y-1 left-1 rounded-full bg-primary-200"
      style:width="calc((100% - 8px) / {options.length})"
      style:transform="translateX({index * 100}%)"
      aria-hidden="true"
    ></span>
  {/if}
  {#each options as option, i (option.key)}
    {@const on = option.key === value}
    {#if look === 'text' && i > 0}
      <span class="h-3 w-px flex-none bg-neutral-300" aria-hidden="true"></span>
    {/if}
    <button
      type="button"
      id="{id}-{option.key}-tab"
      {role}
      aria-checked={role === 'radio' ? on : undefined}
      aria-selected={role === 'tab' ? on : undefined}
      aria-controls={role === 'tab' ? `${id}-${option.key}` : undefined}
      tabindex={on ? 0 : -1}
      class={look === 'track'
        ? [
            'relative min-w-0 flex-1 basis-0 whitespace-nowrap rounded-full text-label font-500 transition-colors duration-state',
            on
              ? 'text-primary-950'
              : 'text-neutral-600 mouse:hover:text-neutral-900',
          ]
        : [
            'h-11 flex-none whitespace-nowrap rounded-lg px-2 text-label transition-colors duration-state',
            on
              ? 'text-neutral-900 font-600'
              : 'text-neutral-500 font-500 mouse:hover:text-neutral-800',
          ]}
      onclick={() => onchange(option.key)}>{option.label}</button
    >
  {/each}
</div>

<style>
  .thumb {
    transition: transform var(--move-panel) var(--ease-out-soft);
  }
</style>
