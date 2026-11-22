<script lang="ts">
  import { Check, Copy } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
  import type { ClassValue } from 'svelte/elements';

  import { colors } from '../../../uno.palette.mts';
  import { iconSwap } from '../components/shared/motion.ts';

  interface Props {
    class?: ClassValue;
    detailed?: boolean;
  }

  const { class: klass, detailed = false }: Props = $props();

  const COPIED_RESET_DELAY = 1600;

  // 色板只在 uno.palette.mts 写一份，这里按工具类名读十六进制值（纸白 paper 是 white）
  const palette = colors as Record<string, string | Record<string, string>>;
  const colorHex = (utility: string): string => {
    const direct = palette[utility];
    if (typeof direct === 'string') return direct;
    const at = utility.lastIndexOf('-');
    const scale = palette[utility.slice(0, at)];
    return typeof scale === 'string' ? scale : scale[utility.slice(at + 1)];
  };

  const colorGroups = [
    {
      title: '薄荷：选中、进度、正在播放、焦点',
      colors: [
        {
          name: '晨光底',
          token: 'morning-ground',
          swatch: 'bg-primary-50',
          utility: 'primary-50',
        },
        {
          name: '薄荷雾',
          token: 'mint-mist',
          swatch: 'bg-primary-100',
          utility: 'primary-100',
        },
        {
          name: '薄荷玻璃',
          token: 'mint-glass',
          swatch: 'bg-primary-200',
          utility: 'primary-200',
        },
        {
          name: '薄荷线',
          token: 'mint-line',
          swatch: 'bg-primary-300',
          utility: 'primary-300',
        },
        {
          name: '薄荷',
          token: 'mint',
          swatch: 'bg-primary-400',
          utility: 'primary-400',
        },
        {
          name: '新芽绿',
          token: 'mint-sprout',
          swatch: 'bg-primary-600',
          utility: 'primary-600',
        },
        {
          name: '叶绿',
          token: 'mint-leaf',
          swatch: 'bg-primary-700',
          utility: 'primary-700',
        },
        {
          name: '茎绿',
          token: 'mint-stem',
          swatch: 'bg-primary-800',
          utility: 'primary-800',
        },
        {
          name: '深薄荷',
          token: 'deep-mint',
          swatch: 'bg-primary-900',
          utility: 'primary-900',
        },
        {
          name: '森林墨',
          token: 'forest-ink',
          swatch: 'bg-primary-950',
          utility: 'primary-950',
        },
      ],
    },
    {
      title: '蜜桃：这台设备、下载；珊瑚：红心',
      colors: [
        {
          name: '蜜桃雾',
          token: 'peach-mist',
          swatch: 'bg-secondary-50',
          utility: 'secondary-50',
        },
        {
          name: '蜜桃浅',
          token: 'peach-wash',
          swatch: 'bg-secondary-100',
          utility: 'secondary-100',
        },
        {
          name: '蜜桃光',
          token: 'peach-glow',
          swatch: 'bg-secondary-200',
          utility: 'secondary-200',
        },
        {
          name: '蜜桃枝',
          token: 'peach-ember',
          swatch: 'bg-secondary-800',
          utility: 'secondary-800',
        },
        {
          name: '蜜桃木',
          token: 'peach-bark',
          swatch: 'bg-secondary-900',
          utility: 'secondary-900',
        },
        {
          name: '珊瑚心',
          token: 'coral-heart',
          swatch: 'bg-accent-600',
          utility: 'accent-600',
        },
      ],
    },
    {
      title: '中性色和状态',
      colors: [
        {
          name: '纸白',
          token: 'paper',
          swatch: 'bg-white',
          utility: 'white',
        },
        {
          name: '墨',
          token: 'ink',
          swatch: 'bg-neutral-900',
          utility: 'neutral-900',
        },
        {
          name: '石墨深',
          token: 'graphite-deep',
          swatch: 'bg-neutral-800',
          utility: 'neutral-800',
        },
        {
          name: '石墨重',
          token: 'graphite-strong',
          swatch: 'bg-neutral-700',
          utility: 'neutral-700',
        },
        {
          name: '石墨',
          token: 'graphite',
          swatch: 'bg-neutral-600',
          utility: 'neutral-600',
        },
        {
          name: '石墨淡',
          token: 'graphite-soft',
          swatch: 'bg-neutral-500',
          utility: 'neutral-500',
        },
        {
          name: '发丝线',
          token: 'hairline',
          swatch: 'bg-neutral-200',
          utility: 'neutral-200',
        },
        {
          name: '淡发丝',
          token: 'hairline-faint',
          swatch: 'bg-neutral-100',
          utility: 'neutral-100',
        },
        {
          name: '试听底',
          token: 'trial-wash',
          swatch: 'bg-warning-50',
          utility: 'warning-50',
        },
        {
          name: '试听字',
          token: 'trial-ink',
          swatch: 'bg-warning-900',
          utility: 'warning-900',
        },
        {
          name: '出错底',
          token: 'error-wash',
          swatch: 'bg-error-50',
          utility: 'error-50',
        },
        {
          name: '出错红',
          token: 'error-ink',
          swatch: 'bg-error-700',
          utility: 'error-700',
        },
      ],
    },
  ];

  let copiedToken = $state<string | null>(null);
  let announcement = $state('');
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const copyHex = async (token: string, name: string, hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
    } catch {
      return;
    }
    copiedToken = token;
    announcement = `已复制 ${name} 色值 ${hex}`;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copiedToken = null;
      announcement = '';
    }, COPIED_RESET_DELAY);
  };

  onDestroy(() => {
    clearTimeout(resetTimer);
  });
</script>

<div class={klass} data-color-palette>
  <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
  {#each colorGroups as group, index (group.title)}
    <h3
      class={['m-0 text-label text-neutral-700 font-500', index > 0 && 'mt-5']}
    >
      {group.title}
    </h3>
    <ul
      class="grid grid-cols-[repeat(auto-fill,minmax(min(132px,100%),1fr))] m-0 mt-2 list-none gap-3 p-0"
    >
      {#each group.colors as color (color.token)}
        {@const hex = colorHex(color.utility)}
        {@const copied = copiedToken === color.token}
        <li class="m-0 p-0">
          <button
            type="button"
            data-swatch={color.token}
            class={[
              'group swatch-button press h-full w-full flex cursor-pointer flex-col overflow-hidden rounded-lg bg-white text-left shadow-ambient ring-1 transition-[box-shadow,transform] duration-feedback ease-out-soft',
              copied
                ? 'ring-primary-300'
                : 'ring-transparent mouse:hover:ring-primary-300',
            ]}
            onclick={() => void copyHex(color.token, color.name, hex)}
          >
            <span
              class={[
                'swatch-chip block h-16 w-full flex-none border-b border-neutral-100',
                color.swatch,
              ]}
              aria-hidden="true"
            ></span>
            <span class="block w-full flex-1 px-2.5 py-2">
              <span class="block text-caption text-neutral-900 font-500">
                {color.name}
              </span>
              {#if detailed}
                <span class="block text-micro text-neutral-600">
                  {color.token} · {color.utility}
                </span>
              {/if}
              <span class="flex items-center justify-between gap-1.5">
                <span class="grid min-w-0 text-micro tabular-nums">
                  <span
                    class={[
                      'col-start-1 row-start-1 text-neutral-500 transition-opacity duration-feedback',
                      copied ? 'invisible opacity-0' : 'opacity-100',
                    ]}
                  >
                    {hex}
                  </span>
                  <span
                    class={[
                      'col-start-1 row-start-1 text-primary-900 font-500 transition-opacity duration-feedback',
                      copied ? 'opacity-100' : 'invisible opacity-0',
                    ]}
                    aria-hidden={!copied}
                  >
                    已复制 {hex}
                  </span>
                </span>
                <span
                  class={[
                    'swatch-copy-icon grid flex-none place-items-center transition-colors duration-feedback',
                    copied
                      ? 'text-primary-900'
                      : 'text-neutral-400 mouse:group-hover:text-primary-900',
                  ]}
                  aria-hidden="true"
                >
                  {#if copied}
                    <span
                      class="grid col-start-1 row-start-1"
                      transition:iconSwap
                    >
                      <Check size={12} />
                    </span>
                  {:else}
                    <span
                      class="grid col-start-1 row-start-1"
                      transition:iconSwap
                    >
                      <Copy size={12} />
                    </span>
                  {/if}
                </span>
              </span>
            </span>
            <span class="sr-only">，点击复制色值 {hex}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/each}
</div>

<style>
  @media (forced-colors: active) {
    .swatch-chip {
      forced-color-adjust: none;
    }
  }
  @media (scripting: none), print {
    .swatch-button {
      cursor: default;
    }
    .swatch-copy-icon {
      display: none;
    }
  }
</style>
