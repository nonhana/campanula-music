import { createContext } from 'svelte';

// 没有 provider 的根屏得用 hasSelectionMode() 判断，按“没在多选”处理

export const [getSelectionMode, setSelectionMode, hasSelectionMode] =
  createContext<() => boolean>();
