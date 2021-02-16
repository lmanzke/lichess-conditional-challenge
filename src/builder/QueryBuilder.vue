<template>
  <div class="element-container">
    <div ref="queryBuilderContainer"></div>
    <div class="button-container">
      <button class="btn btn-primary" @click="emitRules">Save</button>
      <button class="btn btn-danger" @click="resetRules">Reset</button>
    </div>
  </div>
</template>

<script>
import $ from 'jquery';
import 'jQuery-QueryBuilder';
import { defineComponent } from 'vue';

const addPlugin = QueryBuilder => {
  QueryBuilder.define(
    'silent',

    function(_options) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const that = this;
      this.on('ruleToJson.queryBuilder.filter', function(event, rule) {
        event.value.silent = !!rule.silent;
      });
      this.on('jsonToRule.queryBuilder.filter', function(event, json) {
        if (event && event.value) {
          event.value.silent = !!json.silent;
        }
        event.value.$el.find('input.silent').prop('checked', !!json.silent);
      });
      this.on('afterCreateRuleFilters', function(e, rule) {
        const div = $('<div class="checkbox checkbox-primary"></div>');
        const label = $('<label class="silent-label">Silent</label>');
        const input = $('<input class="silent" type="checkbox"/>');

        div.append(input);
        div.append(label);

        rule.$el.append(div);
        input.on('change', v => {
          rule.silent = v.target.checked;
          that.trigger('rulesChanged');
        });
      });
    },
    {}
  );
};

export default defineComponent({
  name: 'QueryBuilder',
  props: {
    options: {
      type: Object,
    },
  },
  methods: {
    emitRules() {
      const container = $(this.$refs.queryBuilderContainer);
      const rules = $(container).queryBuilder('getRules');
      if (rules) {
        this.$emit('rules-changed', rules);
      }
      this.saved = true;
    },
    resetRules() {
      const container = $(this.$refs.queryBuilderContainer);
      $(container).queryBuilder('setRules', {
        rules: [
          {
            id: 'rating',
            operator: 'greater',
            value: '0',
            silent: false,
          },
        ],
        condition: 'AND',
      });
      this.emitRules();
    },
  },
  data: () => ({
    watcherAdded: false,
    saved: true,
  }),
  computed: {
    rulesProp() {
      return this.options.rules;
    },
  },
  mounted() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const container = $(this.$refs.queryBuilderContainer);
    addPlugin($.fn.queryBuilder);
    container.queryBuilder(this.options);
  },
  watch: {
    rulesProp: {
      handler(newValue) {
        const container = $(this.$refs.queryBuilderContainer);
        if (newValue === undefined) {
          container.queryBuilder('reset');
        } else {
          container.queryBuilder('setRules', newValue);
        }
        if (!this.watcherAdded) {
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          const vue = this;
          this.watcherAdded = true;
          container.on('rulesChanged.queryBuilder', function() {
            const model = $(this).queryBuilder('getModel');
            if (!model) {
              return;
            }
            const rules = $(this).queryBuilder('getRules');
            if (rules) {
              vue.saved = false;
            }
          });
        }
      },
    },
  },
});
</script>

<style>
.element-container {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
}

.button-container {
  display: flex;
  justify-content: space-between;
}
</style>
