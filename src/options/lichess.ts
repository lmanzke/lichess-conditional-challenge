import { ManagedRuntime } from 'effect';
import { checkTeam as checkTeamEffect, type TeamCheck } from '@/challenge/teams';
import { Lichess } from '@/challenge/lichess-api';

// The options page does not live on lichess.org, so it needs the absolute address (and the host permission of the manifest).
const runtime = ManagedRuntime.make(Lichess.layerFetch('https://lichess.org'));

export const checkTeam = (input: string): Promise<TeamCheck> => runtime.runPromise(checkTeamEffect(input));
