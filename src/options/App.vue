<template>
  <div class="options-container">
    <query-builder :options="queryBuilderOptions" @rulesChanged="handleRuleChange"></query-builder>
  </div>
</template>

<script lang="ts">
import QueryBuilder from '../builder/QueryBuilder';
import { defineComponent } from 'vue';
import { Rule } from '@/challenge/types';

interface AppData {
  queryBuilderRules?: Rule;
}

export default defineComponent({
  name: 'App',
  components: { QueryBuilder },
  methods: {
    handleRuleChange(newRules: Rule): void {
      chrome.storage.sync.set({ lichessTeamRules: JSON.stringify(newRules) });
    },
  },
  data: (): AppData => ({
    queryBuilderRules: undefined,
  }),
  computed: {
    queryBuilderOptions(): unknown {
      return {
        plugins: ['bt-checkbox', 'silent', 'bt-selectpicker'],
        filters: [
          {
            id: 'team-name',
            label: 'Team Name',
            type: 'string',
            operators: ['equal', 'not_equal', 'not_in', 'in'],
          },
          {
            id: 'user-id',
            label: 'User Id',
            type: 'string',
            operators: ['equal', 'not_equal', 'not_in', 'in'],
          },
          {
            id: 'encounters',
            label: 'Number of past encounters',
            type: 'integer',
            operators: ['less', 'less_or_equal', 'greater', 'greater_or_equal', 'between'],
          },
          {
            id: 'encountersToday',
            label: 'Number of encounters today',
            type: 'integer',
            operators: ['less', 'less_or_equal', 'greater', 'greater_or_equal', 'between'],
          },
          {
            id: 'rating',
            label: 'Rating',
            type: 'integer',
            operators: ['less', 'less_or_equal', 'greater', 'greater_or_equal', 'between'],
          },
          {
            id: 'rated',
            label: 'Rated',
            input: 'radio',
            type: 'integer',
            values: {
              1: 'Yes',
              0: 'No',
            },
            operators: ['equal'],
          },
          {
            id: 'variant',
            label: 'Variant',
            input: 'checkbox',
            type: 'integer',
            values: {
              standard: 'Standard',
              chess960: 'Chess960',
              crazyhouse: 'Crazyhouse',
              antichess: 'Antichess',
              atomic: 'Atomic',
              horde: 'Horde',
              kingOfTheHill: 'King Of The Hill',
              racingKings: 'Racing Kings',
              threeCheck: 'Three Check',
            },
            color: 'primary',
            operators: ['in', 'not_in'],
          },
        ],
        rules: this.queryBuilderRules,
      };
    },
  },
  mounted(): void {
    chrome.storage.sync.get(['lichessTeamRules'], result => {
      if (result.lichessTeamRules) {
        const { valid: _valid, ...rules } = JSON.parse(result.lichessTeamRules);
        this.queryBuilderRules = rules;
      } else {
        this.queryBuilderRules = {
          condition: 'AND',
          rules: [
            {
              id: 'rating',
              operator: 'greater',
              value: '0',
              silent: false,
              rules: [],
              condition: undefined,
            },
          ],
          valid: true,
        };
      }
    });
  },
});
</script>

<style lang="scss">
.options-container {
  padding: 20px;
  min-width: 1200px;
  min-height: 300px;
  display: flex;
}

.options-container > div {
  flex: 1;
}
</style>
