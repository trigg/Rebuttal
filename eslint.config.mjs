import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';
import jest from 'eslint-plugin-jest';

export default defineConfig([
    {
        ignores: [
            '*.mjs' /* Non-project extras like eslint, babel etc */,
            '*.js',
            '**/*-ti.ts' /* Skip compiled files */,
        ],
    },
    globalIgnores(['webapp/*', 'invite/*', 'coverage/*']),
    {
        files: ['tests/**/*.test.js'] /* Specific rules for tests */,
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
        },
    },
    {
        files: ['**/*.ts'],
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'variableLike',
                    format: ['snake_case'],
                    leadingUnderscore: 'allow',
                },
            ],
        },
    },
    eslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
            },
        },
    },
]);
