module.exports = {
  $schema: 'https://typedoc.org/schema.json',
  entryPoints: ['../pipet.ts'],
  out: '../docs',
  readme: '../readme.docs.md',
  darkHighlightTheme: 'rose-pine',
  excludeInternal: true,
  excludePrivate: true,
  excludeProtected: true,
  excludeExternals: true,
}
