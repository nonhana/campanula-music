<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import { goto } from '$app/navigation'
  import Button from '$lib/components/hana/Button.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { useMessage } from '$lib/hooks/useMessage'
  import { generateSeoMetadata } from '$lib/metadata'
  import { setNowPlaying, setPlaylist, setSongLoading, songLoading, storedPlaylists } from '$lib/stores'
  import { Disc3, Loader, PlayCircle } from 'lucide-svelte'

  const metadata = generateSeoMetadata('playlists')

  const { callHanaMessage } = useMessage()

  const fetchPlaylistSongs = async (id: number): Promise<SongItem[]> => {
    const res = await fetch(`/api/playlists/${id}/songs`)
    const data = await res.json()
    return data
  }

  const handleRandomPlay = async () => {
    setSongLoading(true)
    const targetPlaylist = $storedPlaylists[Math.floor(Math.random() * $storedPlaylists.length)]
    await goto(`/playlists/${targetPlaylist.id}`)
    const songs = await fetchPlaylistSongs(targetPlaylist.id)
    setPlaylist(songs)
    callHanaMessage({
      message: `成功添加 ${targetPlaylist.name} 的 ${songs.length} 首歌曲`,
      type: 'success',
    })
    await setNowPlaying(songs[0])
  }

</script>

<SeoHead {metadata} />

<div class='mx-auto flex flex-col items-center justify-center'>
  <div class='mb-6 flex flex-col items-center'>
    <div class='relative'>
      <Disc3 class='h-20 w-20 animate-[spin_10s_linear_infinite] text-gray-300' />
    </div>
  </div>

  <h2 class='mb-3 text-xl text-gray-700 font-medium'>请选择一个歌单</h2>
  <p class='mb-6 max-w-md text-center text-sm text-gray-500'>
    从<span class='inline-block md:hidden'
    >右</span><span class='hidden md:inline-block'
    >左</span>侧选择一个歌单，或随机进行播放
  </p>

  <Button disabled={$songLoading} variant='accent' onclick={handleRandomPlay}>
    <span class='flex items-center gap-2'>
      {#if $songLoading}
        <Loader size={16} class='animate-spin' />
      {:else}
        <PlayCircle size={16} />
      {/if}
      随机播放
    </span>
  </Button>
</div>
