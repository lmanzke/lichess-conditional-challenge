<template>
  <div class="options-container">
    <query-builder :options="queryBuilderOptions" @rulesChanged="handleRuleChange"></query-builder>
  </div>
</template>

<script>
import QueryBuilder from '../builder/QueryBuilder';

export default {
  name: 'App',
  components: { QueryBuilder },
  methods: {
    handleRuleChange(newRules) {
      chrome.storage.sync.set({ lichessTeamRules: JSON.stringify(newRules) });
    },
  },
  data: () => ({
    queryBuilderRules: undefined,
  }),
  computed: {
    queryBuilderOptions() {
      return {
        filters: [
          {
            id: 'team-name',
            label: 'Team Name',
            type: 'string',
            operators: ['equal', 'not_equal', 'not_in', 'in'],
          },
          {
            id: 'encounters',
            label: 'Number of past encounters',
            type: 'integer',
            operators: ['less', 'less_or_equal', 'greater', 'greater_or_equal'],
          },
        ],
        rules: this.queryBuilderRules,
      };
    },
  },
  mounted() {
    chrome.storage.sync.get(['lichessTeamRules'], result => {
      if (result.lichessTeamRules) {
        const { valid: _valid, ...rules } = JSON.parse(result.lichessTeamRules);
        this.queryBuilderRules = rules;
      }
    });
  },
};
</script>

<style scoped>
.options-container {
  padding: 5px;
  width: 800px;
}
</style>
