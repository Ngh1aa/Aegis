import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/**', 'test-results/**', 'playwright-report/**'] },
  { files: ['**/*.ts', '**/*.tsx'], ...js.configs.recommended },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': hooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]
