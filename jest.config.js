module.exports = {
  moduleFileExtensions: ['js', 'json'],

  transform: {
    '^.+\\.(js|jsx)?$': 'babel-jest',
  },

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  testMatch: [
    '<rootDir>/tests/**/*.spec.js',
    '<rootDir>/tests/**/*.spec.ts',
  ],

  transformIgnorePatterns: ['<rootDir>/node_modules/(?!(bootstrap-vue)/)'],
};
