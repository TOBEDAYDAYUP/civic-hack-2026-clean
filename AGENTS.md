# Repository instructions

- Read CONTRIBUTING.md before editing. Keep each change limited to its assigned feature.
- Work in this clean repository. Do not merge or copy the old team-merged branch wholesale.
- Keep route files thin, feature UI under features/, and shared navigation under components/navigation/.
- Preserve the structured detail pages and their evidence/uncertainty distinctions. Do not replace them with one-sentence modals.
- No database migration or integration unless explicitly requested.
- Coordinate global CSS, package dependencies, shared types, and CityCouncilApp changes.
- Never commit secrets, node_modules, .next, or local generated notice data.
- Use the committed lockfile. Run npm run check before publishing changes.
- Do not claim branch protection is enabled without verifying GitHub settings.
