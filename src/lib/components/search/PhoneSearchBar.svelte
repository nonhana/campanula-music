<script lang="ts">
  import { ArrowLeft } from '@lucide/svelte';

  import { getAppView } from '../shared/app-context.svelte';
  import { langOf } from '../shared/text';
  import IconButton from '../ui/IconButton.svelte';
  import SearchField from '../ui/SearchField.svelte';
  import {
    activeSuggestionId,
    searchBox,
    searchBoxKey,
    shownKeyword,
    SUGGESTION_LIST_ID,
    typeInSearchBox,
  } from './search-box.svelte';

  const { onback }: { onback: () => void } = $props();
  const view = getAppView();
  let input = $state<HTMLInputElement>();
  const keyword = $derived(shownKeyword());
  const suggesting = $derived(
    searchBox.draft.trim() !== '' && searchBox.draft.trim() !== keyword,
  );

  $effect(() => {
    if (!keyword) input?.focus();
  });

  const onkeydown = (event: KeyboardEvent) => {
    if (searchBoxKey(event, view.app) && event.key === 'Enter') input?.blur();
  };
</script>

<IconButton icon={ArrowLeft} label="返回" class="-ml-3" onclick={onback} />
<form
  class="min-w-0 flex-1"
  role="search"
  onsubmit={(event) => event.preventDefault()}
>
  <SearchField
    bind:input
    bind:value={
      () => searchBox.draft, (value) => typeInSearchBox(view.app, value)
    }
    label="搜索"
    enterkeyhint="search"
    role="combobox"
    aria-expanded={suggesting}
    aria-controls={suggesting ? SUGGESTION_LIST_ID : undefined}
    aria-autocomplete="list"
    aria-activedescendant={suggesting
      ? activeSuggestionId(view.app)
      : undefined}
    lang={langOf(searchBox.draft)}
    {onkeydown}
  />
</form>
