/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  $schema: 'https://typedoc.org/schema.json',
  name: '⚡ pipet',
  entryPoints: ['../index.ts'],
  out: '../docs',
  customCss: './typedoc.css',
  readme: '../readme.docs.md',
  darkHighlightTheme: 'rose-pine-moon',
  navigationLinks: {
    Repository: 'https://github.com/jliocsar/pipet',
  },
  gitRemote: 'origin',
  excludeInternal: true,
  excludePrivate: true,
  excludeProtected: true,
  excludeExternals: true,
}
