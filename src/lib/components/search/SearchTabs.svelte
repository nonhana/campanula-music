<!--
  搜索结果页的标签（视觉原型 SearchPanel）：综合 / 单曲 / 歌单 / 歌手 / 专辑，四类旁边写网易云给的总数（还没拉到时不写，到了淡入）。选中的写进地址的 type：返回、刷新还停在这个标签；换标签不留浏览记录（返回直接离开搜索，和曲库标签一样）。
  样子、键盘和短线的滑动是 ui/Tabs（和歌手页共用），这里只给搜索特有的：每个标签的地址和四类的总数。
  桌面吸在顶栏下面；手机放在骨架的标签行里，吸在搜索框下面，放不下时能左右滑。
-->
<script lang='ts'>
  import { resolve } from '$app/paths'

  import { getAppView } from '../shared/app-context.svelte'
  import Tabs from '../ui/Tabs.svelte'
  import { selectSearchTab } from './search-box.svelte'
  import type { SearchTab } from './view'
  import { SEARCH_PANEL_ID, SEARCH_TABS, searchPath, searchTabId } from './view'

  interface Props {
    keyword: string
    tab: SearchTab
    phone?: boolean
  }

  const { keyword, tab, phone = false }: Props = $props()
  const view = getAppView()
  const results = $derived(view.state.search.results?.keyword === keyword
    ? view.state.search.results
    : null)

  /** 标签旁边写的总数：综合不写，还没拉到不写 */
  const totalOf = (key: SearchTab): number | null => {
    if (key === 'all' || !results)
      return null
    const list = results[key]
    return list.status === 'shown'
      ? list.total
      : null
  }

  const tabs = $derived(SEARCH_TABS.map(item => ({
    key: item.key,
    label: item.label,
    href: resolve(searchPath(keyword, item.key)),
    count: totalOf(item.key),
  })))
</script>

<Tabs
  {tabs}
  selected={tab}
  onselect={key => selectSearchTab(keyword, key)}
  idOf={searchTabId}
  panel={SEARCH_PANEL_ID}
  label='搜索结果分类'
  class={phone ? 'px-2' : '-mx-3'}
/>
