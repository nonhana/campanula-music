<script lang='ts'>
  import { getAppView } from '$lib/components/app-context.svelte'
  import StateBlock from '$lib/components/ui/StateBlock.svelte'
  import { Library } from '@lucide/svelte'

  // 根布局只在登录后渲染页面。曲库（#21）还没做，先如实说明
  const view = getAppView()
  const nickname = $derived(view.state.session.status === 'signedIn' ? view.state.session.account.nickname : '')
</script>

<StateBlock kind='empty' icon={Library} title='已登录为 {nickname}' body='曲库同步会在之后的版本加入。' />
