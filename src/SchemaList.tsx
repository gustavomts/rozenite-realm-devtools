import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { SchemaSummary } from './types';

type Props = {
  schemas: SchemaSummary[];
  selected: string | null;
  onSelect: (name: string) => void;
};

export function SchemaList({ schemas, selected, onSelect }: Props) {
  return (
    <ScrollView style={styles.list}>
      {schemas.map((schema) => (
        <Pressable
          accessibilityRole="button"
          key={schema.name}
          onPress={() => onSelect(schema.name)}
          style={[
            styles.item,
            schema.name === selected && styles.selectedItem,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              schema.name === selected && styles.selectedText,
            ]}
          >
            {schema.name}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.count}>{schema.count}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  selectedItem: { backgroundColor: '#3b82f6' },
  name: {
    flex: 1,
    color: '#e5e7eb',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  selectedText: { color: '#fff' },
  countBadge: {
    minWidth: 28,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#374151',
  },
  count: {
    color: '#d1d5db',
    fontFamily: 'monospace',
    fontSize: 10,
    textAlign: 'center',
  },
});
