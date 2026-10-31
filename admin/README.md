# Admin

Back-office de la ligue. SPA Vite + React, embarquée dans le binaire Go et servie sous `/admin/`.

## Commandes

```bash
npm ci
npm run dev
npm test -- --run
npx tsc -b
npm run build
```

- `npm run dev` : http://localhost:5173/admin/, avec un proxy de `/api` vers `http://localhost:8080`.
- `npm run build` : écrit `dist/`, que `embed.go` embarque au `go build`. Relancer l'API après un build.

## Configuration côté API

`ADMIN_URL` doit pointer sur la racine de l'admin, préfixe compris :

- dev : `http://localhost:5173/admin`
- prod : `https://<hôte>/admin`

Les liens de réinitialisation (`/reset-password?token=`) et d'invitation (`/invitation?token=`) sont construits à partir de cette valeur.

## Organisation

- `src/api` : client `fetch` et un module par ressource.
- `src/auth` : session courante et gardes de routes.
- `src/features` : pages et formulaires, un dossier par ressource.
- `src/ui` : composants de présentation.
- `src/test` : serveur MSW, données de test, `renderRoute`.
