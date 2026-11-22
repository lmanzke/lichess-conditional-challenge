import { Effect, Option } from 'effect';
import { Lichess } from '@/challenge/lichess-api';
import { DeclineReason, type Challenge, type LiChessChallenge } from '@/challenge/types';

export const getChallengeElement = (container: HTMLElement): Effect.Effect<HTMLElement, Error> =>
  Option.match(Option.fromNullishOr(container.getElementsByClassName('challenges').item(0)), {
    onNone: () => Effect.fail(new Error('Element not found')),
    onSome: element => Effect.succeed(element as HTMLElement),
  });

/** Combines the challenges rendered in the DOM (which have the buttons) with the ones the lichess API knows (which have the data). */
export const getChallenges = (challengeContainerElement: HTMLElement): Effect.Effect<Challenge[], Error, Lichess> =>
  Effect.gen(function* () {
    const lichess = yield* Lichess;
    const remoteChallenges = new Map<string, LiChessChallenge>((yield* lichess.incomingChallenges).map(c => [c.id, c]));

    return Array.from(challengeContainerElement.getElementsByClassName('challenge')).flatMap((element): Challenge[] => {
      const userLink = element.getElementsByClassName('user-link')[0]?.getAttribute('href');
      const id = element.getElementsByTagName('form')[0]?.getAttribute('action')?.split('/')[2];
      const remote = id ? remoteChallenges.get(id) : undefined;

      if (!userLink || !id || !remote) {
        return [];
      }

      const acceptButton = element.getElementsByClassName('accept')[0] as HTMLButtonElement;
      const declineButton = element.getElementsByClassName('decline')[0] as HTMLButtonElement;
      const declineReasonSelect = element.getElementsByClassName('decline-reason')[0] as HTMLSelectElement;

      return [
        {
          ...remote,
          userLink,
          username: userLink.split('/').pop() as string,
          accept: () => acceptButton.click(),
          decline: reason => {
            if (reason === DeclineReason.RULE_FAILED) {
              declineButton.click();
              return;
            }

            declineReasonSelect.value = reason;
            declineReasonSelect.dispatchEvent(new Event('change'));
          },
        },
      ];
    });
  });
