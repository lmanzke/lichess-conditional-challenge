import { Effect } from 'effect';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { chromeProfileStore } from '@/challenge/profile-store';
import type { ProfileState } from '@/challenge/profiles';

/** The profiles in sync storage, kept up to date when they change in another tab or on the options page. */
export const useProfiles = () => {
  const store = chromeProfileStore();
  const state = ref<ProfileState>();
  let unsubscribe: (() => void) | undefined;

  const reload = async () => {
    state.value = await Effect.runPromise(store.load);
  };
  const select = async (id: string) => {
    await Effect.runPromise(store.setActive(id));
    await reload();
  };

  onMounted(() => {
    void reload();
    unsubscribe = store.subscribe(() => void reload());
  });
  onBeforeUnmount(() => unsubscribe?.());

  return { state, select };
};
