import { flushPromises, mount } from '@vue/test-utils';
import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChallengeApp from '@/challenge/App.vue';
import OptionsApp from '@/options/App.vue';
import { i18n } from '@/i18n';
import { exportProfiles, INDEX_KEY, loadProfiles, newProfile, saveProfiles } from '@/challenge/profiles';
import type { Lichess } from '@/challenge/lichess-api';
import type { Rule } from '@/challenge/types';
import { checkTeam } from '@/options/lichess';
import { fakeStorage, lichessLayer } from './helpers';

const rating = (operator: string, value: number): Rule => ({
  condition: 'AND',
  rules: [{ id: 'rating', operator, value, silent: false, rules: [], condition: undefined }],
  id: '',
  operator: '',
  value: '',
  silent: false,
});

vi.mock('@/options/lichess', () => ({ checkTeam: vi.fn() }));

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

  it('should warn about rules that cannot work, but still save them', async () => {
    const empty = newProfile('Empty', { ...rating('greater', 0), rules: [] });
    await Effect.runPromise(saveProfiles(storage, { activeId: empty.id, profiles: [empty] }));
    const wrapper = mount(OptionsApp, { global: { plugins: [i18n] } });
    await flushPromises();

    expect(wrapper.find('.group .warning').text()).toContain('no rules');
    expect(wrapper.find('.actions .warning').text()).toContain('1 rule may not work');
    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Save')!
      .trigger('click');
    await flushPromises();
    expect((await Effect.runPromise(loadProfiles(storage))).profiles[0].rules.rules).toEqual([]);
  });

  it('should import profiles from a file and only store them on save', async () => {
    const wrapper = mount(OptionsApp, { global: { plugins: [i18n] } });
    await flushPromises();
    const upload = async (text: string) => {
      const input = wrapper.find('input[type=file]');
      Object.defineProperty(input.element, 'files', { value: [new File([text], 'profiles.json')], configurable: true });
      await input.trigger('change');
      await flushPromises();
    };

    await upload('garbage');
    expect(wrapper.find('.import-message').text()).toContain('not a valid');

    await upload(exportProfiles([newProfile('Imported', rating('greater', 1900))]));
    expect(wrapper.find('.import-message').text()).toContain('Imported 1 profile');
    expect((await Effect.runPromise(loadProfiles(storage))).profiles.map(p => p.name)).not.toContain('Imported');

    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Save')!
      .trigger('click');
    await flushPromises();
    expect((await Effect.runPromise(loadProfiles(storage))).profiles.map(p => p.name)).toEqual(['Default', 'Imported']);
  });

  it('should mark unsaved changes until they are saved', async () => {
    const wrapper = mount(OptionsApp, { global: { plugins: [i18n] } });
    await flushPromises();
    expect(wrapper.find('.status.dirty').exists()).toBe(false);

    await wrapper.find('input[type=text]').setValue('Renamed');
    expect(wrapper.find('.status.dirty').text()).toBe('Unsaved changes');

    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Save')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.find('.status.dirty').exists()).toBe(false);
  });

  it('should show a badge for the active profile and a button for the others', async () => {
    const [a, b] = [newProfile('A'), newProfile('B')];
    await Effect.runPromise(saveProfiles(storage, { activeId: a.id, profiles: [a, b] }));
    const wrapper = mount(OptionsApp, { global: { plugins: [i18n] } });
    await flushPromises();

    expect(wrapper.find('.badge').exists()).toBe(true);
    await wrapper.find('select').setValue(b.id);
    expect(wrapper.find('.badge').exists()).toBe(false);

    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Use this profile')!
      .trigger('click');
    expect(wrapper.find('.badge').exists()).toBe(true);
  });

  it('should preview the rules of the selected profile in words', async () => {
    const wrapper = mount(OptionsApp, { global: { plugins: [i18n] } });
    await flushPromises();

    expect(wrapper.find('.preview pre').text()).toBe('All of:\n  • Rating greater 0');
  });

  it('should label the icon buttons for screen readers', async () => {
    const wrapper = mount(OptionsApp, { global: { plugins: [i18n] } });
    await flushPromises();

    expect(wrapper.find('button[aria-label="Delete"]').exists()).toBe(true);
  });
});

describe('team check in the options page', () => {
  const teamRule = (value: string): Rule => ({
    condition: 'AND',
    rules: [{ id: 'team-name', operator: 'in', value, silent: false, rules: [], condition: undefined }],
    id: '',
    operator: '',
    value: '',
    silent: false,
  });

  const mountWithTeam = async (value: string, lookup: typeof checkTeam) => {
    vi.mocked(checkTeam).mockImplementation(lookup);
    await Effect.runPromise(saveProfiles(storage, { activeId: 'p', profiles: [{ id: 'p', name: 'P', rules: teamRule(value) }] }));
    const wrapper = mount(OptionsApp, { global: { plugins: [i18n] } });
    await flushPromises();
    vi.advanceTimersByTime(700);
    await flushPromises();
    return wrapper;
  };

  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('should show whether each team exists', async () => {
    const wrapper = await mountWithTeam('lichess-swiss;nope', async input => ({
      input,
      result: input === 'nope' ? { status: 'missing' } : { status: 'found', id: input, name: 'Lichess Swiss', members: 1234 },
    }));

    const lines = wrapper.findAll('.team-checks li').map(li => li.text());
    expect(lines).toEqual(['Lichess Swiss, 1234 members', 'No team "nope" found on lichess']);
  });

  it('should offer to use the team id instead of the name', async () => {
    const wrapper = await mountWithTeam('Lichess Swiss', async input => ({
      input,
      result: { status: 'missing' },
      suggestion: { status: 'found', id: 'lichess-swiss', name: 'Lichess Swiss', members: 5 },
    }));

    expect(wrapper.find('.team-checks').text()).toContain('Did you mean "lichess-swiss"');
    await wrapper.find('.team-checks button').trigger('click');
    expect((wrapper.find('.value input[type=text]').element as HTMLInputElement).value).toBe('lichess-swiss');
  });

  it('should say so when lichess could not be asked', async () => {
    const wrapper = await mountWithTeam('x', async input => ({ input, result: { status: 'unknown' } }));
    expect(wrapper.find('.team-checks').text()).toContain('Could not check');
  });

  it('should not leave the same team twice after using a suggestion', async () => {
    const wrapper = await mountWithTeam('lichess-swiss;Lichess Swiss', async input => ({
      input,
      result: input === 'lichess-swiss' ? { status: 'found', id: input, name: 'Lichess Swiss', members: 1 } : { status: 'missing' },
      ...(input === 'lichess-swiss' ? {} : { suggestion: { status: 'found', id: 'lichess-swiss', name: 'Lichess Swiss', members: 1 } }),
    }));

    await wrapper.find('.team-checks button').trigger('click');
    expect((wrapper.find('.value input[type=text]').element as HTMLInputElement).value).toBe('lichess-swiss');
  });
});
