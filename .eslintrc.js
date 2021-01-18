// https://eslint.org/docs/user-guide/configuring
// File taken from https://github.com/vuejs-templates/webpack/blob/1.3.1/template/.eslintrc.js, thanks.

module.exports = {
  root: true,
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
  },
  env: {
    browser: true,
    webextensions: true,
    jest: true,
    node: true,
  },
  globals: {
    global: 'readonly',
    chrome: 'readonly',
  },
  extends: ['plugin:vue/vue3-essential', 'eslint:recommended', '@vue/typescript/recommended', '@vue/prettier', '@vue/prettier/@typescript-eslint'],
  ignorePatterns: ['dist'],
  // add your custom rules here
  rules: {
    // allow async-await
    'generator-star-spacing': 'off',
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-unused-vars': ['warn', {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
    '@typescript-eslint/no-unused-vars': ['warn', {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
  },
};
