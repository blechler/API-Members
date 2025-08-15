// Jest configuration for TypeScript with ES modules
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ES2022',
        target: 'ES2022'
      }
    }]
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: [
    '<rootDir>/__tests__/**/*.test.ts',
    '<rootDir>/tests/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ]
};