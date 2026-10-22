# JORATA deployment

Existing Vercel project `j-mind` (`prj_gcx2ocyInULrQpyomxtQ7rzcqamh`), team `jovan-tioria-s-projects` (`team_ntipgViAjbHQfxs5e3HuvGGj`). Production domain https://jorata.vercel.app.

Repository https://github.com/Jorataa/Jorata; project root `jorata-game`; Vite, Node 24, `npm ci`, `npm run build`, output `dist`. Static hosting only. No server functions or environment values are required. Existing secrets are not bundled or used; do not copy `.env.local` into deployment artifacts.

Release procedure: run unit tests/build and browser stories, commit only the scoped app, push a nonproduction branch, create a preview on the existing project, verify hosted stories, promote the tested deployment, verify production again.

Old production rollback reference: `dpl_mzMvc97TvzRALHg5BLehvd6NbG8H` / https://j-mind-ms0tmah9h-jovan-tioria-s-projects.vercel.app. A rollback restores the old chat app and should be used only for a release emergency.

Pre-rebuild recoverability: branch `backup/pre-play-notes-20261022`; `../rebuild-backups/repository.bundle`, `workspace.patch`, and `jorata-game-working-tree.tar.gz` preserve Git history and the initial working tree. Private local `.env.local` and ignored data files remain untouched in the workspace. Keep the archive outside the deployable app. No remote database data was deleted; this source archive is not a database backup.

See `rebuild-audit.md` for shared infrastructure and deferred remote retirement.
