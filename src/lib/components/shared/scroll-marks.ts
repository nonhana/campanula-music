import { createContext } from 'svelte';

export interface ScrollMark {
  caption: string;
  title: string;
  lang?: string;
}

export interface ScrollLookup {
  markAt: ((top: number) => ScrollMark | null) | null;
}

export const [getScrollLookup, setScrollLookup, hasScrollLookup] =
  createContext<ScrollLookup>();
