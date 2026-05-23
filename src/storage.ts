// storage.ts : 保存アダプタ。拡張では chrome.storage.local。将来のPWAは localStorage 等に差し替えるだけ。
// 画面/ロジックは必ずこの store 経由で保存し、chrome.storage を直接散在させない。
export interface Store {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
export const store: Store = {
  get<T>(key: string) {
    return new Promise<T | null>((res, rej) => {
      chrome.storage.local.get(key, (o) => {
        const error = chrome.runtime.lastError;
        if (error) {
          rej(new Error(error.message));
          return;
        }

        res((o[key] as T | undefined) ?? null);
      });
    });
  },
  set<T>(key: string, value: T) {
    return new Promise<void>((res, rej) =>
      chrome.storage.local.set({ [key]: value }, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          rej(new Error(error.message));
          return;
        }

        res();
      }),
    );
  },
  remove(key: string) {
    return new Promise<void>((res, rej) =>
      chrome.storage.local.remove(key, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          rej(new Error(error.message));
          return;
        }

        res();
      }),
    );
  },
};
