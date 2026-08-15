import assert from 'node:assert/strict';
import test from 'node:test';
import type { ObjectSchema, Realm } from 'realm';

import {
  getPage,
  getSchemaSummaries,
  PAGE_SIZE,
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
}));

function results(values: unknown[]) {
  return Object.assign(values, {
    filtered(query: string) {
      const uid = Number(query.match(/_uid == (\d+)/)?.[1]);
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
  assert.equal(page.rows?.[0].manager, 1);
  assert.match(String(page.rows?.[0].coworkers), /… \+2$/);
  assert.equal(page.rows?.[0].tags, '["one","two"]');
  assert.equal(page.rows?.[0].profile, '{"active":true}');
  assert.match(String(page.rows?.[0].signature), /… \(600 chars\)$/);
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
