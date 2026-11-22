import type { Combinator, RuleNode, RuleValue } from '@/challenge/types';
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

/** The version of the format that is written. Everything older is read through `migrateStoredNode`. */
export const FORMAT_VERSION = 2;

const RuleValueSchema = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.mutable(Schema.Array(Schema.String)), Schema.mutable(Schema.Array(Schema.Number))]);

// The current format (version 2): a tree of rule groups and rules.
const StoredRuleSchema = Schema.Struct({ field: Schema.String, relation: Schema.String, value: RuleValueSchema, silent: Schema.Boolean });
const StoredGroupSchema = Schema.Struct({
  combinator: Schema.Literals(['AND', 'OR']),
  children: Schema.Array(Schema.suspend((): Schema.Codec<RuleNode> => StoredNodeSchema)),
});
const StoredNodeSchema: Schema.Codec<RuleNode> = Schema.Union([StoredGroupSchema, StoredRuleSchema]);

/**
 * Rules as the versions before the rename stored them (the jQuery QueryBuilder shape of 1.x, kept in 2.x). Groups and rules are the same
 * object: a group has a `condition`, `rules` and none of the rest, a rule has no `rules`. Everything is optional, as 1.x did not write all of it.
 */
interface OldStoredRule {
  readonly condition?: string;
  readonly rules?: ReadonlyArray<OldStoredRule>;
  readonly id?: string;
  readonly value?: RuleValue;
  readonly operator?: string;
  readonly silent?: boolean;
}

const OldStoredRuleSchema: Schema.Codec<OldStoredRule> = Schema.Struct({
  // JSON drops `undefined`, so the key is missing in stored rules without a condition.
  condition: Schema.optional(Schema.String),
  rules: Schema.optional(Schema.Array(Schema.suspend((): Schema.Codec<OldStoredRule> => OldStoredRuleSchema))),
  id: Schema.optional(Schema.String),
  value: Schema.optional(RuleValueSchema),
  operator: Schema.optional(Schema.String),
  silent: Schema.optional(Schema.Boolean),
});

/** Anything that is not 'AND' was an 'OR' before, as that is how the rules were evaluated. */
const toCombinator = (condition: string): Combinator => (condition === 'AND' ? 'AND' : 'OR');

/** Reads the shape of versions 0 (1.x, a JSON string) and 1 (2.x profiles) as a current rule tree. */
export const migrateStoredNode = (stored: OldStoredRule): RuleNode =>
  stored.condition !== undefined
    ? { combinator: toCombinator(stored.condition), children: (stored.rules ?? []).map(migrateStoredNode) }
    : { field: stored.id ?? '', relation: stored.operator ?? '', value: stored.value ?? '', silent: stored.silent ?? false };

/** An independent, named set of rules. Exactly one profile is active, that is the one used on lichess. */
export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly ruleTree: RuleNode;
}

// What is stored for a profile: the current format carries its version, the old one does not have any.
const StoredProfileSchema = Schema.Struct({ version: Schema.Literal(FORMAT_VERSION), id: Schema.String, name: Schema.String, ruleTree: StoredNodeSchema });
const OldStoredProfileSchema = Schema.Struct({ id: Schema.String, name: Schema.String, rules: OldStoredRuleSchema });

const decodeOldStoredRule = Schema.decodeUnknownOption(OldStoredRuleSchema);
const decodeStoredProfile = Schema.decodeUnknownOption(StoredProfileSchema);
const decodeOldStoredProfile = Schema.decodeUnknownOption(OldStoredProfileSchema);

const ProfileIndexSchema = Schema.Struct({ version: Schema.Literal(FORMAT_VERSION), activeId: Schema.String, ids: Schema.mutable(Schema.Array(Schema.String)) });
type ProfileIndex = typeof ProfileIndexSchema.Type;
const OldProfileIndexSchema = Schema.Struct({ activeId: Schema.String, ids: Schema.mutable(Schema.Array(Schema.String)) });

const decodeProfile = (raw: unknown): Option.Option<Profile> => decodeStoredProfile(raw).pipe(Option.map(({ id, name, ruleTree }) => ({ id, name, ruleTree })));
const decodeOldProfile = (raw: unknown): Option.Option<Profile> =>
  decodeOldStoredProfile(raw).pipe(Option.map(({ id, name, rules }) => ({ id, name, ruleTree: migrateStoredNode(rules) })));

const decodeIndex = Schema.decodeUnknownOption(ProfileIndexSchema);
const decodeOldIndex = Schema.decodeUnknownOption(OldProfileIndexSchema);

/** Reads the profile index from raw storage contents. Malformed data counts as missing. */
const readIndex = (stored: Record<string, unknown>): Option.Option<ProfileIndex> => Record.get(stored, INDEX_KEY).pipe(Option.flatMap(decodeIndex));
const readOldIndex = (stored: Record<string, unknown>) => Record.get(stored, OLD_INDEX_KEY).pipe(Option.flatMap(decodeOldIndex));

// The export is versioned like the storage. Version 1 holds rules in the old shape, version 2 rule trees.
const EXPORT_FORMAT = 'lichess-conditional-challenge-profiles';
const ExportV1Schema = Schema.Struct({
  format: Schema.Literal(EXPORT_FORMAT),
  version: Schema.Literal(1),
  profiles: Schema.Array(Schema.Struct({ name: Schema.String, rules: OldStoredRuleSchema })),
});
const ExportV2Schema = Schema.Struct({
  format: Schema.Literal(EXPORT_FORMAT),
  version: Schema.Literal(2),
  profiles: Schema.Array(Schema.Struct({ name: Schema.String, ruleTree: StoredNodeSchema })),
});
const decodeExportV1 = Schema.decodeUnknownOption(ExportV1Schema);
const decodeExportV2 = Schema.decodeUnknownOption(ExportV2Schema);

/** The profiles as a JSON document for backups or sharing. */
export const exportProfiles = (profiles: ReadonlyArray<Profile>): string =>
  JSON.stringify({ format: EXPORT_FORMAT, version: 2, profiles: profiles.map(({ name, ruleTree }) => ({ name, ruleTree })) }, null, 2);

/** Reads a document made by `exportProfiles` (of any version) as new profiles (with new ids). Anything else is `None`. */
export const parseImport = (text: string): Option.Option<ReadonlyArray<Profile>> => {
  try {
    const json: unknown = JSON.parse(text);
    const entries = decodeExportV2(json).pipe(
      Option.map(document => document.profiles.map(({ name, ruleTree }) => ({ name, ruleTree }))),
      Option.orElse(() => decodeExportV1(json).pipe(Option.map(document => document.profiles.map(({ name, rules }) => ({ name, ruleTree: migrateStoredNode(rules) }))))),
      Option.filter(profiles => profiles.length > 0)
    );
    return entries.pipe(Option.map(profiles => profiles.map(({ name, ruleTree }) => newProfile(name.trim() || 'Profile', ruleTree))));
  } catch {
    return Option.none();
  }
};

/** Before profiles existed, the rules were a single JSON string under this key (version 0). */
export const LEGACY_RULES_KEY = 'lichessTeamRules';
/** Profiles of version 1 (2.x, before the rename). They are only read, never written, so that devices that did not update yet keep working. */
export const OLD_INDEX_KEY = 'lichessProfiles';
export const oldProfileKey = (id: string) => `lichessProfile:${id}`;
/** The current format has keys of its own, as an older reader would take new rules for broken ones and replace them. */
export const INDEX_KEY = 'lichessProfiles2';
const PROFILE_KEY_PREFIX = 'lichessProfile2:';
const profileKey = (id: string) => `${PROFILE_KEY_PREFIX}${id}`;

export const defaultRules = (): RuleNode => ({ combinator: 'AND', children: [{ field: 'rating', relation: 'greater', value: 100, silent: false }] });

export const newProfile = (name: string, ruleTree: RuleNode = defaultRules()): Profile => ({ id: crypto.randomUUID(), name, ruleTree });

const parseLegacyRules = (raw: unknown): RuleNode | undefined => {
  if (typeof raw !== 'string' || raw === '') return undefined;
  try {
    return decodeOldStoredRule(JSON.parse(raw)).pipe(Option.map(migrateStoredNode), Option.getOrUndefined);
  } catch {
    return undefined;
  }
};

const storageEffect = <A>(run: () => Promise<A>): Effect.Effect<A, Error> =>
  Effect.tryPromise({
    try: run,
    catch: cause => new Error(`storage access failed: ${String(cause)}`),
  });

/** The profiles of the versions 1 and 0, as far as they can be read. Nothing is written to the old keys. */
const readOldProfiles = (area: StorageArea, stored: Record<string, unknown>): Effect.Effect<ProfileState, Error> =>
  Effect.gen(function* () {
    const index = readOldIndex(stored);
    const ids = index.pipe(
      Option.map(i => i.ids),
      Option.flatMap(ensureNonEmptyArray)
    );
    const items = yield* Option.match(ids, {
      onNone: () => Effect.succeed<Record<string, unknown>>({}),
      onSome: ids => storageEffect(() => area.get(ids.map(oldProfileKey))),
    });
    const profiles = ids.pipe(
      Option.map(ids => Array.getSomes(ids.map(id => decodeOldProfile(items[oldProfileKey(id)])))),
      Option.getOrElse((): Profile[] => [])
    );

    if (!Array.isArrayNonEmpty(profiles)) {
      // A fixed id, so concurrent migrations (options page and lichess tab) end up with the same profile.
      return { activeId: 'default', profiles: [{ id: 'default', name: 'Default', ruleTree: parseLegacyRules(stored[LEGACY_RULES_KEY]) ?? defaultRules() }] };
    }

    const activeId = index.pipe(
      Option.map(i => i.activeId),
      Option.filter(id => profiles.some(p => p.id === id)),
      Option.getOrElse(() => profiles[0].id)
    );
    return { activeId, profiles };
  });

/**
 * Reads all profiles. Without any profile of the current format, the older ones (or the rules from before profiles existed) are
 * converted and stored as such. The older keys are left untouched. There is always at least one profile and the active id always exists.
 */
export const loadProfiles = (area: StorageArea): Effect.Effect<ProfileState, Error> =>
  Effect.gen(function* () {
    const stored = yield* storageEffect(() => area.get([INDEX_KEY, OLD_INDEX_KEY, LEGACY_RULES_KEY]));
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
      const state = yield* readOldProfiles(area, stored);
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
    const index: ProfileIndex = { version: FORMAT_VERSION, activeId: state.activeId, ids: state.profiles.map(p => p.id) };

    yield* storageEffect(() =>
      area.set({
        [INDEX_KEY]: index,
        ...Object.fromEntries(state.profiles.map(p => [profileKey(p.id), { version: FORMAT_VERSION, id: p.id, name: p.name, ruleTree: p.ruleTree }])),
      })
    );
    if (removed.length > 0) {
      yield* storageEffect(() => area.remove(removed.map(profileKey)));
    }
  });

/**
 * Switches the active profile by only writing the index (not the profiles), so it neither touches edits made
 * elsewhere nor uses up sync write quota.
 */
export const setActiveProfile = (area: StorageArea, id: string): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const state = yield* loadProfiles(area);
    if (state.profiles.some(p => p.id === id)) {
      yield* storageEffect(() => area.set({ [INDEX_KEY]: { version: FORMAT_VERSION, activeId: id, ids: state.profiles.map(p => p.id) } satisfies ProfileIndex }));
    }
  });

export const getActiveProfile = (state: ProfileState): Profile => state.profiles.find(p => p.id === state.activeId) ?? state.profiles[0];

/**
 * Picks the active id when saving from a page that was loaded earlier. The active profile can be switched
 * on lichess in the meantime, which must not be reverted by saving unless it was changed on this page too.
 */
export const resolveActiveId = ({ loaded, local, stored, ids }: { loaded: string; local: string; stored: string; ids: ReadonlyArray<string> }): string =>
  local === loaded && ids.includes(stored) ? stored : local;

/** True if the change event of the sync storage affects the profiles. */
export const affectsProfiles = (changes: Record<string, unknown>): boolean => Object.keys(changes).some(key => key === INDEX_KEY || key.startsWith(PROFILE_KEY_PREFIX));
