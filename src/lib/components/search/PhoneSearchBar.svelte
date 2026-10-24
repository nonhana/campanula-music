<!--
  手机搜索页的顶行（视觉原型 PhoneSearch）：返回，加上占满剩下宽度的搜索框（有字时右边是清除）。
  从 logo 行的搜索按钮进来时（还没搜）搜索框直接获得焦点、弹出键盘；结果页上框里是这次搜的词。
  下面的搜索历史、建议、结果在页面里（routes/search），跟着框里的字换。键盘的搜索键、回车就搜（搜完收起键盘）
-->
<script lang='ts'>
  import { ArrowLeft } from '@lucide/svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { langOf } from '../shared/text'
  import IconButton from '../ui/IconButton.svelte'
  import SearchField from '../ui/SearchField.svelte'
  import { activeSuggestionId, searchBox, searchBoxKey, shownKeyword, SUGGESTION_LIST_ID, typeInSearchBox } from './search-box.svelte'

  const { onback }: { onback: () => void } = $props()
  const view = getAppView()
  let input = $state<HTMLInputElement>()
  const keyword = $derived(shownKeyword())
  /** 页面里正在显示建议列表：框里有字，又不是这一页搜的词 */
  const suggesting = $derived(searchBox.draft.trim() !== '' && searchBox.draft.trim() !== keyword)

  // 还没搜：直接打字
  $effect(() => {
    if (!keyword)
      input?.focus()
  })

  function onkeydown(event: KeyboardEvent) {
    if (searchBoxKey(event, view.app) && event.key === 'Enter')
      input?.blur()
  }
</script>

<IconButton icon={ArrowLeft} label='返回' class='-ml-3' onclick={onback} />
<form class='min-w-0 flex-1' role='search' onsubmit={event => event.preventDefault()}>
  <SearchField
    bind:input
    bind:value={() => searchBox.draft, value => typeInSearchBox(view.app, value)}
    label='搜索'
    enterkeyhint='search'
    role='combobox'
    aria-expanded={suggesting}
    aria-controls={suggesting ? SUGGESTION_LIST_ID : undefined}
    aria-autocomplete='list'
    aria-activedescendant={suggesting
      ? activeSuggestionId(view.app)
      : undefined}
    lang={langOf(searchBox.draft)}
    {onkeydown}
  />
</form>
