import fs from 'node:fs/promises';
import path from 'node:path';

export const statuses = ['open', 'in_progress', 'resolved'];
const seed = () => [
  { id: 'T-1001', title: 'Cannot find the class recording', student: 'Maya Chen', description: 'I checked the module page and the recording is not visible.', status: 'open', createdAt: '2026-09-25T09:00:00.000Z', updatedAt: '2026-09-25T09:00:00.000Z' },
  { id: 'T-1002', title: 'Quiz score has not updated', student: 'Omar Ali', description: 'My completed quiz still shows as pending.', status: 'in_progress', createdAt: '2026-09-26T12:15:00.000Z', updatedAt: '2026-09-27T08:30:00.000Z' },
  { id: 'T-1003', title: 'Need a new invitation link', student: 'Ava Brooks', description: 'My original course invitation has expired.', status: 'resolved', createdAt: '2026-09-22T14:45:00.000Z', updatedAt: '2026-09-23T10:00:00.000Z' }
];
export function createStore(dataDir) {
  const file = path.join(dataDir, 'tickets.json');
  let mutationQueue = Promise.resolve();
  async function read() {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (e) {
      if (e.code !== 'ENOENT') throw e;
      // A missing data file is initialized through the same queue as every write.
      return mutate(() => seed());
    }
  }
  async function write(items) {
    await fs.mkdir(dataDir, { recursive: true });
    const temporary = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(items, null, 2) + '\n', 'utf8');
    await fs.rename(temporary, file);
  }
  function mutate(change) {
    const operation = mutationQueue.then(async () => {
      let items;
      try { items = JSON.parse(await fs.readFile(file, 'utf8')); }
      catch (e) { if (e.code !== 'ENOENT') throw e; items = seed(); }
      const result = await change(items);
      await write(items);
      return result;
    });
    mutationQueue = operation.catch(() => undefined);
    return operation;
  }
  return { read, mutate, reset: () => mutate(items => { items.splice(0, items.length, ...seed()); return items; }) };
}
