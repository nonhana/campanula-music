import { defineParams } from '@sveltejs/kit/params'
import { SEARCH_KINDS } from '#lib/api/search.js'

// 路由参数的匹配（SvelteKit 的 [name=matcher]）
export const params = defineParams({
  /** 搜索结果的四类：/api/search/[kind=searchKind] */
  searchKind: (param: string) => SEARCH_KINDS.find(kind => kind === param),
})
