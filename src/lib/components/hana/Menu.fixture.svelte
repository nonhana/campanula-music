<script lang='ts'>
  import Menu from './Menu.svelte'
  import MenuItem from './MenuItem.svelte'

  // 测试夹具：Menu 的 children 片段无法从测试文件以组件形式传入，用真实结构（Menu + MenuItem）包装
  const { onselect }: { onselect?: (key: string) => void } = $props()
</script>

<Menu {onselect}>
  <MenuItem key='lyrics' title='歌词' />
  <MenuItem key='playlist' title='播放列表' />
</Menu>
