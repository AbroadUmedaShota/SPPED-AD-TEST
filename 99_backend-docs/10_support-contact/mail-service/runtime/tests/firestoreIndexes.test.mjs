import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('period-scoped pending and unreviewed aggregation queries have exact composite indexes', () => {
  const definition = JSON.parse(readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8'));
  for (const fields of [['matchState', 'internalDate'], ['matchState', 'firstReview', 'internalDate']]) {
    assert.ok(definition.indexes.some((index) => index.collectionGroup === 'messages' && index.queryScope === 'COLLECTION' &&
      JSON.stringify(index.fields) === JSON.stringify(fields.map((fieldPath) => ({ fieldPath, order: 'ASCENDING' })))),
    `missing exact index for ${fields.join(', ')}`);
  }
});
