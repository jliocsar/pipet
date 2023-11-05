module.exports = {
  $schema: 'https://typedoc.org/schema.json',
  name: 'pipet',
  entryPoints: ['../pipet.ts'],
  out: '../docs',
  readme: '../readme.docs.md',
  darkHighlightTheme: 'rose-pine',
  navigationLinks: {
    Repository: 'https://github.com/jliocsar/pipet',
  },
  gitRemote: 'origin',
  excludeInternal: true,
  excludePrivate: true,
  excludeProtected: true,
  excludeExternals: true,
}
