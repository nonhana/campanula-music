declare global {
  namespace App {
    interface PageState {
      overlays?: import('./lib/components/overlay/overlay-stack.ts').OverlayMarker;
    }
  }
}

export {};
