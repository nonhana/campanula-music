<!-- PROTOTYPE · 行内小徽标：试听（会员歌曲）、无版权。 -->
<script lang='ts'>
  interface Props {
    kind: 'trial' | 'nocopy'
  }

  const { kind }: Props = $props()
</script>

<span class={['tag', kind]}>{kind === 'trial' ? '试听' : '无版权'}</span>

<style>
  .tag {
    display: inline-flex;
    flex: none;
    align-items: center;
    height: 18px;
    padding: 0 6px;
    border-radius: 5px;
    font-size: 11px;
    line-height: 1;
    font-weight: 500;
    white-space: nowrap;
  }

  .trial {
    background: #fff8e1;
    color: #bf360c;
  }

  .nocopy {
    background: #f3f4f6;
    color: #374151;
  }
</style>
