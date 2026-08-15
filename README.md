# rozenite-realm-devtools

A read-only [Rozenite](https://github.com/callstackincubator/rozenite) panel for inspecting Realm databases inside React Native DevTools.

## Features

- Runtime schema and row inspection
- Realm Query Language filtering
- Per-schema query and page state
- Fixed 100-row pagination
- Compact linked-object primary keys
- Clickable object, list, and set links
- Live updates and production no-op entry point

## Install

First enable Rozenite in the app, then install the plugin from GitHub:

```bash
npm install -D github:gustavomts/rozenite-realm-devtools#v0.1.4
```

Pass the open Realm instance near the database provider:

```tsx
import { useRealmDevTools } from 'rozenite-realm-devtools';

function DatabaseProvider({ children }) {
  const realm = useRealm();
  useRealmDevTools(realm);
  return children;
}
```

Include the plugin in the Rozenite Metro configuration and open React Native DevTools:

```js
withRozenite(config, {
  enabled: process.env.WITH_ROZENITE === 'true',
  include: ['rozenite-realm-devtools'],
});
```

```bash
WITH_ROZENITE=true npm start
```

The **Realm** panel lists every queryable schema. Select one and enter a Realm Query Language expression such as:

```text
name CONTAINS[c] "john"
```

## API

```ts
useRealmDevTools(realm: Realm | null | undefined): void
```

The inspector is read-only. It supports one open Realm, updates the active page after Realm changes, truncates displayed strings after 500 characters, and shows at most 20 linked primary keys per list cell.

## License

MIT
