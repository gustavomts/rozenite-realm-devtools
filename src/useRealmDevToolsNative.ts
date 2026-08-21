import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect } from 'react';
import Realm from 'realm';

import { getPage, getSchemaSummaries } from './realm-utils';
import type { EventMap, PageRequest } from './types';

const PLUGIN_ID = 'rozenite-realm-devtools';

export function useRealmDevToolsNative(realm: Realm | null | undefined) {
  const client = useRozeniteDevToolsClient<EventMap>({ pluginId: PLUGIN_ID });

  const readPage = (request: PageRequest) => {
    if (!realm || realm.isClosed) throw new Error('Realm is not open');
    return getPage(realm, request, (type, value) => {
      if (type === 'objectId') return new Realm.BSON.ObjectId(String(value));
      if (type === 'uuid') return new Realm.BSON.UUID(String(value));
      return value;
    });
  };

  useRozenitePluginAgentTool<Record<string, never>>({
    pluginId: PLUGIN_ID,
    enabled: Boolean(realm && !realm.isClosed),
    tool: {
      name: 'listSchemas',
      description: 'List queryable Realm schemas, properties, and row counts.',
      inputSchema: { type: 'object', properties: {} },
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    handler: () => {
      if (!realm || realm.isClosed) throw new Error('Realm is not open');
      return { schemas: getSchemaSummaries(realm) };
    },
  });

  useRozenitePluginAgentTool<{
    schemaName: string;
    query?: string;
    page?: number;
  }>({
    pluginId: PLUGIN_ID,
    enabled: Boolean(realm && !realm.isClosed),
    tool: {
      name: 'queryRealm',
      description: 'Run a read-only Realm Query Language filter and return one bounded page.',
      inputSchema: {
        type: 'object',
        properties: {
          schemaName: { type: 'string' },
          query: { type: 'string', default: '' },
          page: { type: 'integer', minimum: 0, default: 0 },
        },
        required: ['schemaName'],
      },
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    handler: ({ schemaName, query = '', page = 0 }) =>
      readPage({ requestId: 0, schemaName, query, page }),
  });

  useEffect(() => {
    if (!client || !realm || realm.isClosed) return;

    const sendSchemas = () => {
      client.send('realm:schemas', getSchemaSummaries(realm));
    };
    const sendPage = (request: PageRequest) => {
      try {
        client.send('realm:page', readPage(request));
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
