import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LinkTarget, RowSnapshot } from './types';

const CELL_WIDTH = 180;
const ROW_NUMBER_WIDTH = 56;

type Props = {
  columns: string[];
  rows: RowSnapshot[];
  rowOffset: number;
  onOpenLink: (link: LinkTarget) => void;
};

function Cell({
  value,
  onOpenLink,
}: {
  value: RowSnapshot[string];
  onOpenLink: (link: LinkTarget) => void;
}) {
  if (value && typeof value === 'object') {
    return (
      <View style={styles.cell}>
        <Text style={styles.cellText}>
          {value.collection && '['}
          {value.links.map((link, index) => (
            <Text
              accessibilityRole="link"
              key={`${link.schemaName}:${link.query}:${index}`}
              onPress={() => onOpenLink(link)}
              style={styles.linkText}
            >
              {`${index ? ', ' : ''}${link.label}`}
            </Text>
          ))}
          {value.remaining ? ` … +${value.remaining}` : ''}
          {value.collection && ']'}
        </Text>
      </View>
    );
  }

  const color = value === null
    ? '#6b7280'
    : typeof value === 'number'
      ? '#90caf9'
      : typeof value === 'boolean'
        ? '#ce93d8'
        : '#d1d5db';

  return (
    <View style={styles.cell}>
      <Text numberOfLines={1} selectable style={[styles.cellText, { color }]}>
        {value === null ? 'null' : String(value)}
      </Text>
    </View>
  );
}

export function SchemaTable({ columns, rows, rowOffset, onOpenLink }: Props) {
  const tableWidth = ROW_NUMBER_WIDTH + columns.length * CELL_WIDTH;

  return (
    <ScrollView horizontal style={styles.horizontal}>
      <View style={{ width: tableWidth }}>
        <View style={styles.headerRow}>
          <View style={styles.rowNumberCell}>
            <Text style={styles.headerText}>#</Text>
          </View>
          {columns.map((column) => (
            <View key={column} style={styles.headerCell}>
              <Text numberOfLines={1} style={styles.headerText}>{column}</Text>
            </View>
          ))}
        </View>
        <ScrollView style={styles.rows}>
          {rows.map((row, index) => (
            <View key={index} style={styles.row}>
              <View style={styles.rowNumberCell}>
                <Text style={styles.rowNumber}>{rowOffset + index + 1}</Text>
              </View>
              {columns.map((column) => (
                <Cell
                  key={column}
                  value={row[column] ?? null}
                  onOpenLink={onOpenLink}
                />
              ))}
            </View>
          ))}
          {!rows.length && (
            <Text style={styles.empty}>No rows match this query.</Text>
          )}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  horizontal: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 6,
    backgroundColor: '#111827',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  headerCell: {
    width: CELL_WIDTH,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  headerText: {
    color: '#9ca3af',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rows: { flex: 1 },
  row: {
    flexDirection: 'row',
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  cell: {
    width: CELL_WIDTH,
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#1f2937',
  },
  cellText: { fontFamily: 'monospace', fontSize: 12 },
  linkText: { color: '#60a5fa', textDecorationLine: 'underline' },
  rowNumberCell: {
    width: ROW_NUMBER_WIDTH,
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  rowNumber: {
    color: '#6b7280',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  empty: {
    color: '#6b7280',
    fontFamily: 'monospace',
    padding: 16,
  },
});
