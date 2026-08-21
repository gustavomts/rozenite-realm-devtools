import type { ObjectSchema, Realm } from 'realm';

import type {
  CellValue,
  LinkedCellValue,
  LinkTarget,
  PageRequest,
  PageResult,
  PrimitiveCellValue,
  RowSnapshot,
  SchemaSummary,
} from './types';

export const PAGE_SIZE = 100;

const MAX_STRING_LENGTH = 500;
const MAX_LIST_ITEMS = 20;
const sensitiveProperty = /token|password|secret|authorization|api.?key/i;
const primitiveTypes = new Set([
  'bool',
  'data',
  'date',
  'decimal128',
  'double',
  'float',
  'int',
  'mixed',
  'objectId',
  'string',
  'uuid',
]);

type RealmLike = Pick<Realm, 'schema' | 'objects'>;
type PropertyInfo = { type: string; objectType?: string };
type QueryResults = {
  length: number;
  filtered(query: string, ...args: unknown[]): QueryResults;
  slice(start: number, end: number): unknown[];
};

function truncate(value: string): string {
  return value.length <= MAX_STRING_LENGTH
    ? value
    : `${value.slice(0, MAX_STRING_LENGTH)}… (${value.length} chars)`;
}

function propertyInfo(property: unknown): PropertyInfo {
  if (typeof property !== 'string') {
    const value = property as { type: string; objectType?: string };
    return {
      type: value.type,
      objectType: value.objectType && !primitiveTypes.has(value.objectType)
        ? value.objectType
        : undefined,
    };
  }

  const value = property.replace(/\?$/, '');
  if (value.endsWith('[]')) {
    const itemType = value.slice(0, -2);
    return {
      type: 'list',
      objectType: primitiveTypes.has(itemType) ? undefined : itemType,
    };
  }
  if (value.endsWith('{}')) return { type: 'dictionary' };
  return primitiveTypes.has(value)
    ? { type: value }
    : { type: 'object', objectType: value };
}

function formatJson(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return truncate(
      JSON.stringify(value, (_key, item: unknown) => {
        if (typeof item === 'bigint') return String(item);
        if (item instanceof ArrayBuffer) return `<${item.byteLength} bytes>`;
        if (ArrayBuffer.isView(item)) return `<${item.byteLength} bytes>`;
        if (item && typeof item === 'object') {
          if (seen.has(item)) return '[Circular]';
          seen.add(item);
        }
        return item;
      }),
    );
  } catch {
    return truncate(String(value));
  }
}

function formatScalar(value: unknown): PrimitiveCellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof ArrayBuffer) return `<${value.byteLength} bytes>`;
  if (ArrayBuffer.isView(value)) return `<${value.byteLength} bytes>`;

  const constructorName = (value as { constructor?: { name?: string } })
    .constructor?.name;
  if (
    constructorName &&
    ['Decimal128', 'ObjectId', 'UUID'].includes(constructorName)
  ) {
    return truncate(String(value));
  }

  return formatJson(value);
}

function linkTarget(
  value: unknown,
  schema: ObjectSchema,
): LinkTarget | undefined {
  if (!schema.primaryKey) return;

  const type = propertyInfo(schema.properties[schema.primaryKey]).type;
  const argumentValue = type === 'int' && typeof value === 'number'
    ? value
    : ['string', 'objectId', 'uuid'].includes(type)
      ? String(value)
      : undefined;
  if (argumentValue === undefined) return;

  const literal = type === 'string'
    ? JSON.stringify(argumentValue)
    : type === 'objectId'
      ? `oid(${argumentValue})`
      : type === 'uuid'
        ? `uuid(${argumentValue})`
        : String(argumentValue);
  return {
    label: String(formatScalar(value)),
    schemaName: schema.name,
    query: `${schema.primaryKey} == ${literal}`,
    argument: { property: schema.primaryKey, value: argumentValue },
  };
}

function linkedCell(
  links: LinkTarget[],
  collection: boolean,
  remaining = 0,
): LinkedCellValue {
  return { kind: 'links', collection, links, remaining };
}

function displayValue(value: CellValue): PrimitiveCellValue {
  if (value && typeof value === 'object') {
    return value.collection
      ? `${JSON.stringify(
        value.links.map((link) => link.argument.value),
      )}${value.remaining ? ` … +${value.remaining}` : ''}`
      : value.links[0]?.label ?? null;
  }
  return value;
}

function findSchema(
  schemas: readonly ObjectSchema[],
  name: string | undefined,
): ObjectSchema | undefined {
  return name ? schemas.find((schema) => schema.name === name) : undefined;
}

function serializeEmbedded(
  value: Record<string, unknown>,
  schema: ObjectSchema,
  schemas: readonly ObjectSchema[],
): Record<string, CellValue> {
  return Object.fromEntries(
    Object.entries(schema.properties).map(([name, property]) => [
      name,
      displayValue(serializeProperty(value[name], property, schemas)),
    ]),
  );
}

function formatLinkedObject(
  value: unknown,
  objectType: string | undefined,
  schemas: readonly ObjectSchema[],
): CellValue {
  if (value === null || value === undefined) return null;

  const schema = findSchema(schemas, objectType);
  if (schema?.embedded) {
    return formatJson(
      serializeEmbedded(value as Record<string, unknown>, schema, schemas),
    );
  }

  if (schema?.primaryKey) {
    const target = linkTarget(
      (value as Record<string, unknown>)[schema.primaryKey],
      schema,
    );
    if (target) return linkedCell([target], false);
  }

  return `Object(${objectType ?? 'unknown'})`;
}

function formatCollection(
  value: unknown,
  objectType: string | undefined,
  schemas: readonly ObjectSchema[],
): CellValue {
  if (value === null || value === undefined) return '[]';

  const items = Array.from(value as Iterable<unknown>);
  const schema = findSchema(schemas, objectType);
  if (schema?.primaryKey) {
    const links = items.slice(0, MAX_LIST_ITEMS).flatMap((item) => {
      const target = linkTarget(
        (item as Record<string, unknown>)[schema.primaryKey!],
        schema,
      );
      return target ? [target] : [];
    });
    if (links.length) {
      return linkedCell(
        links,
        true,
        Math.max(0, items.length - MAX_LIST_ITEMS),
      );
    }
  }
  const displayed = items.slice(0, MAX_LIST_ITEMS).map((item) => {
    if (!objectType) return formatScalar(item);
    if (schema?.embedded) {
      return serializeEmbedded(
        item as Record<string, unknown>,
        schema,
        schemas,
      );
    }
    return `Object(${objectType})`;
  });
  const suffix = items.length > MAX_LIST_ITEMS
    ? ` … +${items.length - MAX_LIST_ITEMS}`
    : '';
  return truncate(`${JSON.stringify(displayed)}${suffix}`);
}

function serializeProperty(
  value: unknown,
  property: unknown,
  schemas: readonly ObjectSchema[],
): CellValue {
  const info = propertyInfo(property);
  if (info.type === 'object') {
    return formatLinkedObject(value, info.objectType, schemas);
  }
  if (['list', 'set', 'linkingObjects'].includes(info.type)) {
    return formatCollection(value, info.objectType, schemas);
  }
  return formatScalar(value);
}

export function serializeRow(
  value: Record<string, unknown>,
  schema: ObjectSchema,
  schemas: readonly ObjectSchema[],
): RowSnapshot {
  return Object.fromEntries(
    Object.entries(schema.properties).map(([name, property]) => {
      if (sensitiveProperty.test(name)) return [name, '<redacted>'];
      try {
        return [name, serializeProperty(value[name], property, schemas)];
      } catch {
        return [name, '<unavailable>'];
      }
    }),
  );
}

export function getSchemaSummaries(realm: RealmLike): SchemaSummary[] {
  return realm.schema.flatMap((schema) => {
    const flags = schema as ObjectSchema & { asymmetric?: boolean };
    if (flags.embedded || flags.asymmetric) return [];

    try {
      return [{
        name: schema.name,
        count: realm.objects(schema.name).length,
        properties: Object.keys(schema.properties),
      }];
    } catch {
      return [];
    }
  });
}

export function getPage(
  realm: RealmLike,
  request: PageRequest,
  decodeArgument: (type: string, value: string | number) => unknown = (
    _type,
    value,
  ) => value,
): PageResult {
  const schema = realm.schema.find(
    (candidate) => candidate.name === request.schemaName,
  );
  if (!schema || schema.embedded) {
    throw new Error(`Schema "${request.schemaName}" is not queryable`);
  }

  let results = realm.objects(request.schemaName) as unknown as QueryResults;
  if (request.queryArgument) {
    if (request.queryArgument.property !== schema.primaryKey) {
      throw new Error('Linked query does not match the schema primary key');
    }
    const type = propertyInfo(schema.properties[request.queryArgument.property]).type;
    const value = decodeArgument(type, request.queryArgument.value);
    results = results.filtered(`${request.queryArgument.property} == $0`, value);
  } else if (request.query.trim()) {
    results = results.filtered(request.query.trim());
  }

  const page = Math.max(0, request.page);
  const start = page * PAGE_SIZE;
  return {
    ...request,
    page,
    total: results.length,
    rows: results
      .slice(start, start + PAGE_SIZE)
      .map((value) => serializeRow(
        value as Record<string, unknown>,
        schema,
        realm.schema,
      )),
  };
}
