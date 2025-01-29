<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import Input from '$lib/components/hana/Input.svelte'

  let value = $state('')
</script>

<svelte:head>
  <title>Components Bench</title>
  <meta name='description' content='Bench for components' />
</svelte:head>

<h1>Components Bench</h1>

<div>
  <h2>Button</h2>
  <Button>Click me</Button>
</div>

<div>
  <h2>Input</h2>
  <Input bind:value placeholder='Please input something~' />
  <p>Input value: {value}</p>
</div>
