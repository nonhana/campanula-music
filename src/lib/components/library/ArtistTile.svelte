<!--
  一位歌手的格子：圆形头像、名字居中。点开是歌手页。曲库的歌手标签、桌面首页的歌手架子都用它
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { UserRound } from '@lucide/svelte'
  import Cover from './Cover.svelte'
  import { langOf } from './view'

  interface Props {
    id: number
    name: string
    avatarUrl: string
  }

  const { id, name, avatarUrl }: Props = $props()
</script>

<a href={resolve('/artists/[id]', { id: String(id) })} class='group block min-w-0 rounded-lg text-center'>
  <Cover url={avatarUrl} size={120} fluid fallback={UserRound} class='rounded-full shadow-ambient transition-[filter] duration-150 mouse:group-hover:brightness-95' />
  <span class='mt-2.5 block truncate text-label text-neutral-900 font-500' lang={langOf(name)}>{name}</span>
</a>
