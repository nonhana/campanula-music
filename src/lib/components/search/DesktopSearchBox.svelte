<script lang="ts">
  import { on } from 'svelte/events';

  import { getAppView } from '../shared/app-context.svelte';
  import { pop } from '../shared/motion';
  import { langOf } from '../shared/text';
  import SearchField from '../ui/SearchField.svelte';
  import type { SuggestionRow } from './search-box.svelte';
  import {
    activeSuggestionId,
    pickSuggestion,
    resetSearchBox,
    searchBox,
    searchBoxKey,
    SUGGESTION_LIST_ID,
    typeInSearchBox,
  } from './search-box.svelte';
  import SearchSuggestions from './SearchSuggestions.svelte';

  const view = getAppView();
  let root = $state<HTMLElement>();
  let input = $state<HTMLInputElement>();
  let open = $state(false);
  const suggesting = $derived(open && searchBox.draft.trim() !== '');
  const dropped = $derived(
    suggesting || (open && view.state.search.history.length > 0),
  );
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘ K'
    : 'Ctrl K';

  const show = () => {
    if (open) return;
    open = true;
    view.app.suggest(searchBox.draft);
  };

  const hide = () => {
    open = false;
    resetSearchBox(view.app);
  };

  const pick = (row: SuggestionRow) => {
    open = false;
    input?.blur();
    pickSuggestion(view.app, row);
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) show();
    if (open && searchBoxKey(event, view.app) && event.key === 'Enter') {
      open = false;
      input?.blur();
    }
  };

  const closeOnLeave = (node: HTMLElement) => {
    const offKey = on(node, 'keydown', (event) => {
      if (event.key !== 'Escape' || !open) return;
      event.preventDefault();
      // 先放回焦点再收起，否则下拉不会再打开
      input?.focus();
      hide();
    });
    const offFocus = on(node, 'focusout', (event) => {
      if (open && !node.contains(event.relatedTarget as Node | null)) hide();
    });
    return () => {
      offKey();
      offFocus();
    };
  };

  const onWindowKey = (event: KeyboardEvent) => {
    if (
      !(event.ctrlKey || event.metaKey) ||
      event.key.toLowerCase() !== 'k' ||
      root?.closest('[inert]')
    )
      return;
    event.preventDefault();
    input?.focus();
    input?.select();
    show();
  };
</script>

<svelte:window onkeydown={onWindowKey} />

<div
  bind:this={root}
  class="relative min-w-0"
  role="search"
  {@attach closeOnLeave}
>
  <SearchField
    bind:input
    bind:value={
      () => searchBox.draft,
      (value) => {
        typeInSearchBox(view.app, value);
        open = true;
      }
    }
    label="搜索"
    hint={open ? undefined : kbd}
    role="combobox"
    aria-expanded={dropped}
    aria-controls={suggesting ? SUGGESTION_LIST_ID : undefined}
    aria-autocomplete="list"
    aria-activedescendant={suggesting
      ? activeSuggestionId(view.app)
      : undefined}
    lang={langOf(searchBox.draft)}
    onfocus={show}
    onclick={show}
    {onkeydown}
  />
  {#if dropped}
    <div
      class="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-[min(560px,70vh)] origin-top overflow-y-auto overscroll-contain rounded-xl bg-white shadow-float"
      role="presentation"
      transition:pop={{ below: true }}
      onpointerdown={(event) => event.preventDefault()}
    >
      <SearchSuggestions onpick={pick} />
    </div>
  {/if}
</div>

{#snippet kbd()}
  <kbd
    class="border border-neutral-200 rounded-sm bg-neutral-50 px-1.5 text-micro text-neutral-600 font-sans"
    >{shortcut}</kbd
  >
{/snippet}
