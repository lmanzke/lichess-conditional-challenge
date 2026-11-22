import { Effect } from 'effect';
import { affectsProfiles, getActiveProfile, loadProfiles, resolveActiveId, saveProfiles, setActiveProfile, type ProfileState, type StorageArea } from '@/challenge/profiles';
import type { RuleNode } from '@/challenge/types';

/** The change events of the storage, as `chrome.storage.onChanged` has them. */
export interface StorageChanges {
  addListener(listener: (changes: Record<string, unknown>, areaName: string) => void): void;
  removeListener(listener: (changes: Record<string, unknown>, areaName: string) => void): void;
}

/**
 * The profiles of the player, kept in storage that is shared by the options page, every lichess tab and every device.
 * A store belongs to one page: it remembers which profile was active when the page last read or wrote the profiles.
 */
export interface ProfileStore {
  load: Effect.Effect<ProfileState, Error>;
  /** The rule tree of the active profile. */
  activeRuleTree: Effect.Effect<RuleNode, Error>;
  /**
   * Stores profiles that were edited on this page, and returns what was stored. The active profile can be switched on lichess while the
   * page is open, which is kept unless it was changed on this page too.
   */
  save(edited: ProfileState): Effect.Effect<ProfileState, Error>;
  /** Switches the active profile. Only writes that, so it neither touches edits made elsewhere nor uses up sync write quota. */
  setActive(id: string): Effect.Effect<void, Error>;
  /** Calls `onChange` whenever the profiles were changed elsewhere. Returns how to stop. */
  subscribe(onChange: () => void): () => void;
}

export const makeProfileStore = (area: StorageArea, changes?: StorageChanges, areaName = 'sync'): ProfileStore => {
  let loadedActiveId = '';

  const load = loadProfiles(area).pipe(Effect.tap(state => Effect.sync(() => void (loadedActiveId = state.activeId))));

  return {
    load,
    activeRuleTree: Effect.map(loadProfiles(area), state => getActiveProfile(state).ruleTree),
    save: edited =>
      Effect.gen(function* () {
        const stored = yield* loadProfiles(area);
        const activeId = resolveActiveId({ loaded: loadedActiveId, local: edited.activeId, stored: stored.activeId, ids: edited.profiles.map(profile => profile.id) });
        const state = { ...edited, activeId };

        yield* saveProfiles(area, state);
        loadedActiveId = activeId;
        return state;
      }),
    setActive: id => setActiveProfile(area, id),
    subscribe: onChange => {
      const listener = (changed: Record<string, unknown>, changedArea: string) => {
        if (changedArea === areaName && affectsProfiles(changed)) onChange();
      };
      changes?.addListener(listener);
      return () => changes?.removeListener(listener);
    },
  };
};

/** The store of the browser's synced storage. Made when needed, as the `chrome` object only exists inside the extension. */
export const chromeProfileStore = (): ProfileStore => makeProfileStore(chrome.storage.sync, chrome.storage.onChanged);
