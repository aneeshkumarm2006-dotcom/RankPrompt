import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const restrict = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default tseslint.config(
  {
    // v1 is reference only (CLAUDE.md); docs are not code.
    ignores: [
      'backend/**',
      'frontend/**',
      'new-improvement/**',
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: [
      '**/*.js',
      '**/*.mjs',
      'apps/server/**',
      'packages/**',
      '**/*.config.ts',
      'apps/web/middleware.ts',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },

  // ---- Import boundaries (01 § Dependency rules, 07 § workspace isolation) ----
  {
    files: ['packages/shared/**/*.ts'],
    rules: restrict([
      {
        group: ['@pv/*', 'mongoose', 'express', 'express/*'],
        message: 'packages/shared depends on nothing internal and has no server dependencies.',
      },
    ]),
  },
  {
    files: ['packages/engine/**/*.ts'],
    rules: restrict([
      {
        group: ['@pv/server', '@pv/server/*', '@pv/web', '@pv/web/*', 'mongoose', 'express'],
        message:
          'packages/engine depends on @pv/shared only; it knows nothing about Mongo or Express.',
      },
    ]),
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: restrict([
      {
        group: ['@pv/engine', '@pv/engine/*', '@pv/server', '@pv/server/*', 'mongoose', 'express'],
        message: 'apps/web may depend on @pv/shared only, never on engine or server code.',
      },
    ]),
  },
  {
    files: ['apps/server/src/**/*.ts'],
    ignores: ['apps/server/src/**/repo.ts'],
    rules: restrict([
      {
        group: ['**/model', '**/model.js', '**/model.ts'],
        message: 'Only the module’s own repo.ts may import its model.ts (07). Go through the repo.',
      },
    ]),
  },
  {
    files: ['apps/server/src/**/repo.ts'],
    rules: restrict([
      {
        group: ['**/model', '**/model.js', '**/model.ts', '!./model', '!./model.js', '!./model.ts'],
        message: 'A repo may import only its own module’s ./model (07).',
      },
    ]),
  },
);
