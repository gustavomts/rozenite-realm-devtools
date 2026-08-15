import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect } from 'react';
import Realm from 'realm';

import { getPage, getSchemaSummaries } from './realm-utils';
import type { EventMap, PageRequest } from './types';

const PLUGIN_ID = 'rozenite-realm-devtools';

export function useRealmDevToolsNative(realm: Realm | null | undefined) {
  const client = useRozeniteDevToolsClient<EventMap>({ pluginId: PLUGIN_ID });

  useEffect(() => {
    if (!client || !realm || realm.isClosed) return;

    const sendSchemas = () => {
      client.send('realm:schemas', getSchemaSummaries(realm));
    };
    const sendPage = (request: PageRequest) => {
      try {
        client.send('realm:page', getPage(realm, request, (type, value) => {
          if (type === 'objectId') return new Realm.BSON.ObjectId(String(value));
          if (type === 'uuid') return new Realm.BSON.UUID(String(value));
          return value;
        }));
      } catch (error) {
        client.send('realm:page', {
          ...request,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    let activeRequest: PageRequest | undefined;

    const schemasRequest = client.onMessage(
      'realm:request-schemas',
      sendSchemas,
    );
    const pageRequest = client.onMessage('realm:request-page', (request) => {
      activeRequest = request;
      sendPage(request);
    });
    const onChange = () => {
      sendSchemas();
      if (activeRequest) sendPage(activeRequest);
    };

    realm.addListener('change', onChange);
    realm.addListener('schema', onChange);
    sendSchemas();
    return () => {
      if (!realm.isClosed) {
        realm.removeListener('change', onChange);
        realm.removeListener('schema', onChange);
      }
      schemasRequest.remove();
      pageRequest.remove();
    };
  }, [client, realm]);
}
