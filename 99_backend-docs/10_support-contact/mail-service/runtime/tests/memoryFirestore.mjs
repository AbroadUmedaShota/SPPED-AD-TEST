const copy = (value) => value === undefined ? undefined : structuredClone(value);

export function memoryFirestore(seed = {}) {
  const records = new Map(Object.entries(seed).map(([key, value]) => [key, copy(value)]));
  let commits = 0;
  let failCommit = 0;
  let queue = Promise.resolve();
  const snapshot = (ref, source = records) => ({ ref, id: ref.id, exists: source.has(ref.path), data: () => copy(source.get(ref.path)) });
  function document(path) {
    return { path, id: path.split('/').at(-1), get: async () => snapshot(document(path)),
      collection: (name) => collection(`${path}/${name}`),
      listCollections: async () => [...new Set([...records.keys()].filter((key) => key.startsWith(`${path}/`)).map((key) => key.slice(path.length + 1).split('/')[0]))].map((name) => collection(`${path}/${name}`)) };
  }
  function collection(path, filters = [], maximum = Infinity, orders = [], after = null) {
    const query = { path, id: path.split('/').at(-1), doc: (id) => document(`${path}/${id || 'generated'}`),
      listDocuments: async () => [...new Set([...records.keys()].filter((key) => key.startsWith(`${path}/`)).map((key) => `${path}/${key.slice(path.length + 1).split('/')[0]}`))].map(document),
      where: (field, operator, expected) => collection(path, [...filters, { field, operator, expected }], maximum, orders, after),
      limit: (value) => collection(path, filters, value, orders, after),
      orderBy: (field, direction = 'asc') => collection(path, filters, maximum, [...orders, { field, direction }], after),
      startAfter: (value) => collection(path, filters, maximum, orders, value),
      get: async () => {
        let found = [...records].filter(([key]) => key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1)
          .filter(([key, value]) => (!after || key.split('/').at(-1) > after) && filters.every(({ field, operator, expected }) => operator === '==' ? value[field] === expected : operator === 'in' ? expected.includes(value[field]) : true));
        found.sort(([aKey, a], [bKey, b]) => orders.reduce((result, { field, direction }) => result ||
          String(field === '__name__' ? aKey : a[field]).localeCompare(String(field === '__name__' ? bKey : b[field])) * (direction === 'desc' ? -1 : 1), 0));
        const docs = found.slice(0, maximum).map(([key]) => snapshot(document(key)));
        return { docs, size: docs.length };
      } };
    return query;
  }
  const write = (source, kind, ref, value, options) => {
    if (kind === 'delete') source.delete(ref.path);
    else source.set(ref.path, options?.merge || kind === 'update' ? { ...source.get(ref.path), ...copy(value) } : copy(value));
  };
  const db = { records, doc: document, collection,
    failBatch(number) { failCommit = number; commits = 0; },
    getAll: async (...refs) => refs.map((ref) => snapshot(ref)),
    batch() {
      const writes = [];
      return { set(ref, value, options) { writes.push(['set', ref, value, options]); }, delete(ref) { writes.push(['delete', ref]); },
        async commit() { commits++; if (commits === failCommit) throw new Error('synthetic batch failure'); writes.forEach((args) => write(records, ...args)); } };
    },
    runTransaction(operation) {
      const task = queue.then(async () => {
        const source = new Map([...records].map(([key, value]) => [key, copy(value)]));
        const transaction = { get: async (ref) => ref.path && ref.get && !ref.doc ? snapshot(ref, source) : ref.get(),
          set: (ref, value, options) => write(source, 'set', ref, value, options),
          update: (ref, value) => write(source, 'update', ref, value), delete: (ref) => write(source, 'delete', ref) };
        const result = await operation(transaction);
        records.clear(); source.forEach((value, key) => records.set(key, value));
        return result;
      });
      queue = task.catch(() => {});
      return task;
    }
  };
  return db;
}
