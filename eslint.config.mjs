import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import expoConfig from 'eslint-config-expo/flat.js';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const mobileModules = [
  'audio',
  'catalog',
  'debug',
  'diagnostics',
  'flow',
  'geofence',
  'history',
  'location',
  'notifications',
  'offline',
  'prefs',
  'routing',
  'saved',
];

const forbiddenByModule = {
  location: ['audio'],
  geofence: ['audio'],
  audio: ['location'],
};

function moduleBoundaryConfig(moduleName)
{
  const extraForbidden = forbiddenByModule[moduleName] ?? [];
  return {
    files: [`apps/mobile/src/modules/${moduleName}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@/ui', '@/ui/*', '@/app', '@/app/*', '@/composition', '@/composition/*'],
            message: 'Modules never import ui, routes or the composition root (NFR 7.2).',
          },
          {
            group: ['@/modules/*', `!@/modules/${moduleName}`, `!@/modules/${moduleName}/*`],
            message: 'Modules talk to each other only through core/events or interfaces in core (NFR 7.2).',
          },
          {
            group: ['../../*'],
            message: 'Use the @/ alias for imports outside this module.',
          },
          ...extraForbidden.map((name) => ({
            group: [`@/modules/${name}`, `@/modules/${name}/*`],
            message: `${moduleName} must not import ${name}.`,
          })),
        ],
      }],
    },
  };
}

const scoped = (configs, files) => configs.map((config) => ({ ...config, files }));

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'apps/mobile/.expo/**',
      'apps/cms/next-env.d.ts',
      'apps/cms/test-results/**',
      'apps/cms/playwright-report/**',
      'supabase/**',
      '**/*.config.js',
      'apps/mobile/babel.config.js',
      'apps/mobile/metro.config.js',
    ],
  },
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  ...scoped(expoConfig, ['apps/mobile/**/*.{js,jsx,ts,tsx}']),
  {
    files: ['apps/mobile/**/*.{js,jsx,ts,tsx}'],
    settings: {
      'import/resolver': {
        typescript: { project: 'apps/mobile/tsconfig.json' },
      },
    },
  },
  ...scoped(nextCoreWebVitals, ['apps/cms/**/*.{js,jsx,ts,tsx}']),
  {
    files: ['apps/cms/**/*.{js,jsx,ts,tsx}'],
    settings: { next: { rootDir: 'apps/cms' } },
  },
  ...tseslint.configs.recommended,
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/brace-style': ['error', 'allman', { allowSingleLine: false }],
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'anywhere' }],
      'no-restricted-syntax': ['error',
        {
          selector: 'MemberExpression[object.name=/^(it|test|describe)$/][property.name=/^(skip|only|todo)$/]',
          message: 'Skipped, focused or todo tests are not allowed.',
        },
        {
          selector: 'CallExpression[callee.name=/^(xit|xtest|xdescribe|fit|fdescribe)$/]',
          message: 'Skipped or focused tests are not allowed.',
        },
      ],
      eqeqeq: ['error', 'always'],
    },
  },
  ...mobileModules.map(moduleBoundaryConfig),
  {
    files: ['apps/mobile/src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/ui', '@/ui/*', '@/app', '@/app/*', '@/modules', '@/modules/*', '@/composition', '@/composition/*'],
          message: 'core is the bottom layer and imports nothing above it (NFR 7.2).',
        }],
      }],
    },
  },
  {
    files: ['packages/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['react', 'react-native', 'expo*', 'next', 'next/*'], message: 'Shared packages stay platform free.' }],
      }],
    },
  },
);
