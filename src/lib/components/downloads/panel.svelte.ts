import { resolve } from '$app/paths';
import { page } from '$app/state';

export const createDownloadPanel = () => {
  let open = $state(false);
  let collapsed = $state(false);
  const onDownloads = $derived(page.url.pathname === resolve('/downloads'));
  const expanded = $derived(open && !collapsed && !onDownloads);

  return {
    get open() {
      return open;
    },
    get collapsed() {
      return collapsed;
    },
    get expanded() {
      return expanded;
    },
    get onDownloads() {
      return onDownloads;
    },
    reveal() {
      open = true;
    },
    collapse() {
      collapsed = true;
    },
    expand() {
      open = true;
      collapsed = false;
    },
    hide() {
      open = false;
    },
  };
};
