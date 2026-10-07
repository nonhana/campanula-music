<!--
  PROTOTYPE：交互原型 2.2——封面裁剪和上传。
  ?variant=A|B|C 切换三种流程（A 单独的裁剪页、B 自动居中可再调整、C 弹层里原地裁剪）；
  在歌单页里点封面（或“更多 → 更换封面”）开始。原型面板里有测试文件（横图、竖图、超大、超过 20 MB、HEIC、不是图片）和上传失败的开关。
  默认打开 7 首的自建歌单「一起看海」，列表短，方便看封面；?pl= 可以换别的自建歌单。
-->
<script lang='ts'>
  import CoverFlow from '$lib/prototype/dnd/cover/CoverFlow.svelte'
  import { coverUpload } from '$lib/prototype/dnd/cover/state.svelte'
  import DndWorld from '$lib/prototype/dnd/DndWorld.svelte'

  let flow = $state<ReturnType<typeof CoverFlow>>()
</script>

<svelte:head>
  <title>Campanula · 交互原型 · 换封面</title>
</svelte:head>

<DndWorld
  oncover={() => flow?.pick()}
  coverBusy={coverUpload.background?.busy ? coverUpload.background.progress : null}
  onTestFile={kind => flow?.useTestFile(kind)}
>
  <CoverFlow bind:this={flow} />
</DndWorld>
