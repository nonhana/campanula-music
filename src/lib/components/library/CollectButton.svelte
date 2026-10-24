<!--
  收藏开关：收藏、取消收藏一张歌单、一张专辑、一位歌手（App 的 collect：先改本地、立即生效，没成会自己改回并在提示条里说明）。
  三种样子，图标照 DESIGN.md 的图标词典：收藏是 CirclePlus，已收藏是 CircleCheck（深薄荷），三种样子都一样；
  - pill：页面头部播放全部旁边（DESIGN.md Buttons）。桌面是描边胶囊“收藏 / 已收藏”；手机只留图标（工具档，ToolButton）；
  - icon：搜索结果歌单行最右边的图标按钮（和 IconButton 一样：手机 44px、桌面 40px 的圆）；
  - corner：搜索结果里歌手、专辑格子封面右下角始终可见的 32px 白色小圆（调用方负责绝对定位，和格子的链接并排、不嵌在里面），18px 图标。
  自建歌单、我喜欢的音乐、没登录时不显示；对应的列表首次同步还没拿到（不知道收没收藏）时不能按。
  是开关（aria-pressed）：胶囊的名字是“收藏 / 已收藏”（手机只留图标时也是），两种图标按钮的名字一直是“收藏专辑「…」”，按下了就是已收藏
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import type { CollectTarget } from '#lib/app/app.js'
  import { CircleCheck, CirclePlus } from '@lucide/svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { iconSwap } from '../shared/motion'
  import ToolButton from '../ui/ToolButton.svelte'
  import { COLLECT_NOUNS, collectState } from './collect'

  interface Props {
    target: CollectTarget
    /** 歌单名、专辑名、歌手名：图标按钮读屏读出的名字里要用 */
    name: string
    look: 'pill' | 'icon' | 'corner'
    class?: ClassValue
  }

  const { target, name, look, class: klass }: Props = $props()
  const view = getAppView()
  const library = $derived(view.state.library)
  const status = $derived(library ? collectState(library, target) : null)
  const collected = $derived(status === 'collected')
  const Icon = $derived(collected ? CircleCheck : CirclePlus)
  const label = $derived(`收藏${COLLECT_NOUNS[target.kind]}「${name}」`)

  function toggle() {
    void view.app.collect(target, !collected)
  }
</script>

{#if status && status !== 'own'}
  {#if look === 'pill'}
    <ToolButton
      icon={Icon}
      label={collected ? '已收藏' : '收藏'}
      pressed={collected}
      class={klass}
      disabled={status === 'unknown'}
      onclick={toggle}
    />
  {:else}
    <button
      type='button'
      aria-label={label}
      aria-pressed={collected}
      disabled={status === 'unknown'}
      class={[
        'grid flex-none place-items-center rounded-full transition-[background-color,color,opacity,transform] duration-feedback enabled:press disabled:(cursor-not-allowed opacity-50) mouse:enabled:hover:(bg-primary-100 text-primary-950)',
        look === 'icon' ? 'size-11 md:size-10' : 'size-8 bg-white shadow-chip',
        collected ? 'text-primary-900' : 'text-neutral-700',
        klass,
      ]}
      onclick={toggle}
    >
      <!-- 收藏、取消收藏时新旧图标叠在同一格里交叉淡化 -->
      {#key Icon}
        <span class='grid col-start-1 row-start-1' transition:iconSwap>
          <Icon size={look === 'icon' ? 20 : 18} aria-hidden='true' />
        </span>
      {/key}
    </button>
  {/if}
{/if}
