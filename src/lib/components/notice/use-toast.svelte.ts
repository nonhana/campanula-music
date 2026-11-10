import { getAppView } from '../shared/app-context.svelte';

// 必须在组件初始化时调用：getAppView 读的是组件上下文
export const useToast = (): {
  success: (text: string) => number;
  error: (text: string) => number;
} => {
  const view = getAppView();
  return {
    success: (text) => view.app.toast('success', text),
    error: (text) => view.app.toast('error', text),
  };
};
