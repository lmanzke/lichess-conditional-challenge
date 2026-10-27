import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import {
  affectsProfiles,
  defaultRules,
  getActiveProfile,
  INDEX_KEY,
  LEGACY_RULES_KEY,
  loadProfiles,
  newProfile,
  saveProfiles,
  setActiveProfile,
  type StorageArea,
} from '@/challenge/profiles';
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

describe('rules saved by version 1.x', () => {
  // jQuery QueryBuilder wrote groups without id/operator/value/silent and single rules without `rules`.
  const legacyRules = {
    condition: 'OR',
    rules: [
      { id: 'rating', field: 'rating', type: 'integer', input: 'text', operator: 'greater', value: 2000, silent: false },
      { condition: 'AND', rules: [{ id: 'team-name', operator: 'equal', value: 'x', silent: true }] },
    ],
    valid: true,
  };

  it('should be migrated into a complete rule tree', async () => {
    const state = await Effect.runPromise(loadProfiles(fakeStorage({ [LEGACY_RULES_KEY]: JSON.stringify(legacyRules) })));

    expect(state.profiles[0].rules).toEqual({
      condition: 'OR',
      id: '',
      operator: '',
      value: '',
      silent: false,
      rules: [
        { id: 'rating', operator: 'greater', value: 2000, silent: false, rules: [], condition: undefined },
        {
          condition: 'AND',
          id: '',
          operator: '',
          value: '',
          silent: false,
          rules: [{ id: 'team-name', operator: 'equal', value: 'x', silent: true, rules: [], condition: undefined }],
        },
      ],
    });
  });

  it('should keep later edits instead of migrating again on the next load', async () => {
    const storage = fakeStorage({ [LEGACY_RULES_KEY]: JSON.stringify(legacyRules) });
    const first = await Effect.runPromise(loadProfiles(storage));
    await Effect.runPromise(saveProfiles(storage, { ...first, profiles: [{ ...first.profiles[0], name: 'Edited' }] }));

    expect((await Effect.runPromise(loadProfiles(storage))).profiles.map(p => p.name)).toEqual(['Edited']);
  });

  it('should fall back to the default rules if the old rules are garbage', async () => {
    const state = await Effect.runPromise(loadProfiles(fakeStorage({ [LEGACY_RULES_KEY]: '{"rules": 5' })));
    expect(state.profiles[0].rules).toEqual(defaultRules());
  });
});

describe('setActiveProfile writes', () => {
  it('should only write the index', async () => {
    const storage = fakeStorage();
    const [a, b] = [newProfile('A'), newProfile('B')];
    await Effect.runPromise(saveProfiles(storage, { activeId: a.id, profiles: [a, b] }));
    const set = vi.spyOn(storage, 'set');

    await Effect.runPromise(setActiveProfile(storage, b.id));
    expect(set).toHaveBeenCalledTimes(1);
    expect(Object.keys(set.mock.calls[0][0])).toEqual([INDEX_KEY]);
  });
});
