<script lang="ts" generics="K extends string">
  import type { ResolvedPathname } from '$app/types';
  import type { ClassValue } from 'svelte/elements';

  import { fade } from '../shared/motion';
  import { formatCount } from '../shared/text';

  interface Props {
    tabs: readonly {
      key: K;
      label: string;
      href: ResolvedPathname;
      count?: number | null;
    }[];
    selected: K;
    onselect: (key: K) => Promise<void> | void;
    idOf: (key: K) => string;
    panel: string;
    label: string;
    class?: ClassValue;
  }

  const {
    tabs,
    selected,
    onselect,
    idOf,
    panel,
    label,
    class: klass,
  }: Props = $props();

  let strip = $state<HTMLElement>();

  const tabOf = (key: K): HTMLElement | null =>
    strip?.querySelector<HTMLElement>(`#${CSS.escape(idOf(key))}`) ?? null;

  // 不用 scrollIntoView：它会连页面一起滚，这里只能动这一条
  $effect(() => {
    const tab = tabOf(selected);
    if (!strip || !tab) return;
    const bounds = strip.getBoundingClientRect();
    const box = tab.getBoundingClientRect();
    if (box.left < bounds.left) strip.scrollLeft -= bounds.left - box.left;
    else if (box.right > bounds.right)
      strip.scrollLeft += box.right - bounds.right;
  });

  const select = async (key: K) => {
    await onselect(key);
    tabOf(key)?.focus({ preventScroll: true });
  };

  const onkeydown = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const KEYS: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const to = KEYS[event.key];
    if (to === undefined) return;
    event.preventDefault();
    void select(tabs[to]!.key);
  };

  const onclick = (event: MouseEvent, key: K) => {
    event.preventDefault();
    void select(key);
  };
</script>

<div
  bind:this={strip}
  class={['flex overflow-x-auto', klass]}
  role="tablist"
  aria-label={label}
>
  {#each tabs as tab, index (tab.key)}
    {@const on = tab.key === selected}
    <!-- eslint-disable svelte/no-navigation-without-resolve -- 地址由调用方用 resolve() 拼好（还带着查询串），这里只画 -->
    <a
      href={tab.href}
      id={idOf(tab.key)}
      role="tab"
      aria-selected={on}
      aria-controls={panel}
      tabindex={on ? 0 : -1}
      data-sveltekit-replacestate
      class={[
        'relative h-11 flex flex-none items-center rounded-lg px-3 text-body transition-colors duration-feedback',
        on
          ? 'text-neutral-900 font-600'
          : 'text-neutral-500 font-500 mouse:hover:text-neutral-800',
      ]}
      onkeydown={(event) => onkeydown(event, index)}
      onclick={(event) => onclick(event, tab.key)}
    >
      {tab.label}
      {#if tab.count === null}
        <span
          class="bone ml-1 inline-block h-3 w-6 rounded-full"
          aria-hidden="true"
        ></span>
      {:else if tab.count !== undefined}
        <span class="ml-1 text-caption font-500 tabular-nums" in:fade
          >{formatCount(tab.count)}</span
        >
      {/if}
      {#if on}
        <!-- 换页过渡把新旧两条叫同一个 view-transition-name 才会滑过去 -->
        <span
          class="absolute bottom-1 left-1/2 h-[3px] w-4 rounded-full bg-primary-800 -translate-x-1/2"
          style:view-transition-name="tab-line"
          aria-hidden="true"
        ></span>
      {/if}
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  {/each}
</div>
