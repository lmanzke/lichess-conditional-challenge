import type { Rule } from '@/challenge/types';

/** An independent, named set of rules. Exactly one profile is active, that is the one used on lichess. */
export interface Profile {
  id: string;
  name: string;
  rules: Rule;
}

export interface ProfileState {
  activeId: string;
  profiles: Profile[];
}

/** The subset of `chrome.storage.StorageArea` that is needed here. */
export interface StorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

interface ProfileIndex {
  activeId: string;
  ids: string[];
}

/** Before profiles existed, the rules were a single JSON string under this key. */
export const LEGACY_RULES_KEY = 'lichessTeamRules';
export const INDEX_KEY = 'lichessProfiles';
const profileKey = (id: string) => `lichessProfile:${id}`;

export const defaultRules = (): Rule => ({
  condition: 'AND',
  rules: [{ id: 'rating', operator: 'greater', value: 0, silent: false, rules: [], condition: undefined }],
  id: '',
  operator: '',
  value: '',
  silent: false,
});

export const newProfile = (name: string, rules: Rule = defaultRules()): Profile => ({ id: crypto.randomUUID(), name, rules });

const parseLegacyRules = (raw: unknown): Rule | undefined => {
  if (typeof raw !== 'string' || raw === '') return undefined;
  try {
    return JSON.parse(raw) as Rule;
  } catch {
    return undefined;
  }
};

const isProfile = (value: unknown): value is Profile => typeof value === 'object' && value !== null && 'id' in value && 'name' in value && 'rules' in value;

/**
 * Reads all profiles. Without any stored profiles, the rules from before profiles existed become the
 * first one and are stored as such (the legacy key is left untouched). There is always at least one profile and the active id always exists.
 */
export const loadProfiles = async (area: StorageArea): Promise<ProfileState> => {
  const stored = await area.get([INDEX_KEY, LEGACY_RULES_KEY]);
  const index = stored[INDEX_KEY] as ProfileIndex | undefined;
  const ids = index?.ids ?? [];
  const items = ids.length > 0 ? await area.get(ids.map(profileKey)) : {};
  const profiles = ids.map(id => items[profileKey(id)]).filter(isProfile);

  if (profiles.length === 0) {
    // A fixed id, so concurrent migrations (options page and lichess tab) end up with the same profile.
    const state = { activeId: 'default', profiles: [{ id: 'default', name: 'Default', rules: parseLegacyRules(stored[LEGACY_RULES_KEY]) ?? defaultRules() }] };
    await saveProfiles(area, state);
    return state;
  }

  return { activeId: profiles.some(p => p.id === index?.activeId) ? (index as ProfileIndex).activeId : profiles[0].id, profiles };
};

/** Persists the state. Every profile is a separate item, as chrome.storage.sync limits the size of a single item. */
export const saveProfiles = async (area: StorageArea, state: ProfileState): Promise<void> => {
  const previous = (await area.get(INDEX_KEY))[INDEX_KEY] as ProfileIndex | undefined;
  const removed = (previous?.ids ?? []).filter(id => !state.profiles.some(p => p.id === id));
  const index: ProfileIndex = { activeId: state.activeId, ids: state.profiles.map(p => p.id) };

  await area.set({ [INDEX_KEY]: index, ...Object.fromEntries(state.profiles.map(p => [profileKey(p.id), p])) });
  if (removed.length > 0) {
    await area.remove(removed.map(profileKey));
  }
};

/** Switches the active profile without touching the profiles themselves, so it cannot overwrite edits made elsewhere. */
export const setActiveProfile = async (area: StorageArea, id: string): Promise<void> => {
  const state = await loadProfiles(area);
  if (state.profiles.some(p => p.id === id)) {
    await saveProfiles(area, { ...state, activeId: id });
  }
};

export const getActiveProfile = (state: ProfileState): Profile => state.profiles.find(p => p.id === state.activeId) ?? state.profiles[0];

/** True if the change event of the sync storage affects the profiles. */
export const affectsProfiles = (changes: Record<string, unknown>): boolean => Object.keys(changes).some(key => key === INDEX_KEY || key.startsWith('lichessProfile:'));
