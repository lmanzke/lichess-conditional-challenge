import { Effect, type Predicate } from 'effect';
import { Lichess } from '@/challenge/lichess-api';
import type { RelationCode } from '@/challenge/relations';
import { DeclineReason, type Challenge, type EncounterCount, type Matchup, type RuleValue, type RuleValueType } from '@/challenge/types';

/**
 * A Field is a property of a challenge that a rule can look at. Everything the extension knows about a Field is here:
 * how to read it from a challenge, which relations make sense, what a new rule starts with and what is wrong with a rule about it.
 */
export interface FieldDefinition {
  readonly id: string;
  readonly type: 'string' | 'integer';
  /** Renders a set of choices instead of a free input. 'radio' picks one, 'checkbox' any number of them. */
  readonly input?: 'radio' | 'checkbox';
  /** The keys of the choices. Their labels are the messages `values.<field id>.<key>`. */
  readonly values?: string[];
  readonly relations: RelationCode[];
  /** The smallest value that makes sense for a number. */
  readonly min?: number;
  /** The values that actually occur. A rule outside of them is allowed, but pointless. */
  readonly plausible?: { min: number; max: number };
  /** The value a new rule starts with (and the center of a new range), instead of 0. */
  readonly start?: number;
  /** Whether `holds` is true for the value of this field in the challenge (for any of them, if there are several). May ask lichess. */
  readonly test: (challenge: Challenge, holds: Predicate.Predicate<RuleValueType>) => Effect.Effect<boolean, Error, Lichess>;
  /** The stored value of a rule as the comparison needs it. */
  readonly coerce: (value: RuleValue) => RuleValue;
  /** What lichess is told when a challenge is declined because of this field. */
  readonly declineReason: (value: RuleValue) => DeclineReason;
}

/** Lichess ratings are not found outside of this range in practice. */
export const RATING_RANGE = { min: 100, max: 3000 };

export const extractNumEncounters = (match: Matchup): EncounterCount => ({
  total: match.nbGames,
  today: match.matchup ? match.matchup.nbGames : 0,
});

const getNumEncounters = (challenge: Challenge) =>
  Effect.gen(function* () {
    const lichess = yield* Lichess;
    const userId = yield* lichess.currentUserId;
    return extractNumEncounters(yield* lichess.crosstable(challenge.username, userId));
  });

const keep = (value: RuleValue): RuleValue => value;
const toBoolean = (value: RuleValue): RuleValue => !!value;
const toNumber = (value: RuleValue): RuleValue => {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return Array.isArray(value) || typeof value === 'number' ? value : parseInt(value);
};

const ruleFailed = () => DeclineReason.RULE_FAILED;

const stringRelations: RelationCode[] = ['equal', 'not_equal', 'not_in', 'in'];
const numberRelations: RelationCode[] = ['less', 'less_or_equal', 'greater', 'greater_or_equal', 'between'];
const numberRelationsWithEqual: RelationCode[] = [...numberRelations, 'equal'];
const inRelations: RelationCode[] = ['in', 'not_in'];

/** A field with a single value that is known from the challenge itself. */
const own =
  (select: (challenge: Challenge) => RuleValueType): FieldDefinition['test'] =>
  (challenge, holds) =>
    Effect.succeed(holds(select(challenge)));

const encounters =
  (select: (count: EncounterCount) => number): FieldDefinition['test'] =>
  (challenge, holds) =>
    getNumEncounters(challenge).pipe(Effect.map(count => holds(select(count))));

export const fields: ReadonlyArray<FieldDefinition> = [
  {
    id: 'team-name',
    type: 'string',
    relations: stringRelations,
    test: (challenge, holds) =>
      Effect.gen(function* () {
        const lichess = yield* Lichess;
        const teams = yield* lichess.teamsOf(challenge.username);
        return teams.some(team => holds(team.id));
      }),
    coerce: keep,
    declineReason: ruleFailed,
  },
  { id: 'user-id', type: 'string', relations: stringRelations, test: own(challenge => challenge.challenger.id), coerce: keep, declineReason: ruleFailed },
  { id: 'encounters', type: 'integer', min: 0, relations: numberRelations, test: encounters(count => count.total), coerce: toNumber, declineReason: ruleFailed },
  { id: 'encountersToday', type: 'integer', min: 0, relations: numberRelations, test: encounters(count => count.today), coerce: toNumber, declineReason: ruleFailed },
  {
    id: 'rating',
    type: 'integer',
    min: 0,
    plausible: RATING_RANGE,
    start: 1500,
    relations: numberRelationsWithEqual,
    test: own(challenge => challenge.challenger.rating),
    coerce: toNumber,
    declineReason: ruleFailed,
  },
  {
    id: 'rated',
    type: 'integer',
    input: 'radio',
    values: ['1', '0'],
    relations: ['equal'],
    test: own(challenge => challenge.rated),
    coerce: toBoolean,
    declineReason: value => (value ? DeclineReason.ONLY_RATED : DeclineReason.ONLY_UNRATED),
  },
  {
    id: 'provisional',
    type: 'integer',
    input: 'radio',
    values: ['1', '0'],
    relations: ['equal'],
    test: own(challenge => challenge.challenger.provisional ?? false),
    coerce: toBoolean,
    declineReason: ruleFailed,
  },
  {
    id: 'variant',
    type: 'string',
    input: 'checkbox',
    values: ['standard', 'chess960', 'crazyhouse', 'antichess', 'atomic', 'horde', 'kingOfTheHill', 'racingKings', 'threeCheck'],
    relations: inRelations,
    test: own(challenge => challenge.variant.key),
    coerce: keep,
    declineReason: value => {
      if (!Array.isArray(value) || value.length === 0) {
        return DeclineReason.RULE_FAILED;
      }
      return value.length === 1 && value[0] === 'standard' ? DeclineReason.NO_VARIANTS : DeclineReason.NOT_THIS_VARIANT;
    },
  },
  {
    id: 'timecontrolType',
    type: 'string',
    input: 'checkbox',
    values: ['clock', 'correspondence', 'unlimited'],
    relations: inRelations,
    test: own(challenge => challenge.timeControl.type),
    coerce: toNumber,
    declineReason: ruleFailed,
  },
  {
    id: 'limitSeconds',
    type: 'integer',
    min: 0,
    relations: numberRelationsWithEqual,
    test: own(challenge => challenge.timeControl.limit || 0),
    coerce: toNumber,
    declineReason: ruleFailed,
  },
  {
    id: 'incrementSeconds',
    type: 'integer',
    min: 0,
    relations: numberRelationsWithEqual,
    test: own(challenge => challenge.timeControl.increment || 0),
    coerce: toNumber,
    declineReason: ruleFailed,
  },
  {
    id: 'challengeColor',
    type: 'string',
    input: 'checkbox',
    values: ['black', 'white', 'random'],
    relations: inRelations,
    test: own(challenge => challenge.color),
    coerce: toNumber,
    declineReason: ruleFailed,
  },
];

/** Rules about an unknown field are treated as rules about teams, as they always were. */
export const findField = (id: string): FieldDefinition => fields.find(field => field.id === id) ?? fields[0];

export const defaultValue = (field: FieldDefinition, relation: RelationCode): RuleValue => {
  if (field.input === 'checkbox') return [];
  if (field.input === 'radio') return 1;
  const start = field.start ?? 0;
  if (relation === 'between') return field.start === undefined ? [0, 0] : [start - 300, start + 300];
  return field.type === 'integer' ? start : '';
};

/** Rounds to a whole number and keeps it within the allowed range of the field. */
export const clampNumber = (field: FieldDefinition, value: number): number => {
  const whole = Number.isFinite(value) ? Math.round(value) : 0;
  return field.min === undefined ? whole : Math.max(field.min, whole);
};
