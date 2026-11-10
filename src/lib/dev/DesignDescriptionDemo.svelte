<!--
  设计页的简介演示：一张假的歌单页头，用真的 DetailHeader（简介预览）和阅读层（浮层栈里的 description）。
  可以换长短简介、一行两行标题；播放、下载、收藏按钮不执行，歌曲列表只画占位。
-->
<script lang="ts">
  import { CircleArrowDown, CircleCheck, Play } from '@lucide/svelte';

  import DetailHeader from '#lib/components/library/DetailHeader.svelte';
  import { desktopLayout } from '#lib/components/shared/layout.js';
  import Button from '#lib/components/ui/Button.svelte';
  import SearchField from '#lib/components/ui/SearchField.svelte';
  import Segmented from '#lib/components/ui/Segmented.svelte';
  import {
    designDescription,
    designPlaylistName,
  } from '#lib/dev/design-data.js';
  import { mock } from '#lib/mock-flag.js';

  const LENGTHS = [
    { key: 'long', label: '长简介' },
    { key: 'short', label: '短简介' },
  ] as const;
  const TITLES = [
    { key: 'short', label: '一行标题' },
    { key: 'long', label: '两行标题' },
  ] as const;
  type Length = (typeof LENGTHS)[number]['key'];
  type TitleLength = (typeof TITLES)[number]['key'];

  let length = $state<Length>('long');
  let titleLength = $state<TitleLength>('short');
  let query = $state('');
  const phone = $derived(!desktopLayout.current);
  const coverUrl = mock ? '/mock-assets/cover/design-description.svg' : null;
</script>

<div class="flex flex-wrap items-center gap-3">
  <Segmented
    options={LENGTHS}
    value={length}
    onchange={(key: Length) => (length = key)}
    role="radio"
    id="design-description-length"
    label="简介长度"
    class="h-10 w-[200px]"
  />
  <Segmented
    options={TITLES}
    value={titleLength}
    onchange={(key: TitleLength) => (titleLength = key)}
    role="radio"
    id="design-description-title"
    label="标题长度"
    class="h-10 w-[200px]"
  />
</div>

<div
  class={phone
    ? 'mt-4 -mx-4'
    : 'mt-4 border border-primary-300 rounded-xl border-dashed p-6'}
>
  <DetailHeader
    cover={{ url: coverUrl }}
    title={designPlaylistName[titleLength]}
    tags={['日语', '摇滚', '另类/独立']}
    description={designDescription[length]}
  >
    {#snippet meta()}
      <span>Campanula</span>
      <span aria-hidden="true">·</span>
      <span class="tabular-nums">144 首</span>
      <span aria-hidden="true">·</span>
      <span class="tabular-nums">播放 2.2 万</span>
    {/snippet}
    {#snippet actions()}
      <Button variant="primary" icon={Play}>播放全部</Button>
      <Button variant="download" icon={CircleArrowDown}>下载</Button>
      {#if !phone}<Button variant="outline" icon={CircleCheck}>已收藏</Button
        >{/if}
    {/snippet}
    {#snippet search(compact: boolean)}
      <SearchField
        label="在歌单里搜索"
        bind:value={query}
        placeholder={compact ? '搜索' : '在歌单里搜索'}
        class="max-w-[280px] min-w-[128px] w-full"
      />
    {/snippet}
  </DetailHeader>
  <div class={phone ? 'px-4 pt-4' : 'mt-6'}>
    <span
      class="grid h-[168px] place-items-center border border-primary-300 rounded-lg border-dashed text-caption text-neutral-600"
    >
      {phone ? '歌单内搜索、N 首、歌曲行' : '歌曲列表：56px 一行'}
    </span>
  </div>
</div>
