<!-- 播放页上的上一首、下一首：薄荷雾底的胶囊（桌面 64×48，手机 64×56），森林墨实心图标；鼠标悬停加深一档 -->
<script lang='ts'>
  import { SkipBack, SkipForward } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'

  const { direction, phone = false }: { direction: 'previous' | 'next', phone?: boolean } = $props()
  const view = getAppView()
  const Icon = $derived(direction === 'previous' ? SkipBack : SkipForward)
</script>

<button
  type='button'
  class={['grid w-16 flex-none place-items-center rounded-full bg-primary-100 text-primary-950 transition-[background-color,transform] duration-150 ease-out active:scale-98 mouse:hover:bg-primary-200', phone ? 'h-14' : 'h-12']}
  aria-label={direction === 'previous' ? '上一首' : '下一首'}
  onclick={() => (direction === 'previous' ? view.app.previous() : view.app.next())}
>
  <Icon size={phone ? 22 : 20} fill='currentColor' aria-hidden='true' />
</button>
