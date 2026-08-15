import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  EventMap,
  PageResult,
  SchemaSummary,
} from './types';

export function useRealmDevToolsPanel() {
  const client = useRozeniteDevToolsClient<EventMap>({
    pluginId: 'rozenite-realm-devtools',
  });
  const latestRequest = useRef(0);
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [pageResult, setPageResult] = useState<PageResult>();
  const [queryError, setQueryError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!client) return;

    let retry: ReturnType<typeof setTimeout>;
    const schemasMessage = client.onMessage('realm:schemas', (nextSchemas) => {
      clearTimeout(retry);
      setSchemas(nextSchemas);
    });
    const pageMessage = client.onMessage('realm:page', (result) => {
      if (result.requestId !== latestRequest.current) return;
      setLoading(false);
      if (result.error) {
        setQueryError(result.error);
      } else {
        setQueryError(undefined);
        setPageResult(result);
      }
    });
    const requestSchemas = () => {
      client.send('realm:request-schemas', undefined);
    };
    requestSchemas();
    retry = setTimeout(requestSchemas, 500);

    return () => {
      clearTimeout(retry);
      schemasMessage.remove();
      pageMessage.remove();
    };
  }, [client]);

  const requestPage = useCallback(
    (schemaName: string, query: string, page: number) => {
      const requestId = ++latestRequest.current;
      setLoading(true);
      setQueryError(undefined);
      client?.send('realm:request-page', {
        requestId,
        schemaName,
        query,
        page,
      });
    },
    [client],
  );

  return {
    schemas,
    pageResult,
    queryError,
    loading,
    requestPage,
  };
}
