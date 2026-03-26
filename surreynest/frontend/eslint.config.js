import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

const browserGlobals = {
    alert: 'readonly',
    clearTimeout: 'readonly',
    confirm: 'readonly',
    console: 'readonly',
    document: 'readonly',
    fetch: 'readonly',
    FormData: 'readonly',
    HTMLElement: 'readonly',
    IntersectionObserver: 'readonly',
    localStorage: 'readonly',
    navigator: 'readonly',
    Node: 'readonly',
    ResizeObserver: 'readonly',
    setTimeout: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    window: 'readonly',
}

export default [
    {
        ignores: ['dist/**', 'node_modules/**'],
    },
    {
        files: ['src/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: browserGlobals,
        },
        plugins: {
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            ...reactPlugin.configs.recommended.rules,
            ...reactHooksPlugin.configs.recommended.rules,
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
            'react/no-unescaped-entities': 'off',
            'react/prop-types': 'off',
            'react/react-in-jsx-scope': 'off',
        },
    },
]
