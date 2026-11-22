import { Effect, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  defaultRules,
  exportProfiles,
  FORMAT_VERSION,
  getActiveProfile,
  INDEX_KEY,
  LEGACY_RULES_KEY,
  loadProfiles,
  newProfile,
  OLD_INDEX_KEY,
  oldProfileKey,
  parseImport,
  saveProfiles,
} from '@/challenge/profiles';
import type { RuleGroup, RuleNode } from '@/challenge/types';
import { fakeStorage } from './helpers';

const run = <A>(effect: Effect.Effect<A, Error>) => Effect.runPromise(effect);

const rules = (value: number): RuleGroup => ({ combinator: 'AND', children: [{ field: 'rating', relation: 'greater', value, silent: false }] });

/** The same tree as `rules`, written the way versions before the rename stored it. */
const oldRules = (value: number) => ({
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
    const legacy = JSON.stringify(oldRules(1500));
    const storage = fakeStorage({ [LEGACY_RULES_KEY]: legacy });
    const state = await run(loadProfiles(storage));

    expect(state.profiles).toEqual([{ id: 'default', name: 'Default', ruleTree: rules(1500) }]);
    expect(storage.data[LEGACY_RULES_KEY]).toBe(legacy);
  });

  it('should fall back to the first profile if the active one is gone', async () => {
    const storage = fakeStorage();
    const [a, b] = [newProfile('A'), newProfile('B')];
    await run(saveProfiles(storage, { activeId: b.id, profiles: [a, b] }));
    storage.data[INDEX_KEY] = { version: FORMAT_VERSION, activeId: 'missing', ids: [a.id, b.id] };

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

    expect(state.profiles[0].ruleTree).toEqual({
      combinator: 'OR',
      children: [
        { field: 'rating', relation: 'greater', value: 2000, silent: false },
        { combinator: 'AND', children: [{ field: 'team-name', relation: 'equal', value: 'x', silent: true }] },
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
    expect(state.profiles[0].ruleTree).toEqual(defaultRules());
  });
});

describe('export and import', () => {
  it('should round trip profiles with new ids', () => {
    const profiles = [newProfile('Bullet', rules(1)), newProfile('Correspondence', rules(2))];
    const imported = Option.getOrThrow(parseImport(exportProfiles(profiles)));

    expect(imported.map(({ name, ruleTree }) => ({ name, ruleTree }))).toEqual(profiles.map(({ name, ruleTree }) => ({ name, ruleTree })));
    expect(imported.every((profile, index) => profile.id !== profiles[index].id)).toBe(true);
  });

  it('should reject anything that is not an export', () => {
    for (const text of ['', 'not json', '{}', '[]', '{"format":"other","version":1,"profiles":[]}']) {
      expect(Option.isNone(parseImport(text))).toBe(true);
    }
    expect(Option.isNone(parseImport(exportProfiles([])))).toBe(true);
    expect(Option.isNone(parseImport(JSON.stringify({ format: 'lichess-conditional-challenge-profiles', version: 1, profiles: [{ name: 'x', rules: { rules: 5 } }] })))).toBe(true);
  });

  it('should complete rules of an export of version 1 and name blank profiles', () => {
    const text = JSON.stringify({
      format: 'lichess-conditional-challenge-profiles',
      version: 1,
      profiles: [{ name: ' ', rules: { condition: 'AND', rules: [{ id: 'rating', operator: 'greater', value: 1 }] } }],
    });
    const [profile] = Option.getOrThrow(parseImport(text));

    expect(profile.name).toBe('Profile');
    expect(profile.ruleTree).toEqual({ combinator: 'AND', children: [{ field: 'rating', relation: 'greater', value: 1, silent: false }] });
  });
});

describe('profiles saved by version 2.x (before the rename)', () => {
  const oldStorage = () =>
    fakeStorage({
      [OLD_INDEX_KEY]: { activeId: 'b', ids: ['a', 'b'] },
      [oldProfileKey('a')]: { id: 'a', name: 'A', rules: oldRules(1000) },
      [oldProfileKey('b')]: { id: 'b', name: 'B', rules: oldRules(2000) },
      [LEGACY_RULES_KEY]: JSON.stringify(oldRules(1)),
    });

  it('should be migrated with their ids, names, order and active profile', async () => {
    const state = await run(loadProfiles(oldStorage()));

    expect(state).toEqual({
      activeId: 'b',
      profiles: [
        { id: 'a', name: 'A', ruleTree: rules(1000) },
        { id: 'b', name: 'B', ruleTree: rules(2000) },
      ],
    });
  });

  it('should store the migrated profiles in the current format, versioned, and never touch the old keys', async () => {
    const storage = oldStorage();
    const before = structuredClone(storage.data);
    await run(loadProfiles(storage));

    expect(storage.data[INDEX_KEY]).toEqual({ version: FORMAT_VERSION, activeId: 'b', ids: ['a', 'b'] });
    expect(storage.data['lichessProfile2:a']).toEqual({ version: FORMAT_VERSION, id: 'a', name: 'A', ruleTree: rules(1000) });
    expect(Object.fromEntries(Object.entries(storage.data).filter(([key]) => key in before))).toEqual(before);
  });

  it('should keep the old keys untouched when profiles are edited and deleted afterwards', async () => {
    const storage = oldStorage();
    const before = structuredClone(storage.data);
    const state = await run(loadProfiles(storage));
    await run(saveProfiles(storage, { activeId: 'a', profiles: [{ ...state.profiles[0], name: 'Renamed' }] }));

    expect(Object.fromEntries(Object.entries(storage.data).filter(([key]) => key in before))).toEqual(before);
    expect((await run(loadProfiles(storage))).profiles.map(p => p.name)).toEqual(['Renamed']);
  });

  it('should prefer profiles of the current format over the old ones', async () => {
    const storage = oldStorage();
    const mine = newProfile('Mine', rules(5));
    await run(saveProfiles(storage, { activeId: mine.id, profiles: [mine] }));

    expect(await run(loadProfiles(storage))).toEqual({ activeId: mine.id, profiles: [mine] });
  });

  it('should skip old profiles that are broken and use the legacy rules if none is left', async () => {
    const storage = fakeStorage({ [OLD_INDEX_KEY]: { activeId: 'a', ids: ['a'] }, [oldProfileKey('a')]: { id: 'a', rules: 5 }, [LEGACY_RULES_KEY]: JSON.stringify(oldRules(7)) });

    expect((await run(loadProfiles(storage))).profiles).toEqual([{ id: 'default', name: 'Default', ruleTree: rules(7) }]);
  });

  it('should not read a stored profile of the current format that is broken', async () => {
    const storage = fakeStorage({
      [INDEX_KEY]: { version: FORMAT_VERSION, activeId: 'a', ids: ['a'] },
      'lichessProfile2:a': { version: FORMAT_VERSION, id: 'a', name: 'A', ruleTree: { combinator: 'XOR' } },
    });

    expect((await run(loadProfiles(storage))).profiles).toEqual([{ id: 'default', name: 'Default', ruleTree: defaultRules() }]);
  });
});

describe('export of version 2', () => {
  it('should be written with the current format version and the new rule shape', () => {
    const document = JSON.parse(exportProfiles([newProfile('A', rules(1))]));

    expect(document).toEqual({ format: 'lichess-conditional-challenge-profiles', version: 2, profiles: [{ name: 'A', ruleTree: rules(1) }] });
  });

  it('should import an export of version 1 like one of version 2', () => {
    const v1 = JSON.stringify({ format: 'lichess-conditional-challenge-profiles', version: 1, profiles: [{ name: 'A', rules: oldRules(1) }] });
    const v2 = JSON.stringify({ format: 'lichess-conditional-challenge-profiles', version: 2, profiles: [{ name: 'A', ruleTree: rules(1) }] });
    const trees = (text: string) => Option.getOrThrow(parseImport(text)).map((profile): RuleNode => profile.ruleTree);

    expect(trees(v1)).toEqual(trees(v2));
  });

  it('should reject a version it does not know', () => {
    expect(Option.isNone(parseImport(JSON.stringify({ format: 'lichess-conditional-challenge-profiles', version: 3, profiles: [{ name: 'A', ruleTree: rules(1) }] })))).toBe(true);
  });
});
