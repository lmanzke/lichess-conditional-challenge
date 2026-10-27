import type { Rule } from '@/challenge/types';
import { Array, Effect, Option, Record, Schema } from 'effect';
import { ensureNonEmptyArray } from './utils';

export interface ProfileState {
  readonly activeId: string;
  readonly profiles: ReadonlyArray<Profile>;
}

/** The subset of `chrome.storage.StorageArea` that is needed here. */
export interface StorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

const ProfileIndexSchema = Schema.Struct({ activeId: Schema.String, ids: Schema.mutable(Schema.Array(Schema.String)) });
type ProfileIndex = typeof ProfileIndexSchema.Type;

const RuleValueSchema = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.mutable(Schema.Array(Schema.String)), Schema.mutable(Schema.Array(Schema.Number))]);

const RuleSchema: Schema.Codec<Rule> = Schema.Struct({
  // JSON drops `undefined`, so the key is missing in stored rules without a condition.
  condition: Schema.optional(Schema.String),
  rules: Schema.Array(Schema.suspend((): Schema.Codec<Rule> => RuleSchema)),
  id: Schema.String,
  value: RuleValueSchema,
  operator: Schema.String,
  silent: Schema.Boolean,
});

const ProfileSchema = Schema.Struct({ id: Schema.String, name: Schema.String, rules: RuleSchema });

/** An independent, named set of rules. Exactly one profile is active, that is the one used on lichess. */
export type Profile = typeof ProfileSchema.Type;

const decodeIndex = Schema.decodeUnknownOption(ProfileIndexSchema);
const decodeProfile = Schema.decodeUnknownOption(ProfileSchema);

/** Reads the profile index from raw storage contents. Malformed data counts as missing. */
const readIndex = (stored: Record<string, unknown>): Option.Option<ProfileIndex> => Record.get(stored, INDEX_KEY).pipe(Option.flatMap(decodeIndex));

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

const storageEffect = <A>(run: () => Promise<A>): Effect.Effect<A, Error> =>
  Effect.tryPromise({
    try: run,
    catch: cause => new Error(`storage access failed: ${String(cause)}`),
  });

/**
 * Reads all profiles. Without any stored profiles, the rules from before profiles existed become the
 * first one and are stored as such (the legacy key is left untouched). There is always at least one profile and the active id always exists.
 */
export const loadProfiles = (area: StorageArea): Effect.Effect<ProfileState, Error> =>
  Effect.gen(function* () {
    const stored = yield* storageEffect(() => area.get([INDEX_KEY, LEGACY_RULES_KEY]));
    const index = readIndex(stored);
    const ids = index.pipe(
      Option.map(i => i.ids),
      Option.flatMap(ensureNonEmptyArray)
    );

    // Lift the optional ids into the effect that reads the profile items.
    const items = yield* Option.match(ids, {
      onNone: () => Effect.succeed<Record<string, unknown>>({}),
      onSome: ids => storageEffect(() => area.get(ids.map(profileKey))),
    });
    const profiles = ids.pipe(
      Option.map(ids => Array.getSomes(ids.map(id => decodeProfile(items[profileKey(id)])))),
      Option.getOrElse((): Profile[] => [])
    );

    if (!Array.isArrayNonEmpty(profiles)) {
      // A fixed id, so concurrent migrations (options page and lichess tab) end up with the same profile.
      const state: ProfileState = { activeId: 'default', profiles: [{ id: 'default', name: 'Default', rules: parseLegacyRules(stored[LEGACY_RULES_KEY]) ?? defaultRules() }] };
      yield* saveProfiles(area, state);
      return state;
    }

    const activeId = index.pipe(
      Option.map(i => i.activeId),
      Option.filter(id => profiles.some(p => p.id === id)),
      Option.getOrElse(() => profiles[0].id)
    );
    return { activeId, profiles };
  });

/** Persists the state. Every profile is a separate item, as chrome.storage.sync limits the size of a single item. */
export const saveProfiles = (area: StorageArea, state: ProfileState): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const previous = readIndex(yield* storageEffect(() => area.get(INDEX_KEY)));
    const removed = previous.pipe(
      Option.map(i => i.ids.filter(id => !state.profiles.some(p => p.id === id))),
      Option.getOrElse(() => [] as string[])
    );
    const index: ProfileIndex = { activeId: state.activeId, ids: state.profiles.map(p => p.id) };

    yield* storageEffect(() => area.set({ [INDEX_KEY]: index, ...Object.fromEntries(state.profiles.map(p => [profileKey(p.id), p])) }));
    if (removed.length > 0) {
      yield* storageEffect(() => area.remove(removed.map(profileKey)));
    }
  });

/** Switches the active profile without touching the profiles themselves, so it cannot overwrite edits made elsewhere. */
export const setActiveProfile = (area: StorageArea, id: string): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const state = yield* loadProfiles(area);
    if (state.profiles.some(p => p.id === id)) {
      yield* saveProfiles(area, { ...state, activeId: id });
    }
  });

export const getActiveProfile = (state: ProfileState): Profile => state.profiles.find(p => p.id === state.activeId) ?? state.profiles[0];

/** True if the change event of the sync storage affects the profiles. */
export const affectsProfiles = (changes: Record<string, unknown>): boolean => Object.keys(changes).some(key => key === INDEX_KEY || key.startsWith('lichessProfile:'));
