import { Schema } from 'effect';

// What this extension reads from the lichess API. Only the fields that are used are described, anything else is ignored.
// A response that does not look like this is an error, instead of undefined values showing up somewhere in the rules later.

export const ChallengerSchema = Schema.Struct({ id: Schema.String, rating: Schema.Number });
export type Challenger = typeof ChallengerSchema.Type;

export const VariantSchema = Schema.Struct({ key: Schema.String });
export type Variant = typeof VariantSchema.Type;

export const TimeControlSchema = Schema.Struct({
  type: Schema.String,
  limit: Schema.optional(Schema.Number),
  increment: Schema.optional(Schema.Number),
  daysPerTurn: Schema.optional(Schema.Number),
});
export type TimeControl = typeof TimeControlSchema.Type;

/** A challenge as `/challenge` lists it. */
export const LiChessChallengeSchema = Schema.Struct({
  id: Schema.String,
  challenger: ChallengerSchema,
  rated: Schema.Boolean,
  variant: VariantSchema,
  timeControl: TimeControlSchema,
  color: Schema.String,
});
export type LiChessChallenge = typeof LiChessChallengeSchema.Type;

/** The list is read element by element, so one odd challenge does not hide all the others. */
export const IncomingChallengesSchema = Schema.Struct({ in: Schema.Array(Schema.Unknown) });

export const DasherInfoSchema = Schema.Struct({ user: Schema.Struct({ id: Schema.String }) });
export type DasherInfo = typeof DasherInfoSchema.Type;

export const TeamSchema = Schema.Struct({ id: Schema.String, name: Schema.String, nbMembers: Schema.optional(Schema.Number) });
export type Team = typeof TeamSchema.Type;

export const TeamsSchema = Schema.Array(TeamSchema);

/** The head-to-head score of two players, `matchup` being the one of the current day (if they played today). */
export const MatchupSchema = Schema.Struct({
  nbGames: Schema.Number,
  matchup: Schema.optional(Schema.Struct({ nbGames: Schema.Number })),
});
export type Matchup = typeof MatchupSchema.Type;
