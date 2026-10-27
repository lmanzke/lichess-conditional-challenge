import { flushPromises, mount } from '@vue/test-utils';
import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChallengeApp from '@/challenge/App.vue';
import OptionsApp from '@/options/App.vue';
import { i18n } from '@/i18n';
import { INDEX_KEY, loadProfiles, newProfile, saveProfiles } from '@/challenge/profiles';
import type { Lichess } from '@/challenge/lichess-api';
import type { Rule } from '@/challenge/types';
import { fakeStorage, lichessLayer } from './helpers';

const rating = (operator: string, value: number): Rule => ({
  condition: 'AND',
  rules: [{ id: 'rating', operator, value, silent: false, rules: [], condition: undefined }],
  id: '',
  operator: '',
  value: '',
  silent: false,
});

let storage: ReturnType<typeof fakeStorage>;
beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal('chrome', { storage: { sync: storage, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } } });
});
afterEach(() => vi.unstubAllGlobals());

describe('challenge panel', () => {
  const challengeHtml = (id: string) =>
    `<div class="challenge"><a class="user-link" href="/@/Bob"></a><form action="/challenge/${id}/accept"></form><button class="accept"></button><button class="decline"></button></div>`;

  const mountPanel = () => {
    document.body.innerHTML = `<div id="root"><div class="challenges">${challengeHtml('abc')}</div></div>`;
    const layer = lichessLayer({
      incomingChallenges: Effect.succeed([
        { id: 'abc', challenger: { id: 'bob', rating: 1800 }, rated: true, variant: { key: 'standard' }, timeControl: { type: 'clock' }, color: 'random' },
      ]),
    });
    const runEffect = <A>(effect: Effect.Effect<A, Error, Lichess>) => Effect.runPromise(effect.pipe(Effect.provide(layer)));
    return mount(ChallengeApp, { props: { container: document.getElementById('root') as HTMLElement, runEffect }, global: { plugins: [i18n] } });
  };

  it('should hide the profile selector with a single profile', async () => {
    const wrapper = mountPanel();
    await flushPromises();
    expect(wrapper.find('select').exists()).toBe(false);
  });

  it('should switch the active profile with the selector', async () => {
    const [a, b] = [newProfile('Strong', rating('greater', 2000)), newProfile('Everyone')];
    await Effect.runPromise(saveProfiles(storage, { activeId: a.id, profiles: [a, b] }));
    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.findAll('option').map(o => o.text())).toEqual(['Strong', 'Everyone']);
    await wrapper.find('select').setValue(b.id);
    await flushPromises();

    expect((await Effect.runPromise(loadProfiles(storage))).activeId).toBe(b.id);
  });

  it('should accept the matching challenge and report it', async () => {
    const accepted = vi.fn();
    const wrapper = mountPanel();
    document.querySelector('.accept')?.addEventListener('click', accepted);

    await wrapper.findAll('button')[0].trigger('click');
    await flushPromises();

    expect(accepted).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.status').text()).toBe('Accepted a challenge');
  });

  it('should report when nothing matches', async () => {
    const [a] = [newProfile('Strong', rating('greater', 2500))];
    await Effect.runPromise(saveProfiles(storage, { activeId: a.id, profiles: [a] }));
    const wrapper = mountPanel();

    await wrapper.findAll('button')[0].trigger('click');
    await flushPromises();

    expect(wrapper.find('.status').text()).toBe('No matching challenge');
    expect(wrapper.find('.status').classes()).not.toContain('error');
  });

  it('should only decline all after a confirmation', async () => {
    const [a] = [newProfile('Strong', rating('greater', 2500))];
    await Effect.runPromise(saveProfiles(storage, { activeId: a.id, profiles: [a] }));
    const declined = vi.fn();
    const wrapper = mountPanel();
    document.querySelector('.decline')?.addEventListener('click', declined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await wrapper.findAll('button')[1].trigger('click');
    await flushPromises();
    expect(declined).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await wrapper.findAll('button')[1].trigger('click');
    await flushPromises();
    expect(declined).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.status').text()).toBe('Declined 1 challenge');
  });
});

describe('options page', () => {
  it('should add a profile, rename it and save everything', async () => {
    const wrapper = mount(OptionsApp, { global: { plugins: [i18n] } });
    await flushPromises();

    const buttons = (label: string) => wrapper.findAll('button').find(b => b.text() === label)!;
    await buttons('New').trigger('click');
    await wrapper.find('input[type=text]').setValue('Bullet');
    await buttons('Save').trigger('click');
    await flushPromises();

    const state = await Effect.runPromise(loadProfiles(storage));
    expect(state.profiles.map(p => p.name)).toEqual(['Default', 'Bullet']);
    expect(wrapper.find('.saved').exists()).toBe(true);
  });

  it('should not revert a profile switched on lichess in the meantime', async () => {
    const [a, b] = [newProfile('A'), newProfile('B')];
    await Effect.runPromise(saveProfiles(storage, { activeId: a.id, profiles: [a, b] }));
    const wrapper = mount(OptionsApp, { global: { plugins: [i18n] } });
    await flushPromises();

    storage.data[INDEX_KEY] = { activeId: b.id, ids: [a.id, b.id] };
    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Save')!
      .trigger('click');
    await flushPromises();

    expect((await Effect.runPromise(loadProfiles(storage))).activeId).toBe(b.id);
  });
});
