import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import { configs as typescriptConfigs } from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist', 'docs', 'coverage'] },
  js.configs.recommended,
  typescriptConfigs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  prettierRecommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.jest },
    },
    settings: {
      'import/resolver': { typescript: true, node: true },
    },
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      'import/extensions': [
        'error',
        'ignorePackages',
        { js: 'never', ts: 'never' },
      ],
    },
  }
);
