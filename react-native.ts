import type { Realm } from 'realm';

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';
const isReactNative =
  typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

let useRealmDevTools: (realm: Realm | null | undefined) => void;

if (isDev && isReactNative && !isServer) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useRealmDevTools =
    require('./src/useRealmDevToolsNative').useRealmDevToolsNative;
} else {
  useRealmDevTools = () => {};
}

export { useRealmDevTools };
