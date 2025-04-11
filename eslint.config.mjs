import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import jest from 'eslint-plugin-jest';

export default defineConfig([
    globalIgnores(['client/*', 'invite/*', 'coverage/*']),
    {
        files: ['**/*.test.js'],
        ...jest.configs['flat/recommended'],
        rules: {
            ...jest.configs['flat/recommended'].rules,
            'jest/consistent-test-it': 'warn',
            'jest/expect-expect': 'warn',
            'jest/max-nested-describe': 1,
            'jest/no-standalone-expect': 'warn',
            'jest/prefer-expect-assertions': 'warn',
            'jest/prefer-importing-jest-globals': 'error',
            'jest/prefer-lowercase-title': 'warn',
            'jest/prefer-to-have-length': 'warn',
            'jest/require-to-throw-message': 'warn',
            'jest/no-done-callback': 'off',
        },
    },
    {
        files: ['**/*.js'],
        rules: {
            'no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
            ],
        },
    },
    {
        files: ['**/*.{js,mjs,cjs}'],
        plugins: { js },
        extends: ['js/recommended'],
    },
    { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
    {
        files: ['**/*.{js,mjs,cjs}'],
        languageOptions: { globals: globals.browser },
    },
]);
