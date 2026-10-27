import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { affectsProfiles, getActiveProfile, INDEX_KEY, LEGACY_RULES_KEY, loadProfiles, newProfile, saveProfiles, setActiveProfile, type StorageArea } from '@/challenge/profiles';
import type { Rule } from '@/challenge/types';

const run = <A>(effect: Effect.Effect<A, Error>) => Effect.runPromise(effect);

const fakeStorage = (initial: Record<string, unknown> = {}): StorageArea & { data: Record<string, unknown> } => {
  const data = structuredClone(initial);
  const keysOf = (keys?: string | string[] | null) => (keys == null ? Object.keys(data) : [keys].flat());
  return {
    data,
    get: async keys =>
      Object.fromEntries(
        keysOf(keys)
          .filter(key => key in data)
          .map(key => [key, structuredClone(data[key])])
      ),
    set: async items => void Object.assign(data, structuredClone(items)),
    remove: async keys => void keysOf(keys).forEach(key => delete data[key]),
  };
};

const rules = (value: number): Rule => ({
  condition: 'AND',
  rules: [{ id: 'rating', operator: 'greater', value, silent: false, rules: [], condition: undefined }],
  id: '',
  operator: '',
  value: '',
  silent: false,
});

describe('loadProfiles', () => {
  it('should create a default profile without any stored data and persist it', async () => {
    const storage = fakeStorage();
    const state = await run(loadProfiles(storage));

    expect(state.profiles).toHaveLength(1);
    expect(state.activeId).toBe(state.profiles[0].id);
    expect(await run(loadProfiles(storage))).toEqual(state);
    expect(storage.data[INDEX_KEY]).toBeDefined();
  });

  it('should migrate the rules from before profiles and keep the old key', async () => {
    const legacy = rules(1500);
    const storage = fakeStorage({ [LEGACY_RULES_KEY]: JSON.stringify(legacy) });
    const state = await run(loadProfiles(storage));

    expect(state.profiles).toEqual([{ id: 'default', name: 'Default', rules: legacy }]);
    expect(storage.data[LEGACY_RULES_KEY]).toBeDefined();
  });

  it('should fall back to the first profile if the active one is gone', async () => {
    const storage = fakeStorage();
    const [a, b] = [newProfile('A'), newProfile('B')];
    await run(saveProfiles(storage, { activeId: b.id, profiles: [a, b] }));
    storage.data[INDEX_KEY] = { activeId: 'missing', ids: [a.id, b.id] };

    expect(getActiveProfile(await run(loadProfiles(storage))).id).toBe(a.id);
  });
});

describe('saveProfiles', () => {
  it('should round trip profiles and order, and remove deleted ones', async () => {
    const storage = fakeStorage();
    const [a, b, c] = [newProfile('A', rules(1)), newProfile('B', rules(2)), newProfile('C', rules(3))];

    await run(saveProfiles(storage, { activeId: b.id, profiles: [a, b, c] }));
    expect(await run(loadProfiles(storage))).toEqual({ activeId: b.id, profiles: [a, b, c] });

    await run(saveProfiles(storage, { activeId: a.id, profiles: [c, a] }));
    expect(await run(loadProfiles(storage))).toEqual({ activeId: a.id, profiles: [c, a] });
    expect(Object.keys(storage.data).filter(key => key.includes(b.id))).toEqual([]);
  });
});

describe('setActiveProfile', () => {
  it('should only change the active profile', async () => {
    const storage = fakeStorage();
    const [a, b] = [newProfile('A', rules(1)), newProfile('B', rules(2))];
    await run(saveProfiles(storage, { activeId: a.id, profiles: [a, b] }));

    await run(setActiveProfile(storage, b.id));
    expect(await run(loadProfiles(storage))).toEqual({ activeId: b.id, profiles: [a, b] });

    await run(setActiveProfile(storage, 'unknown'));
    expect((await run(loadProfiles(storage))).activeId).toBe(b.id);
  });
});

describe('affectsProfiles', () => {
  it('should react to the index and to profiles only', () => {
    expect(affectsProfiles({ [INDEX_KEY]: {} })).toBe(true);
    expect(affectsProfiles({ 'lichessProfile:abc': {} })).toBe(true);
    expect(affectsProfiles({ other: {} })).toBe(false);
  });
});
