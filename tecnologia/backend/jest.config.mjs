const base = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: { '^.+\\.tsx?$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true }, target: 'es2023' }, module: { type: 'es6' } }] },
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  setupFilesAfterEnv: ['<rootDir>/test/soporte/jest.ts'],
};

const seleccionado = process.argv[process.argv.indexOf('--selectProjects') + 1];
const grupo = ['unit', 'integration', 'contract'].includes(seleccionado) ? seleccionado : 'todos';
export default {
  projects: ['unit', 'integration', 'contract'].map((name) => ({ ...base, displayName: name, testMatch: [`<rootDir>/test/${name}/**/*.spec.ts`] })),
  reporters: ['default', ['jest-junit', { outputDirectory: '../.local/evidencia/001', outputName: `backend-${grupo}-junit.xml`, includeConsoleOutput: false }]],
};
