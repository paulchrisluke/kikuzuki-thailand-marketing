/** @type {import('vetur').VeturConfig} */
module.exports = {
  settings: {
    'vetur.useWorkspaceDependencies': true,
    'vetur.validation.templateProps': false,
    'vetur.validation.style': true,
    'vetur.ignoreProjectWarning': false,
    'vetur.underline.dep': false
  },
  projects: [
    {
      root: './',
      package: './package.json',
      tsconfig: './tsconfig.json',
      globalComponents: [
        './components/**/*.vue'
      ]
    }
  ]
}
