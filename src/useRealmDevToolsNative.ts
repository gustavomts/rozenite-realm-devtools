import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect } from 'react';
import type { Realm } from 'realm';

import { getPage, getSchemaSummaries } from './realm-utils';
import type { EventMap } from './types';

const PLUGIN_ID = 'rozenite-realm-devtools';

export function useRealmDevToolsNative(realm: Realm | null | undefined) {
  const client = useRozeniteDevToolsClient<EventMap>({ pluginId: PLUGIN_ID });

  useEffect(() => {
    if (!client || !realm || realm.isClosed) return;

    const sendSchemas = () => {
      client.send('realm:schemas', getSchemaSummaries(realm));
    };

    const schemasRequest = client.onMessage(
      'realm:request-schemas',
      sendSchemas,
    );
    const pageRequest = client.onMessage('realm:request-page', (request) => {
      try {
        client.send('realm:page', getPage(realm, request));
      } catch (error) {
        client.send('realm:page', {
          ...request,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    sendSchemas();
    return () => {
      schemasRequest.remove();
      pageRequest.remove();
    };
  }, [client, realm]);
}
