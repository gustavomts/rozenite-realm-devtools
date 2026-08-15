import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PAGE_SIZE } from './realm-utils';
import { SchemaList } from './SchemaList';
import { SchemaTable } from './SchemaTable';
import { useRealmDevToolsPanel } from './useRealmDevTools';
import type { LinkTarget, QueryArgument } from './types';

function ActionButton({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export default function RealmDevToolsPanel() {
  const {
    schemas,
    pageResult,
    queryError,
    loading,
    requestPage,
  } = useRealmDevToolsPanel();
  const [schemaFilter, setSchemaFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [queryDraft, setQueryDraft] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [queryArgument, setQueryArgument] = useState<QueryArgument>();
  const [page, setPage] = useState(0);
  const schemaState = useRef(new Map<string, {
    queryDraft: string;
    appliedQuery: string;
    queryArgument?: QueryArgument;
    page: number;
  }>());

  const visibleSchemas = useMemo(
    () => schemas.filter((schema) =>
      schema.name.toLowerCase().includes(schemaFilter.toLowerCase()),
    ),
    [schemaFilter, schemas],
  );
  const selectedSchema = schemas.find((schema) => schema.name === selected);
  const visiblePage = pageResult?.schemaName === selected ? pageResult : undefined;

  useEffect(() => {
    if (schemas.length && (!selected || !selectedSchema)) {
      setSelected(schemas[0].name);
    }
  }, [schemas, selected, selectedSchema]);

  useEffect(() => {
    if (selected) requestPage(selected, appliedQuery, page, queryArgument);
  }, [appliedQuery, page, queryArgument, requestPage, selected]);

  const selectSchema = (name: string) => {
    if (selected) {
      schemaState.current.set(selected, {
        queryDraft,
        appliedQuery,
        queryArgument,
        page,
      });
    }
    const saved = schemaState.current.get(name);
    setSelected(name);
    setQueryDraft(saved?.queryDraft ?? '');
    setAppliedQuery(saved?.appliedQuery ?? '');
    setQueryArgument(saved?.queryArgument);
    setPage(saved?.page ?? 0);
  };

  const openLink = (link: LinkTarget) => {
    selectSchema(link.schemaName);
    setQueryDraft(link.query);
    setAppliedQuery(link.query);
    setQueryArgument(link.argument);
    setPage(0);
  };

  const applyQuery = () => {
    if (!selected) return;
    const query = queryDraft.trim();
    if (query === appliedQuery && page === 0) {
      requestPage(selected, query, 0, queryArgument);
    } else {
      setQueryArgument(undefined);
      setAppliedQuery(query);
      setPage(0);
    }
  };

  const clearQuery = () => {
    setQueryDraft('');
    setQueryArgument(undefined);
    if (!selected) return;
    if (!appliedQuery && page === 0) {
      requestPage(selected, '', 0);
    } else {
      setAppliedQuery('');
      setPage(0);
    }
  };

  const total = visiblePage?.total ?? 0;
  const rows = visiblePage?.rows ?? [];
  const resultPage = visiblePage?.page ?? page;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRow = total ? resultPage * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(total, (resultPage + 1) * PAGE_SIZE);

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <TextInput
          placeholder="Filter schemas..."
          placeholderTextColor="#6b7280"
          value={schemaFilter}
          onChangeText={setSchemaFilter}
          style={styles.schemaFilter}
        />
        <SchemaList
          schemas={visibleSchemas}
          selected={selected}
          onSelect={selectSchema}
        />
      </View>

      <View style={styles.main}>
        {selectedSchema ? (
          <>
            <Text style={styles.title}>{selectedSchema.name}</Text>
            <View style={styles.queryRow}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={applyQuery}
                placeholder='Realm query, e.g. name CONTAINS[c] "john"'
                placeholderTextColor="#6b7280"
                value={queryDraft}
                onChangeText={setQueryDraft}
                style={styles.queryInput}
              />
              <ActionButton label="Apply" onPress={applyQuery} />
              <ActionButton label="Clear" onPress={clearQuery} />
            </View>
            {queryError && <Text style={styles.error}>{queryError}</Text>}
            {loading && <Text style={styles.loading}>Loading…</Text>}
            <SchemaTable
              columns={selectedSchema.properties}
              rows={rows}
              rowOffset={resultPage * PAGE_SIZE}
              onOpenLink={openLink}
            />
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {firstRow}–{lastRow} of {total} · Page {resultPage + 1} of {pageCount}
              </Text>
              <View style={styles.footerActions}>
                <ActionButton
                  disabled={page <= 0 || loading}
                  label="Previous"
                  onPress={() => setPage((value) => Math.max(0, value - 1))}
                />
                <ActionButton
                  disabled={lastRow >= total || loading}
                  label="Next"
                  onPress={() => setPage((value) => value + 1)}
                />
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.placeholder}>
            Waiting for an open Realm database…
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
  },
  sidebar: {
    width: 240,
    padding: 12,
    gap: 8,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  schemaFilter: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 6,
    backgroundColor: '#111827',
    color: '#e5e7eb',
    fontSize: 13,
  },
  main: { flex: 1, padding: 16, gap: 10 },
  title: {
    color: '#e5e7eb',
    fontFamily: 'monospace',
    fontSize: 17,
    fontWeight: 'bold',
  },
  queryRow: { flexDirection: 'row', gap: 8 },
  queryInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 6,
    backgroundColor: '#111827',
    color: '#e5e7eb',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  button: {
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 6,
    backgroundColor: '#1f2937',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#e5e7eb', fontSize: 12 },
  error: { color: '#f87171', fontFamily: 'monospace', fontSize: 12 },
  loading: { color: '#93c5fd', fontFamily: 'monospace', fontSize: 11 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: { color: '#9ca3af', fontFamily: 'monospace', fontSize: 11 },
  footerActions: { flexDirection: 'row', gap: 8 },
  placeholder: { color: '#6b7280', fontFamily: 'monospace' },
});
