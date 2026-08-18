<script lang='ts'>
  import type { NcmSong } from '$lib/types'
  import { likedIds, likedPending, loadLikedSongs, toggleLike } from '$lib/stores'
  import { Heart } from 'lucide-svelte'

  interface Props {
    song: NcmSong
    size?: string
    class?: string
  }

  const { song, size = 'size-5', class: customClasses = '' }: Props = $props()

  const liked = $derived($likedIds.has(song.id))
  const pending = $derived($likedPending.has(song.id))

  // 红心按钮首次出现时确保喜欢列表已加载（store 内单飞，已加载则跳过）
  $effect(() => {
    void loadLikedSongs()
  })
</script>

<button
  type='button'
  disabled={pending}
  aria-label={liked ? '取消红心' : '红心'}
  aria-pressed={liked}
  title={liked ? '取消红心' : '红心'}
  class='shrink-0 cursor-pointer rounded-full p-1.5 text-neutral transition-colors disabled:cursor-wait hover:bg-primary-100 hover:text-rose-500 disabled:opacity-60 {customClasses}'
  onclick={() => toggleLike(song)}
>
  <Heart class={`${size}${liked ? ' fill-current text-rose-500' : ''}`} />
</button>
