module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // ================================
    // Règles de base TypeScript strictes
    // ================================
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    
    // ================================
    // Règles de sécurité
    // ================================
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // ================================
    // Règles de qualité du code
    // ================================
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': ['error', 'never'],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    
    // ================================
    // Règles d'architecture Sylion
    // ================================
    'max-len': ['warn', { code: 120, ignoreComments: true, ignoreStrings: true }],
    'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
    'complexity': ['warn', { max: 15 }],
    'max-depth': ['warn', { max: 4 }],
    
    // ================================
    // Import et modules
    // ================================
    'no-duplicate-imports': 'error',
    'sort-imports': ['error', { 
      ignoreCase: true,
      ignoreDeclarationSort: true,
      ignoreMemberSort: false,
    }],
    
    // ================================
    // Async/Await
    // ================================
    'require-await': 'error',
    'no-return-await': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/promise-function-async': 'error',
    
    // ================================
    // Gestion des erreurs
    // ================================
    '@typescript-eslint/no-throw-literal': 'error',
    'no-unhandled-promise-rejection': 'off', // Handled by @typescript-eslint/no-floating-promises
    
    // ================================
    // Performance
    // ================================
    'no-loop-func': 'error',
    'no-await-in-loop': 'warn',
  },
  overrides: [
    // ================================
    // Configuration pour les fichiers de test
    // ================================
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'max-lines-per-function': 'off',
      },
    },
    // ================================
    // Configuration pour les migrations
    // ================================
    {
      files: ['src/db/migrations/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'prefer-const': 'off',
      },
    },
    // ================================
    // Configuration pour les fichiers de config
    // ================================
    {
      files: ['*.config.ts', '*.config.js', '.eslintrc.js'],
      env: {
        node: true,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    '*.js',
    '*.d.ts',
    '.next/',
    '.cache/',
    'public/',
  ],
};