import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { makeProfileStore, type StorageChanges } from '@/challenge/profile-store';
import { INDEX_KEY, newProfile } from '@/challenge/profiles';
import type { RuleNode } from '@/challenge/types';
import { fakeStorage } from './helpers';

const run = <A>(effect: Effect.Effect<A, Error>) => Effect.runPromise(effect);

const rules = (value: number): RuleNode => ({ combinator: 'AND', children: [{ field: 'rating', relation: 'greater', value, silent: false }] });

/** Two pages (like the options page and a lichess tab) that share one storage. */
const twoPages = () => {
  const storage = fakeStorage();
  const [a, b] = [newProfile('A', rules(1)), newProfile('B', rules(2))];
  return { storage, options: makeProfileStore(storage), lichess: makeProfileStore(storage), a, b };
};

describe('save', () => {
  it('should store the edits and return what was stored', async () => {
    const { options, a, b } = twoPages();
    await run(options.load);

    const saved = await run(options.save({ activeId: b.id, profiles: [a, b] }));

    expect(saved).toEqual({ activeId: b.id, profiles: [a, b] });
    expect(await run(options.load)).toEqual(saved);
  });

  it('should keep a profile that was switched on lichess in the meantime', async () => {
    const { options, lichess, a, b } = twoPages();
    await run(options.load);
    await run(options.save({ activeId: a.id, profiles: [a, b] }));
    await run(lichess.load);
    await run(options.load);

    await run(lichess.setActive(b.id));
    const saved = await run(options.save({ activeId: a.id, profiles: [a, { ...b, name: 'Edited' }] }));

    expect(saved.activeId).toBe(b.id);
    expect(saved.profiles[1].name).toBe('Edited');
  });

  it('should prefer a profile that was chosen on the page itself', async () => {
    const { options, lichess, a, b } = twoPages();
    await run(options.save({ activeId: a.id, profiles: [a, b] }));
    await run(options.load);

    await run(lichess.setActive(b.id));
    const saved = await run(options.save({ activeId: a.id, profiles: [a, b] }));

    expect(saved.activeId).toBe(b.id);
    const chosen = await run(options.save({ activeId: a.id, profiles: [a, b] }));
    expect(chosen.activeId).toBe(a.id);
  });

  it('should ignore a stored active profile that does not exist any more', async () => {
    const { options, lichess, a, b } = twoPages();
    await run(options.save({ activeId: b.id, profiles: [a, b] }));
    await run(options.load);

    await run(lichess.setActive(b.id));
    const saved = await run(options.save({ activeId: a.id, profiles: [a] }));

    expect(saved.activeId).toBe(a.id);
  });
});

describe('setActive', () => {
  it('should only write the index, and ignore unknown profiles', async () => {
    const { storage, options, a, b } = twoPages();
    await run(options.save({ activeId: a.id, profiles: [a, b] }));
    const set = vi.spyOn(storage, 'set');

    await run(options.setActive(b.id));
    expect(set).toHaveBeenCalledTimes(1);
    expect(Object.keys(set.mock.calls[0][0])).toEqual([INDEX_KEY]);

    await run(options.setActive('unknown'));
    expect((await run(options.load)).activeId).toBe(b.id);
  });
});

describe('activeRuleTree', () => {
  it('should be the rule tree of the active profile', async () => {
    const { options, a, b } = twoPages();
    await run(options.save({ activeId: b.id, profiles: [a, b] }));

    await expect(run(options.activeRuleTree)).resolves.toEqual(rules(2));
  });
});

describe('subscribe', () => {
  const events = () => {
    const listeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
    const changes: StorageChanges = { addListener: listener => void listeners.add(listener), removeListener: listener => void listeners.delete(listener) };
    return { changes, emit: (keys: string[], area = 'sync') => listeners.forEach(listener => listener(Object.fromEntries(keys.map(key => [key, {}])), area)), listeners };
  };

  it('should react to changes of the profiles in the synced storage only', () => {
    const { changes, emit } = events();
    const onChange = vi.fn();
    makeProfileStore(fakeStorage(), changes).subscribe(onChange);

    emit([INDEX_KEY]);
    emit(['lichessProfile2:abc']);
    expect(onChange).toHaveBeenCalledTimes(2);

    emit(['other']);
    emit(['lichessProfile:abc']);
    emit([INDEX_KEY], 'local');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('should stop when unsubscribed', () => {
    const { changes, emit, listeners } = events();
    const onChange = vi.fn();
    const unsubscribe = makeProfileStore(fakeStorage(), changes).subscribe(onChange);

    unsubscribe();
    emit([INDEX_KEY]);

    expect(onChange).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});
