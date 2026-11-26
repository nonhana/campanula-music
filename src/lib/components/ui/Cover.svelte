<!-- flight 是这张图代表的页面地址，换页时两头一样的从格子飞到页头 -->
<script lang="ts" module>
  import { imageLoaded, preloadImage } from '../shared/image-reveal.svelte.ts';
  import { displayCoverSource } from '../shared/image-url.ts';

  // 40/44/48px 小封面统一按 48 档取图，歌单、队列与播放条共享同一份图片缓存
  const SMALL_COVER_BUCKET = 48;

  export const coverSource = (url: string, size: number): string =>
    displayCoverSource(
      url,
      size > 0 && size <= SMALL_COVER_BUCKET ? SMALL_COVER_BUCKET : size,
    );

  /** 参数要和之后挂上的 Cover 一样，挂上时才直接显示、不淡入 */
  export const preloadCover = (url: string, size: number): Promise<void> =>
    preloadImage(coverSource(url, size));

  export const coverLoaded = (url: string, size: number): boolean =>
    imageLoaded(coverSource(url, size));
</script>

<script lang="ts">
  import type { LucideIcon } from '@lucide/svelte';
  import { Music } from '@lucide/svelte';
  import type { ClassValue } from 'svelte/elements';

  import { getAppView } from '../shared/app-context.svelte.ts';
  import { createImageReveal } from '../shared/image-reveal.svelte.ts';
  import { DURATIONS } from '../shared/motion-tokens.ts';
  import { fade } from '../shared/motion.ts';
  import { getVirtualList, hasVirtualList } from './virtual-list-context.ts';

  interface Props {
    url: string | null;
    size: number;
    fluid?: boolean;
    class?: ClassValue;
    eager?: boolean;
    fallback?: LucideIcon;
    flight?: string;
    placeholder?: number;
    load?: boolean;
  }

  const {
    url,
    size,
    fluid = false,
    class: klass,
    eager = false,
    fallback: Fallback = Music,
    flight,
    placeholder,
    load = true,
  }: Props = $props();
  const virtual = hasVirtualList() ? getVirtualList() : null;
  const source = $derived(url === null ? '' : coverSource(url, size));
  const view = getAppView();
  const local = $derived(
    url === null ? null : view.state.downloads.coverOf(url),
  );
  const small = $derived(
    local ??
      (url !== null && placeholder !== undefined && placeholder < size
        ? coverSource(url, placeholder)
        : null),
  );
  const reveal = createImageReveal(() => source, {
    instant: virtual !== null,
  });
  const deferred = $derived(
    virtual !== null &&
      virtual.deferImages &&
      !local &&
      reveal.status !== 'cached',
  );
</script>

<span
  class={[
    'grid flex-none place-items-center overflow-hidden bg-primary-100 text-primary-950',
    fluid && 'aspect-square w-full',
    klass,
  ]}
  style:width={fluid ? undefined : `${size}px`}
  style:height={fluid ? undefined : `${size}px`}
  data-flight={flight}
>
  {#if url === null || (reveal.status === 'broken' && !local)}
    <!-- w-2/5：fluid 时 size 只是取图大小，不是显示宽度 -->
    <span class="grid w-2/5" in:fade={{ duration: DURATIONS.reveal }}>
      <Fallback class="h-auto w-full" aria-hidden="true" />
    </span>
  {:else}
    {#if small && (reveal.status !== 'cached' || local)}
      <img
        src={small}
        alt=""
        class="col-start-1 row-start-1 size-full object-cover"
        decoding="async"
        draggable="false"
      />
    {/if}
    {#if load && !deferred}
      {#if virtual}
        <!-- 虚拟列表内复用槽位：不走 {#key} 重建、不跑 opacity 过渡，避免移动端滚动层拆分闪白 -->
        <img
          src={source}
          alt=""
          width={size}
          height={size}
          class={[
            'col-start-1 row-start-1 size-full object-cover',
            (reveal.status === 'loading' || reveal.status === 'broken') &&
              'invisible',
          ]}
          decoding="async"
          draggable="false"
          {@attach reveal.image}
        />
      {:else}
        {#key source}
          <img
            src={source}
            alt=""
            width={size}
            height={size}
            class={[
              'col-start-1 row-start-1 size-full object-cover',
              (reveal.status === 'loading' || reveal.status === 'broken') &&
                'opacity-0',
              reveal.status === 'loaded' &&
                'transition-opacity duration-reveal',
            ]}
            loading={eager ? 'eager' : 'lazy'}
            fetchpriority={eager ? 'high' : undefined}
            decoding="async"
            draggable="false"
            {@attach reveal.image}
          />
        {/key}
      {/if}
    {/if}
  {/if}
</span>
