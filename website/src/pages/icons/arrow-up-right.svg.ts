import { ArrowUpRight } from '@lucide/svelte';
import { render } from 'svelte/server';

export const GET = () =>
  new Response(render(ArrowUpRight).body, {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
