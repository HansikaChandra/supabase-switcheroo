import { lazy } from "react";

const KEY = "kampus-app-reload";

// If a stale module URL fails to load (e.g. after a hot update), reload once.
export const KampusApp = lazy(() =>
  import("@/kampus/App")
    .then((m) => {
      sessionStorage.removeItem(KEY);
      return m;
    })
    .catch((err) => {
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    }),
);
