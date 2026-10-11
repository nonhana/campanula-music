<!--
  未登录页的示例曲库：用歌曲行、封面和正在播放的那一行（晨光行）拼出登录后的样子。
  整块不可操作（inert），读屏只读到下面的说明。封面不用真实专辑图（别人的作品不随开源仓库分发），
  用取自原型封面主色的渐变色块代替。
-->
<script lang='ts' module>
  interface SampleSong {
    title: string
    artists: string
    album: string
    duration: string
    /** 含假名的标 ja，其余跟随页面的 zh-CN（The Mixed Script Rule） */
    lang?: 'ja'
    /** 封面的两种主色 */
    cover: [string, string]
    downloaded?: true
    trial?: true
  }

  const songs: SampleSong[] = [
    { title: '夜明けのベルフラワー', artists: '風見ユウ / 初音ミク', album: 'ベルフラワー', duration: '4:12', lang: 'ja', cover: ['#6CBDAE', '#70A7A7'], downloaded: true },
    { title: 'Dye the sky.', artists: 'シャイニーカラーズ', album: 'THE IDOLM@STER SHINY COLORS GR@DATE WING 01', duration: '4:26', lang: 'ja', cover: ['#AB9BD8', '#D0C0D0'] },
    { title: '二人の絆 (U.N.オーエンは彼女なのか?)', artists: 'LOST BLESS', album: '東方紅魔郷 Arrange', duration: '4:47', lang: 'ja', cover: ['#BD616A', '#87565B'], downloaded: true },
    { title: '风居住的街道（Piano ver）(翻自 磯村由紀子)', artists: '饭碗的彼岸', album: '风居住的街道', duration: '5:44', cover: ['#93624D', '#8E7B71'], trial: true },
    { title: 'とびだせ！わんだぴょい (feat. 天馬司&鳳えむ&草薙寧々&神代類&鏡音リン)', artists: 'ワンダーランズ×ショウタイム', album: '征け / とびだせ！わんだぴょい', duration: '3:24', lang: 'ja', cover: ['#772734', '#806970'], downloaded: true },
  ]

  const playlists: { name: string, cover: [string, string] }[] = [
    { name: 'rhythm', cover: ['#DA7666', '#CCA095'] },
    { name: '术力口', cover: ['#386A86', '#7C98A8'] },
    { name: '可爱滴捏', cover: ['#EDBDB8', '#DCC5C4'] },
    { name: 'memories are still echoing.', cover: ['#CB6A40', '#B36149'] },
    { name: 'listen the darkness.', cover: ['#4A8A97', '#324F56'] },
    { name: '一起看海', cover: ['#4CC4FB', '#C7D4E3'] },
  ]

  /** 正在播放的那首放到了哪儿：晨光行铺开的长度 */
  const PROGRESS = 0.38

  const coverStyle = ([vivid, average]: [string, string]) => `background: linear-gradient(135deg, ${vivid}, ${average})`
</script>

<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import { CircleArrowDown, Ellipsis, Play } from '@lucide/svelte'

  interface Props {
    phone: boolean
    class?: ClassValue
  }

  const { phone, class: klass }: Props = $props()

  const rows = $derived(songs.slice(0, phone ? 4 : 5))
  const shelf = $derived(playlists.slice(0, phone ? 3 : 6))
</script>

{#snippet trialBadge()}
  <span class='flex-none rounded-sm bg-warning-50 px-1.5 text-micro text-warning-900 font-500'>试听</span>
{/snippet}

{#snippet morningLight(start: number)}
  <!-- 晨光行：从歌名左边缘起，长度等于播放进度；起点 16px 渐入，前沿 40px 渐隐 -->
  <span
    class='morning-light pointer-events-none absolute inset-y-0 right-0 rounded-[inherit]'
    style:left='{start}px'
    style:--progress={PROGRESS}
    aria-hidden='true'
  ></span>
{/snippet}

{#snippet nowBars()}
  <span class='h-3.5 w-3.5 inline-flex items-end gap-0.5' aria-hidden='true'>
    <span class='h-[55%] flex-1 rounded-[1px] bg-primary-900'></span>
    <span class='h-[95%] flex-1 rounded-[1px] bg-primary-900'></span>
    <span class='h-[40%] flex-1 rounded-[1px] bg-primary-900'></span>
  </span>
{/snippet}

<figure class={['m-0', klass]}>
  <div class={['rounded-xl bg-white shadow-ambient', phone ? 'py-3' : 'p-3']} inert>
    <div class={['flex items-center gap-3', phone ? 'h-11 px-4' : 'h-12 pl-3 pr-1']}>
      <span class='text-title-sm text-neutral-900 font-600'>我喜欢的音乐</span>
      <span class='text-caption text-neutral-500 tabular-nums'>4,815 首</span>
      {#if !phone}
        <span class='ml-auto h-10 inline-flex items-center gap-2 rounded-full bg-primary-900 pl-4 pr-5 text-label text-white font-500'>
          <Play size={16} fill='currentColor' aria-hidden='true' />播放全部
        </span>
      {/if}
    </div>

    {#each rows as song, i (song.title)}
      {@const now = i === 0}
      {#if phone}
        <div class='relative h-14'>
          {#if now}{@render morningLight(70)}{/if}
          <div class='relative grid grid-cols-[48px_minmax(0,1fr)_44px] h-full items-center gap-3.5 pl-4 pr-1'>
            <span class='relative size-12 rounded-md' style={coverStyle(song.cover)}>
              {#if now}
                <span class='absolute inset-0 grid place-items-center'>
                  <span class='grid size-7 place-items-center rounded-full bg-white/92 shadow-[0_1px_3px_rgb(17_24_39/0.18)]'>{@render nowBars()}</span>
                </span>
              {/if}
            </span>
            <span class='min-w-0'>
              <span class='min-w-0 flex items-center gap-1.5'>
                <span class={['truncate text-body font-500 leading-5', now ? 'text-primary-950' : 'text-neutral-900']} lang={song.lang}>{song.title}</span>
                {#if song.trial}{@render trialBadge()}{/if}
              </span>
              <span class='mt-0.5 min-w-0 flex items-center gap-1.5 text-caption text-neutral-600 leading-[18px]'>
                {#if song.downloaded}<CircleArrowDown size={14} class='flex-none text-secondary-800' aria-hidden='true' />{/if}
                <span class='truncate' lang={song.lang}>{song.artists}</span>
              </span>
            </span>
            <span class='grid size-11 place-items-center text-neutral-600'><Ellipsis size={20} aria-hidden='true' /></span>
          </div>
        </div>
      {:else}
        <div class='relative h-14 rounded-lg'>
          {#if now}{@render morningLight(104)}{/if}
          <div class='relative grid grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_24px_48px_40px] h-full items-center gap-4 pl-2 pr-1'>
            <span class='grid place-items-center text-caption text-neutral-500 tabular-nums'>
              {#if now}{@render nowBars()}{:else}{i + 1}{/if}
            </span>
            <span class='min-w-0 flex items-center gap-3'>
              <span class='size-10 flex-none rounded-md' style={coverStyle(song.cover)}></span>
              <span class='min-w-0 flex-1'>
                <span class='min-w-0 flex items-center gap-2'>
                  <span class={['truncate text-label font-500', now ? 'text-primary-950' : 'text-neutral-900']} lang={song.lang}>{song.title}</span>
                  {#if song.trial}{@render trialBadge()}{/if}
                </span>
                <span class='block truncate text-caption text-neutral-600' lang={song.lang}>{song.artists}</span>
              </span>
            </span>
            <span class='truncate text-caption text-neutral-600' lang={song.lang}>{song.album}</span>
            <span class='grid place-items-center'>
              {#if song.downloaded}<CircleArrowDown size={16} class='text-secondary-800' aria-hidden='true' />{/if}
            </span>
            <span class='text-right text-caption text-neutral-500 tabular-nums'>{song.duration}</span>
            <span class='grid size-9 place-items-center text-neutral-600'><Ellipsis size={18} aria-hidden='true' /></span>
          </div>
        </div>
      {/if}
    {/each}

    <div class={['mt-2 border-t border-neutral-100', phone ? 'mx-4 pt-3' : 'mx-3 pt-4']}>
      <span class={['text-neutral-900 font-600', phone ? 'text-body' : 'text-title-sm']}>歌单</span>
      <div class={['mt-3 grid gap-3', phone ? 'grid-cols-3' : 'grid-cols-6']}>
        {#each shelf as playlist (playlist.name)}
          <div class='min-w-0'>
            <span class='block aspect-square w-full rounded-lg' style={coverStyle(playlist.cover)}></span>
            <span class='mt-1.5 block truncate text-caption text-neutral-900 font-500'>{playlist.name}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
  <figcaption class='mt-3 px-1 text-caption text-neutral-600'>
    示例曲库。登录后看到的是你自己的：我喜欢的音乐、歌单、专辑、歌手，正在播放的那一行会随进度慢慢亮起来。
  </figcaption>
</figure>

<style>
  /* 白色面板上的晨光用薄荷雾（primary-100） */
  .morning-light {
    background: linear-gradient(90deg, #e8f8f1 calc(var(--progress) * 100% - 40px), transparent calc(var(--progress) * 100%));
    mask-image: linear-gradient(90deg, transparent 0, #000 16px);
  }
</style>
