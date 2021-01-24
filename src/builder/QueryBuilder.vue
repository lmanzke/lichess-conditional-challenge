<template>
  <div>
    <div ref="queryBuilderContainer"></div>
  </div>
</template>

<script>
import $ from 'jquery';
import 'jQuery-QueryBuilder';
import { defineComponent } from 'vue';

const addPlugin = QueryBuilder => {
  QueryBuilder.define(
    'silent',

    function(options) {
      const that = this;
      this.on('ruleToJson.queryBuilder.filter', function(event, rule) {
        event.value.silent = !!rule.silent;
      });
      this.on('jsonToRule.queryBuilder.filter', function(event, json) {
        if (event.value.constructor.name !== 'Rule') {
          return;
        }
        if (event && event.value) {
          event.value.silent = !!json.silent;
        }
        event.value.$el.find('input.silent').prop('checked', !!json.silent);
      });
      this.on('afterCreateRuleFilters', function(e, rule) {
        const label = $('<label class="silent-label">Silent</label>');
        const input = $('<input class="silent" type="checkbox"/>');

        rule.$el.append(label);
        rule.$el.append(input);
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
  data: () => ({
    watcherAdded: false,
  }),
  computed: {
    rulesProp() {
      return this.options.rules;
    },
  },
  mounted() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const vue = this;
    const container = $(this.$refs.queryBuilderContainer);
    addPlugin($.fn.queryBuilder);
    container.queryBuilder(this.options);
  },
  watch: {
    rulesProp: {
      handler(newValue: unknown) {
        const container = $(this.$refs.queryBuilderContainer);
        container.queryBuilder('setRules', newValue);
        if (!this.watcherAdded) {
          const vue = this;
          this.watcherAdded = true;
          container.on('rulesChanged.queryBuilder', function() {
            const model = $(this).queryBuilder('getModel');
            if (!model) {
              return;
            }
            const rules = $(this).queryBuilder('getRules');
            if (rules) {
              vue.$emit('rules-changed', rules);
            }
          });
        }
      },
    },
  },
});
</script>

<style>
.silent-label {
  display: inline-block !important;
  color: white;
  margin-right: 10px !important;
}

.query-builder,
.query-builder * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.query-builder {
  font-family: sans-serif;
}

.query-builder .hide {
  display: none;
}

.query-builder .pull-right {
  float: right !important;
}

.query-builder .btn {
  text-transform: none;
  display: inline-block;
  padding: 6px 12px;
  margin-bottom: 0px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.42857;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  touch-action: manipulation;
  cursor: pointer;
  user-select: none;
  background-image: none;
  border: 1px solid transparent;
  border-radius: 4px;
}

.query-builder .btn.focus,
.query-builder .btn:focus,
.query-builder .btn:hover {
  color: #333;
  text-decoration: none;
}

.query-builder .btn.active,
.query-builder .btn:active {
  background-image: none;
  outline: 0px none;
  box-shadow: 0px 3px 5px rgba(0, 0, 0, 0.125) inset;
}

.query-builder .btn-success {
  color: #fff;
  background-color: #5cb85c;
  border-color: #4cae4c;
}

.query-builder .btn-primary {
  color: #fff;
  background-color: #337ab7;
  border-color: #2e6da4;
}

.query-builder .btn-danger {
  color: #fff;
  background-color: #d9534f;
  border-color: #d43f3a;
}

.query-builder .btn-success.active,
.query-builder .btn-success.focus,
.query-builder .btn-success:active,
.query-builder .btn-success:focus,
.query-builder .btn-success:hover {
  color: #fff;
  background-color: #449d44;
  border-color: #398439;
}

.query-builder .btn-primary.active,
.query-builder .btn-primary.focus,
.query-builder .btn-primary:active,
.query-builder .btn-primary:focus,
.query-builder .btn-primary:hover {
  color: #fff;
  background-color: #286090;
  border-color: #204d74;
}

.query-builder .btn-danger.active,
.query-builder .btn-danger.focus,
.query-builder .btn-danger:active,
.query-builder .btn-danger:focus,
.query-builder .btn-danger:hover {
  color: #fff;
  background-color: #c9302c;
  border-color: #ac2925;
}

.query-builder .btn-group {
  position: relative;
  display: inline-block;
  vertical-align: middle;
}

.query-builder .btn-group > .btn {
  position: relative;
  float: left;
}

.query-builder .btn-group > .btn:first-child {
  margin-left: 0px;
}

.query-builder .btn-group > .btn:first-child:not(:last-child) {
  border-top-right-radius: 0px;
  border-bottom-right-radius: 0px;
}

.query-builder .btn-group > .btn:last-child:not(:first-child) {
  border-top-left-radius: 0px;
  border-bottom-left-radius: 0px;
}

.query-builder .btn-group .btn + .btn,
.query-builder .btn-group .btn + .btn-group,
.query-builder .btn-group .btn-group + .btn,
.query-builder .btn-group .btn-group + .btn-group {
  margin-left: -1px;
}

.query-builder .btn-xs,
.query-builder .btn-group-xs > .btn {
  padding: 1px 5px;
  font-size: 12px;
  line-height: 1.5;
  border-radius: 3px;
}

.rules-group-container {
  width: 100%;
}

.form-control {
  font-size: 12px;
  padding: 0 15px;
}
</style>
