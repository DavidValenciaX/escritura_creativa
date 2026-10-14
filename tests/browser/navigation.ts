export function useRouter() {
  return {
    push: (path: string) => {
      document.body.dataset.navigation = path;
    },
    refresh: () => {
      document.body.dataset.refreshed = "true";
    },
  };
}
export function useSearchParams() {
  return new URLSearchParams(location.search);
}
