import assert from 'node:assert/strict';
import test from 'node:test';
import type { ObjectSchema, Realm } from 'realm';

import {
  getPage,
  getSchemaSummaries,
  PAGE_SIZE,
  serializeRow,
} from './realm-utils.ts';

const schemas: ObjectSchema[] = [
  {
    name: 'User',
    primaryKey: '_uid',
    properties: {
      _uid: 'int',
      name: 'string',
      manager: 'User?',
      coworkers: 'User[]',
      tags: { type: 'list', objectType: 'string' },
      profile: 'Profile?',
      signature: 'string?',
      accessToken: 'string?',
    },
  },
  {
    name: 'Profile',
    embedded: true,
    properties: { active: 'bool' },
  },
  {
    name: 'Empty',
    properties: { value: 'string' },
  },
];

const users = Array.from({ length: PAGE_SIZE + 1 }, (_, index) => ({
  _uid: index + 1,
  name: `User ${index + 1}`,
  manager: index ? { _uid: 1 } : null,
  coworkers: Array.from({ length: 22 }, (_, uid) => ({ _uid: uid + 1 })),
  tags: ['one', 'two'],
  profile: { active: index % 2 === 0 },
  signature: 'x'.repeat(600),
  accessToken: 'private',
}));

function results(values: unknown[]) {
  return Object.assign(values, {
    filtered(query: string, ...args: unknown[]) {
      const uid = Number(args[0] ?? query.match(/_uid == (\d+)/)?.[1]);
      if (!uid) throw new Error('Invalid query');
      return results(values.filter((value) =>
        (value as { _uid: number })._uid === uid,
      ));
    },
  });
}

const realm = {
  schema: schemas,
  objects(name: string) {
    return results(name === 'User' ? [...users] : []);
  },
} as unknown as Realm;

test('lists queryable schemas, including empty ones', () => {
  assert.deepEqual(getSchemaSummaries(realm), [
    {
      name: 'User',
      count: PAGE_SIZE + 1,
      properties: [
        '_uid',
        'name',
        'manager',
        'coworkers',
        'tags',
        'profile',
        'signature',
        'accessToken',
      ],
    },
    { name: 'Empty', count: 0, properties: ['value'] },
  ]);
});

test('paginates and serializes links without recursively expanding them', () => {
  const page = getPage(realm, {
    requestId: 1,
    schemaName: 'User',
    query: '',
    page: 1,
  });

  assert.equal(page.total, PAGE_SIZE + 1);
  assert.equal(page.rows?.length, 1);
  assert.deepEqual(page.rows?.[0].manager, {
    kind: 'links',
    collection: false,
    links: [{
      label: '1',
      schemaName: 'User',
      query: '_uid == 1',
      argument: { property: '_uid', value: 1 },
    }],
    remaining: 0,
  });
  const coworkers = page.rows?.[0].coworkers;
  assert.ok(coworkers && typeof coworkers === 'object');
  assert.equal(coworkers.links.length, 20);
  assert.equal(coworkers.remaining, 2);
  assert.equal(page.rows?.[0].tags, '["one","two"]');
  assert.equal(page.rows?.[0].profile, '{"active":true}');
  assert.match(String(page.rows?.[0].signature), /… \(600 chars\)$/);
  assert.equal(page.rows?.[0].accessToken, '<redacted>');
});

test('applies a Realm query before pagination', () => {
  const page = getPage(realm, {
    requestId: 2,
    schemaName: 'User',
    query: '_uid == 42',
    page: 0,
  });

  assert.equal(page.total, 1);
  assert.equal(page.rows?.[0]._uid, 42);
});

test('uses a parameter when navigating to a linked primary key', () => {
  const page = getPage(realm, {
    requestId: 3,
    schemaName: 'User',
    query: '_uid == 42',
    queryArgument: { property: '_uid', value: 42 },
    page: 0,
  });

  assert.equal(page.total, 1);
  assert.equal(page.rows?.[0]._uid, 42);
});

test('creates clickable links for string-key objects and sets', () => {
  const schema: ObjectSchema = {
    name: 'StringKey',
    primaryKey: 'id',
    properties: {
      id: 'string',
      parent: 'StringKey?',
      peers: { type: 'set', objectType: 'StringKey' },
    },
  };
  const id = `a'"\\b`;
  const row = serializeRow(
    { id: 'source', parent: { id }, peers: new Set([{ id }]) },
    schema,
    [schema],
  );

  const target = {
    label: id,
    schemaName: 'StringKey',
    query: `id == ${JSON.stringify(id)}`,
    argument: { property: 'id', value: id },
  };
  assert.deepEqual(row.parent, {
    kind: 'links',
    collection: false,
    links: [target],
    remaining: 0,
  });
  assert.deepEqual(row.peers, {
    kind: 'links',
    collection: true,
    links: [target],
    remaining: 0,
  });
});
