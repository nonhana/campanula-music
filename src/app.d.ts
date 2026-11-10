declare global {
  // Vite define 注入：pnpm dev:mock 为 true，生产构建为 false
  const __CAMPANULA_MOCK__: boolean;
  namespace App {
    interface PageState {
      overlays?: import('./lib/components/overlay/overlay-stack').OverlayMarker;
    }
  }
}

export {};
