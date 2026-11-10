<script lang="ts">
  import { CircleCheck, CirclePlus } from '@lucide/svelte';
  import type { ClassValue } from 'svelte/elements';

  import type { CollectTarget } from '#lib/app/app.js';

  import { getAppView } from '../shared/app-context.svelte';
  import { iconSwap } from '../shared/motion';
  import ToolButton from '../ui/ToolButton.svelte';
  import { COLLECT_NOUNS, collectState } from './collect';

  interface Props {
    target: CollectTarget;
    name: string | null;
    look: 'pill' | 'icon' | 'corner';
    class?: ClassValue;
  }

  const { target, name, look, class: klass }: Props = $props();
  const view = getAppView();
  const library = $derived(view.state.library);
  const status = $derived(library ? collectState(library, target) : null);
  const collected = $derived(status === 'collected');
  const Icon = $derived(collected ? CircleCheck : CirclePlus);
  const label = $derived(
    name === null
      ? `收藏${COLLECT_NOUNS[target.kind]}`
      : `收藏${COLLECT_NOUNS[target.kind]}「${name}」`,
  );

  const toggle = () => {
    void view.app.collect(target, !collected);
  };
</script>

{#if status && status !== 'own'}
  {#if look === 'pill'}
    <ToolButton
      icon={Icon}
      label={collected ? '已收藏' : '收藏'}
      pressed={collected}
      class={klass}
      disabled={status === 'unknown'}
      onclick={toggle}
    />
  {:else}
    <button
      type="button"
      aria-label={label}
      aria-pressed={collected}
      disabled={status === 'unknown'}
      class={[
        'grid flex-none place-items-center rounded-full transition-[background-color,color,opacity,transform] duration-feedback enabled:press disabled:(cursor-not-allowed opacity-50) mouse:enabled:hover:(bg-primary-100 text-primary-950)',
        look === 'icon' ? 'size-11 md:size-10' : 'size-8 bg-white shadow-chip',
        collected ? 'text-primary-900' : 'text-neutral-700',
        klass,
      ]}
      onclick={toggle}
    >
      {#key Icon}
        <span class="grid col-start-1 row-start-1" transition:iconSwap>
          <Icon size={look === 'icon' ? 20 : 18} aria-hidden="true" />
        </span>
      {/key}
    </button>
  {/if}
{/if}
