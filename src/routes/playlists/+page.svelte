<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { Disc3, PlayCircle } from 'lucide-svelte'

  const metadata = generateSeoMetadata('playlists')
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
    从左侧选择一个歌单，或随机进行播放
  </p>

  <Button variant='accent' onclick={() => {}}>
    <span class='flex items-center gap-2'>
      <PlayCircle size={16} />
      随机播放
    </span>
  </Button>
</div>
