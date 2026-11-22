import { Context, Effect, Layer, Option } from 'effect';
import { Lichess } from '@/challenge/lichess-api';
import { DeclineReason, type Challenge, type LiChessChallenge } from '@/challenge/types';

/** The challenges a player has received, and what can be done with them. */
export class ChallengeInbox extends Context.Service<
  ChallengeInbox,
  {
    /** The challenges that are shown to the player and that lichess has data for. */
    incoming: Effect.Effect<ReadonlyArray<Challenge>, Error>;
    accept(id: string): Effect.Effect<void, Error>;
    decline(id: string, reason: DeclineReason): Effect.Effect<void, Error>;
  }
>()('team-challenge/ChallengeInbox') {
  /**
   * The inbox of the lichess page: the challenges are the elements in the challenge menu `container`, enriched with the data of the lichess API,
   * and accepting or declining clicks the buttons of the element.
   */
  static readonly layerPage = (container: HTMLElement) =>
    Layer.effect(
      ChallengeInbox,
      Effect.gen(function* () {
        const lichess = yield* Lichess;
        const controls = new Map<string, { accept: HTMLButtonElement; decline: HTMLButtonElement; reason: HTMLSelectElement }>();

        const controlsOf = (id: string) =>
          Option.match(Option.fromNullishOr(controls.get(id)), {
            onNone: () => Effect.fail(new Error(`Challenge ${id} is not in the challenge menu`)),
            onSome: Effect.succeed,
          });

        const incoming = Effect.gen(function* () {
          const element = yield* getChallengeElement(container);
          const remoteChallenges = new Map<string, LiChessChallenge>((yield* lichess.incomingChallenges).map(c => [c.id, c]));
          controls.clear();

          return Array.from(element.getElementsByClassName('challenge')).flatMap((challengeElement): Challenge[] => {
            const userLink = challengeElement.getElementsByClassName('user-link')[0]?.getAttribute('href');
            const id = challengeElement.getElementsByTagName('form')[0]?.getAttribute('action')?.split('/')[2];
            const remote = id ? remoteChallenges.get(id) : undefined;

            if (!userLink || !id || !remote) {
              return [];
            }

            controls.set(id, {
              accept: challengeElement.getElementsByClassName('accept')[0] as HTMLButtonElement,
              decline: challengeElement.getElementsByClassName('decline')[0] as HTMLButtonElement,
              reason: challengeElement.getElementsByClassName('decline-reason')[0] as HTMLSelectElement,
            });
            return [{ ...remote, username: userLink.split('/').pop() as string }];
          });
        });

        return ChallengeInbox.of({
          incoming,
          accept: id => Effect.flatMap(controlsOf(id), ({ accept }) => Effect.sync(() => accept.click())),
          decline: (id, reason) =>
            Effect.flatMap(controlsOf(id), ({ decline, reason: select }) =>
              Effect.sync(() => {
                if (reason === DeclineReason.RULE_FAILED) {
                  decline.click();
                  return;
                }

                select.value = reason;
                select.dispatchEvent(new Event('change'));
              })
            ),
        });
      })
    );
}

export const getChallengeElement = (container: HTMLElement): Effect.Effect<HTMLElement, Error> =>
  Option.match(Option.fromNullishOr(container.getElementsByClassName('challenges').item(0)), {
    onNone: () => Effect.fail(new Error('Element not found')),
    onSome: element => Effect.succeed(element as HTMLElement),
  });
