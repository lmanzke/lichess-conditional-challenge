import { Effect } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getChallengeElement, getChallenges } from '@/challenge/lichess';
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

const load = (container: HTMLElement, incoming: LiChessChallenge[]) =>
  Effect.runPromise(getChallenges(container).pipe(Effect.provide(lichessLayer({ incomingChallenges: Effect.succeed(incoming) }))));

describe('getChallenges', () => {
  let container: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = `<div id="root"><div class="challenges">${challengeHtml('abc', 'Bob')}${challengeHtml('def', 'Alice')}<div class="challenge"><p>no link</p></div></div></div>`;
    container = document.getElementById('root') as HTMLElement;
  });

  it('should combine the elements with the data from the API', async () => {
    const challenges = await load(container, [remote('abc'), remote('def')]);

    expect(challenges.map(c => [c.id, c.username, c.userLink])).toEqual([
      ['abc', 'Bob', '/@/Bob'],
      ['def', 'Alice', '/@/Alice'],
    ]);
    expect(challenges[0].challenger.rating).toBe(1800);
  });

  it('should skip challenges the API does not know', async () => {
    expect((await load(container, [remote('def')])).map(c => c.id)).toEqual(['def']);
  });

  it('should click the buttons of the matching element', async () => {
    const [bob, alice] = await load(container, [remote('abc'), remote('def')]);
    const [bobAccept, aliceDecline] = [container.querySelectorAll('.accept')[0], container.querySelectorAll('.decline')[1]];
    const listeners = vi.fn();
    bobAccept.addEventListener('click', () => listeners('bob accepted'));
    aliceDecline.addEventListener('click', () => listeners('alice declined'));

    bob.accept();
    alice.decline(DeclineReason.RULE_FAILED);

    expect(listeners.mock.calls).toEqual([['bob accepted'], ['alice declined']]);
  });

  it('should pick a decline reason via the select', async () => {
    const [bob] = await load(container, [remote('abc')]);
    const select = container.querySelector('.decline-reason') as HTMLSelectElement;
    const changed = vi.fn(() => select.value);
    select.addEventListener('change', changed);

    bob.decline(DeclineReason.ONLY_RATED);

    expect(changed).toHaveReturnedWith('rated');
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
