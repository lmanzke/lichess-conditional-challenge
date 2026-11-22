import { Effect, Layer } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChallengeInbox, getChallengeElement } from '@/challenge/inbox';
import { DeclineReason, type LiChessChallenge } from '@/challenge/types';
import { lichessLayer } from './helpers';

const remote = (id: string): LiChessChallenge => ({
  id,
  challenger: { id: 'bob', rating: 1800 },
  rated: true,
  variant: { key: 'standard' },
  timeControl: { type: 'clock', limit: 300, increment: 0 },
  color: 'random',
});

const challengeHtml = (id: string, user: string) => `
  <div class="challenge">
    <a class="user-link" href="/@/${user}"></a>
    <form action="/challenge/${id}/accept"></form>
    <button class="accept"></button><button class="decline"></button>
    <select class="decline-reason"><option value="ruleFailed"></option><option value="rated"></option></select>
  </div>`;

/** The inbox of a page, with the challenges the lichess API returns. */
const pageInbox = (container: HTMLElement, incoming: LiChessChallenge[]) =>
  Effect.gen(function* () {
    return yield* ChallengeInbox;
  }).pipe(Effect.provide(ChallengeInbox.layerPage(container).pipe(Layer.provide(lichessLayer({ incomingChallenges: Effect.succeed(incoming) })))));

const load = async (container: HTMLElement, incoming: LiChessChallenge[]) => {
  const inbox = await Effect.runPromise(pageInbox(container, incoming));
  const challenges = await Effect.runPromise(inbox.incoming);
  return { inbox, challenges };
};

describe('ChallengeInbox.layerPage', () => {
  let container: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = `<div id="root"><div class="challenges">${challengeHtml('abc', 'Bob')}${challengeHtml('def', 'Alice')}<div class="challenge"><p>no link</p></div></div></div>`;
    container = document.getElementById('root') as HTMLElement;
  });

  it('should combine the elements with the data from the API', async () => {
    const { challenges } = await load(container, [remote('abc'), remote('def')]);

    expect(challenges.map(c => [c.id, c.username])).toEqual([
      ['abc', 'Bob'],
      ['def', 'Alice'],
    ]);
    expect(challenges[0].challenger.rating).toBe(1800);
  });

  it('should skip challenges the API does not know', async () => {
    expect((await load(container, [remote('def')])).challenges.map(c => c.id)).toEqual(['def']);
  });

  it('should click the buttons of the matching element', async () => {
    const { inbox } = await load(container, [remote('abc'), remote('def')]);
    const [bobAccept, aliceDecline] = [container.querySelectorAll('.accept')[0], container.querySelectorAll('.decline')[1]];
    const listeners = vi.fn();
    bobAccept.addEventListener('click', () => listeners('bob accepted'));
    aliceDecline.addEventListener('click', () => listeners('alice declined'));

    await Effect.runPromise(inbox.accept('abc'));
    await Effect.runPromise(inbox.decline('def', DeclineReason.RULE_FAILED));

    expect(listeners.mock.calls).toEqual([['bob accepted'], ['alice declined']]);
  });

  it('should pick a decline reason via the select', async () => {
    const { inbox } = await load(container, [remote('abc')]);
    const select = container.querySelector('.decline-reason') as HTMLSelectElement;
    const changed = vi.fn(() => select.value);
    select.addEventListener('change', changed);

    await Effect.runPromise(inbox.decline('abc', DeclineReason.ONLY_RATED));

    expect(changed).toHaveReturnedWith('rated');
  });
});

describe('acting on a challenge that is not in the menu', () => {
  it('should fail', async () => {
    document.body.innerHTML = `<div id="root"><div class="challenges">${challengeHtml('abc', 'Bob')}</div></div>`;
    const { inbox } = await load(document.getElementById('root') as HTMLElement, [remote('abc')]);

    await expect(Effect.runPromise(inbox.accept('gone'))).rejects.toThrow('not in the challenge menu');
  });
});

describe('getChallengeElement', () => {
  it('should find the challenges element and fail without it', async () => {
    document.body.innerHTML = '<div id="root"><div class="challenges"></div></div>';
    await expect(Effect.runPromise(getChallengeElement(document.getElementById('root') as HTMLElement))).resolves.toBe(document.querySelector('.challenges'));

    document.body.innerHTML = '<div id="root"></div>';
    await expect(Effect.runPromise(getChallengeElement(document.getElementById('root') as HTMLElement))).rejects.toThrow('Element not found');
  });
});
