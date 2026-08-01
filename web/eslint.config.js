import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// src/test/** holds vitest-only harnesses and fixtures; they live outside the
// app tsconfig project, so they lint under the untyped test config.
const testFiles = [
  'src/**/*.test.ts',
  'src/**/*.test.tsx',
  'src/test/**/*.ts',
  'src/test/**/*.tsx',
];

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'src/api/generated/**',
      'eslint.config.js',
      'vite.config.ts',
      'vitest.config.ts',
    ],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: testFiles,
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.app.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // Only the two classic hooks rules: the react-compiler rule set that ships
    // with the v7 "recommended" config flags standard React 18 patterns
    // (fetch-on-mount effects, ref mirrors) this codebase relies on.
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../../styles/formTokens',
              message: 'Use components/ui TextField, SelectField, or FieldLabel instead of formTokens.',
            },
            {
              name: '../../../styles/formTokens',
              message: 'Use components/ui TextField, SelectField, or FieldLabel instead of formTokens.',
            },
            {
              name: '../../../../styles/formTokens',
              message: 'Use components/ui TextField, SelectField, or FieldLabel instead of formTokens.',
            },
            {
              name: '../../../../../styles/formTokens',
              message: 'Use components/ui TextField, SelectField, or FieldLabel instead of formTokens.',
            },
            {
              name: '../../styles/theme',
              importNames: ['btnPrimary', 'btnSecondary', 'btnDanger', 'formInputStyle'],
              message: 'Use components/ui Button and field primitives instead of theme button/input exports.',
            },
          ],
          patterns: [
            {
              group: ['**/styles/formTokens'],
              message: 'Use components/ui field primitives instead of formTokens.',
            },
          ],
        },
      ],
      // `_name` is the codebase's marker for a deliberately unused binding
      // (contract-shaped props and parameters kept for the signature).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
    },
  },
  {
    files: ['src/board/**/*.ts', 'src/board/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/pages/**', '../pages/**', '../../pages/**', '../../../pages/**'],
              message: 'Board modules must not import from pages/ — use domain/ or components/ instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: testFiles,
    extends: [...tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'prefer-const': 'off',
    },
  },
);
