import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import vue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-zip'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  vue.configs['flat/recommended'],
  { languageOptions: { globals: { ...globals.browser, ...globals.node, chrome: 'readonly' } } },
  { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: tseslint.parser } } },
  // The rule editor edits the rule tree in place, the tree is owned by the options page.
  { files: ['src/options/RuleNode.vue'], rules: { 'vue/no-mutating-props': 'off' } },
  { rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
  prettier
);
