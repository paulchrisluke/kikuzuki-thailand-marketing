import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: [
      '.data/**',
      '.nuxt/**',
      '.output/**',
      '.wrangler/**',
      'dist/**'
    ]
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      'import/first': 'off',
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'no-unused-vars': 'off',
      'nuxt/prefer-import-meta': 'off',
      'prefer-const': 'off',
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-self-closing': 'off',
      'vue/no-multiple-template-root': 'off',
      'vue/no-template-shadow': 'off',
      'vue/no-v-html': 'off',
      'vue/no-v-text-v-html-on-component': 'off',
      'vue/require-default-prop': 'off'
    }
  }
)
