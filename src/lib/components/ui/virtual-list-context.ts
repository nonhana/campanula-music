import { createContext } from 'svelte';

export interface VirtualListContext {
  readonly deferImages: boolean;
}

export const [getVirtualList, setVirtualList, hasVirtualList] =
  createContext<VirtualListContext>();
