// ESLint flat config (ES module)
import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
	{
		ignores: [
			'node_modules/**',
			'.meteor/**',
			'types/**',
			'package-lock.json',
		],
	},
	js.configs.recommended,
	{
		files: ['**/*.{js,jsx,ts,tsx}'],
		languageOptions: {
			ecmaVersion: 2021,
			sourceType: 'module',
			parser: tsParser,
			globals: {
				document: 'readonly',
				console: 'readonly',
				window: 'readonly',
				localStorage: 'readonly',
				navigator: 'readonly',
				Image: 'readonly',
				setTimeout: 'readonly',
				Blaze: 'readonly',
				Buffer: 'readonly',
				process: 'readonly',
				require: 'readonly',
			},
		},
		plugins: { react: reactPlugin, '@typescript-eslint': tsPlugin },
		settings: { react: { version: 'detect' } },
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
			'no-undef': 'error',
			'no-console': 'off',
			'eqeqeq': ['error', 'always'],
			'curly': ['error', 'all'],
			'no-var': 'error',
			'indent': ['error', 'tab', { SwitchCase: 1 }],
			'no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],
			'eol-last': ['error', 'always'],
			'no-trailing-spaces': 'error',
			'object-curly-spacing': ['error', 'always'],
			'array-bracket-spacing': ['error', 'never'],
			'comma-dangle': ['error', 'always-multiline'],
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
		},
	},
];
