<script lang="ts">
  import { page } from '$app/state';

  import { getOverlays } from '../overlay/overlay-context';
  import { getAppView } from '../shared/app-context.svelte';
  import type { CreditKind, CreditTarget } from './credit-link';
  import { creditLink } from './credit-link';

  interface Props {
    kind: CreditKind;
    target: CreditTarget;
    linked: boolean;
    tabbable?: boolean;
    padded?: boolean;
  }

  const {
    kind,
    target,
    linked,
    tabbable = false,
    padded = false,
  }: Props = $props();
  const view = getAppView();
  const { stack } = getOverlays();
  const link = $derived(
    linked && view.state.library
      ? creditLink(kind, target, page.url.pathname)
      : null,
  );

  const follow = (event: MouseEvent) => {
    if (
      !link ||
      !stack.holdsHistory ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    void stack.leave(link.href);
  };
</script>

{#if link}
  <!-- eslint-disable svelte/no-navigation-without-resolve -- 地址由 credit-link.ts 用 resolve() 拼好 -->
  <a
    href={link.href}
    class={[
      'relative z-1 rounded-sm underline-offset-3 mouse:hover:(text-neutral-900 underline)',
      padded && 'py-1.5',
    ]}
    tabindex={tabbable ? undefined : -1}
    onclick={follow}>{link.name}</a
  >
  <!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}{target.name}{/if}
