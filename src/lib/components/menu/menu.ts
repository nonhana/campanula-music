import type { LucideIcon } from '@lucide/svelte';

export type MenuTone = 'hearted' | 'download' | 'destructive';

type MenuLeading =
  | { readonly kind: 'icon'; readonly icon: LucideIcon }
  | { readonly kind: 'tile'; readonly icon: LucideIcon }
  | {
      readonly kind: 'cover';
      readonly url: string | null;
      readonly heart?: boolean;
    };

export interface MenuItem {
  readonly key: string;
  readonly label: string;
  readonly lang?: string;
  readonly detail?: string;
  readonly note?: string;
  readonly noteLang?: string;
  readonly leading?: MenuLeading;
  readonly tone?: MenuTone;
  readonly disabled?: boolean;
  readonly separated?: boolean;
  // 转交给另一层的项自己关，设成 false，不然会重复关旧的一层
  readonly closeOnChoose?: boolean;
  readonly run: () => void;
}

export type MenuHeader =
  | {
      readonly kind: 'media';
      readonly coverUrl: string | null;
      readonly title: string;
      readonly titleLang?: string;
      readonly subtitle?: string;
      readonly subtitleLang?: string;
    }
  | {
      readonly kind: 'text';
      readonly title: string;
      readonly note?: string;
      readonly subtitle?: string;
      readonly subtitleLang?: string;
    };
