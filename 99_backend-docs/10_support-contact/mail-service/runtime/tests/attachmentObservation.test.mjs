import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTACHMENT_CHUNK_SIZE, observeAttachment } from '../attachmentObservation.mjs';

test('different content and failed reads reset partial attachment coverage', () => {
  const transfer = { offset: 0, totalSize: ATTACHMENT_CHUNK_SIZE + 1, contentDigest: 'a'.repeat(64) };
  let item = observeAttachment({}, 'served', 'now', transfer);
  item = observeAttachment(item, 'served', 'now', { ...transfer, offset: ATTACHMENT_CHUNK_SIZE, contentDigest: 'b'.repeat(64) });
  assert.equal(item.availability, 'unverified');
  assert.deepEqual(item.servedChunks, [ATTACHMENT_CHUNK_SIZE]);
  item = observeAttachment(item, 'served', 'now', { ...transfer, contentDigest: 'b'.repeat(64) });
  assert.equal(item.availability, 'verified');
  item = observeAttachment(item, 'unavailable', 'now');
  assert.deepEqual(item.servedChunks, []);
  assert.equal(observeAttachment(item, 'served', 'now', transfer).availability, 'unverified');
});

test('maximum-size coverage remains bounded and rejects non-chunk positions', () => {
  let item = {};
  const totalSize = 64 * 1024 * 1024;
  for (let index = 127; index >= 0; index--) {
    const transfer = { offset: index * ATTACHMENT_CHUNK_SIZE, totalSize, contentDigest: 'a'.repeat(64) };
    item = observeAttachment(observeAttachment(item, 'served', 'now', transfer), 'served', 'now', transfer);
  }
  assert.equal(item.availability, 'verified'); assert.equal(item.servedChunks.length, 128);
  for (const offset of [1, totalSize]) assert.throws(() => observeAttachment(item, 'served', 'now', { offset, totalSize, contentDigest: 'a'.repeat(64) }));
  assert.throws(() => observeAttachment(item, 'served', 'now', { offset: 0, totalSize: totalSize + 1, contentDigest: 'a'.repeat(64) }));
});
