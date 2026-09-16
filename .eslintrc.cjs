module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react-refresh'],
  ignorePatterns: ['dist', 'node_modules', 'scripts', '*.cjs', '*.config.js', '*.config.ts'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // Un contexte React exporte par nature deux choses : le composant fournisseur et
      // le hook qui le consomme. La règle de rafraîchissement à chaud signale cette
      // cohabitation, qui est ici volontaire. Séparer les deux imposerait trois fichiers
      // par contexte pour un gain nul sur une application de cette taille.
      files: ['src/context/*.tsx', 'src/components/ui/Toast.tsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
};
