<template>
  <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path v-for="d in paths[name]" :key="d" :d="d" />
  </svg>
</template>

<script setup lang="ts">
export type IconName = 'plus' | 'group' | 'trash' | 'copy' | 'download' | 'upload' | 'warning' | 'check';

defineProps<{ name: IconName }>();

const paths: Record<IconName, string[]> = {
  plus: ['M12 5v14', 'M5 12h14'],
  group: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M12 11v5', 'M9.5 13.5h5'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v5', 'M14 11v5'],
  copy: ['M9 9h11v11H9z', 'M5 15V5h10'],
  download: ['M12 4v11', 'M7 11l5 5 5-5', 'M5 20h14'],
  upload: ['M12 16V5', 'M7 9l5-5 5 5', 'M5 20h14'],
  warning: ['M12 3l10 18H2z', 'M12 10v4', 'M12 17.5v.01'],
  check: ['M5 12l5 5 9-10'],
};
</script>
