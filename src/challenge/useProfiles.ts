import { Effect } from 'effect';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { affectsProfiles, loadProfiles, setActiveProfile, type ProfileState } from '@/challenge/profiles';

/** The profiles in sync storage, kept up to date when they change in another tab or on the options page. */
export const useProfiles = () => {
  const state = ref<ProfileState>();

  const reload = async () => {
    state.value = await Effect.runPromise(loadProfiles(chrome.storage.sync));
  };
  const onChanged = (changes: Record<string, unknown>, area: string) => {
    if (area === 'sync' && affectsProfiles(changes)) void reload();
  };
  const select = async (id: string) => {
    await Effect.runPromise(setActiveProfile(chrome.storage.sync, id));
    await reload();
  };

  onMounted(() => {
    void reload();
    chrome.storage.onChanged.addListener(onChanged);
  });
  onBeforeUnmount(() => chrome.storage.onChanged.removeListener(onChanged));

  return { state, select };
};
