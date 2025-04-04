<script lang='ts'>
  import type { PlaylistItem } from '$lib/types'
  import Card from '$lib/components/hana/Card.svelte'
  import LazyImage from '$lib/components/hana/LazyImage.svelte'
  import { PlayCircle } from 'lucide-svelte'

  interface Props {
    activated?: boolean
    playlist: PlaylistItem
    imgClass?: string
    onclick?: () => void
  }

  const { activated = false, playlist, imgClass = '', onclick }: Props = $props()
</script>

<Card
  elevated={false}
  divider={false}
  transparent
  href={`/playlists/${playlist.id}`}
  {onclick}
>
  {#snippet mask()}
    <div
      class={[
        'z-1 absolute inset-0 size-full cursor-pointer hover:bg-gradient-to-b from-transparent to-primary/30 group/item',
        activated && 'bg-gradient-to-b from-transparent to-primary/30',
      ]}
    >
      <PlayCircle class='absolute bottom-2 right-2 text-neutral hidden group-hover/item:block' />
    </div>
  {/snippet}
  {#snippet header()}
    <LazyImage
      src={playlist.cover ?? ''}
      alt={playlist.name}
      class={imgClass}
    />
  {/snippet}
  <div class='w-40 flex flex-col items-start gap-2 p-2'>
    <span class='line-clamp-1 font-bold'>{playlist.name}</span>
    <span class='text-sm text-neutral'>{playlist.musicCount} 首</span>
  </div>
</Card>
