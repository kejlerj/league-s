# Webapp admin — design

Date : 2026-10-10

## But

Un back-office web pour gérer les ligues amateurs. Un admin doit pouvoir tenir une saison entière sans toucher à la base : équipes, joueurs, effectifs, calendrier, scores.

Deux rôles :

- **Superadmin** : voit toutes les ligues, les crée et les supprime, crée les comptes et nomme les admins de ligue.
- **Admin** : ne voit que les ligues renvoyées par `GET /me` et y gère tout le reste.

## Décisions prises

| Sujet | Décision |
|---|---|
| Stack | Vite, React 19, TypeScript, Tailwind, React Router, TanStack Query |
| Livraison | Build statique embarqué dans le binaire Go avec `go:embed`, servi sous `/admin/` |
| Origine | Même origine que l'API. Pas de CORS en prod |
| Session | Cookie `session` `httpOnly` posé par l'API. La webapp ne stocke aucun jeton |
| Rôles | Admin par ligue, superadmin global |
| Périmètre v1 | Tout, y compris la gestion des comptes admin |
| Langue | Interface en français |

## API

L'API est dans `/Users/jeje/Documents/dev/go-blueprint/league-s` (session 6bb213). Tous les chemins commencent par `/api/v1`. Référence : `plan/endpoints.md` de ce repo.

### Auth (existant)

| Méthode | Chemin | Corps | Réponse |
|---|---|---|---|
| `POST` | `/auth/login` | `{email, password}` | 200 `{id, email, name, is_superadmin}` + cookie `session` ; 401 si identifiants faux |
| `POST` | `/auth/logout` | — | 204 |
| `GET` | `/me` | — | 200 `{id, email, name, is_superadmin, leagues: [{id, name}]}` ; 401 |
| `PUT` | `/me/password` | `{current_password, new_password}` | 204 ; 403 mot de passe actuel faux ; 422 règle de mot de passe |
| `POST` | `/auth/password-reset` | `{email}` | 204 dans tous les cas |
| `POST` | `/auth/password-reset/confirm` | `{token, password}` | 204 ; 400 lien invalide ; 422 règle de mot de passe |

Règle de mot de passe : 10 caractères minimum, 72 octets maximum. Le login est limité à 10 requêtes par minute et par IP.

### Autorisations

- Les lectures (`GET`) sont publiques.
- Écritures sous `/leagues/{leagueID}/...` : admin de cette ligue ou superadmin. Sinon 401 (non connecté) ou 403.
- `POST /leagues` et `DELETE /leagues/{leagueID}` : superadmin.

### Erreurs

Toutes les erreurs ont la forme `{"error": "message"}`.

### Ressources existantes

- **League** : `{id, name, logo}`. Création : `{name, logo?}`.
- **Team** : `{id, league_id, name, logo}`. Création : `{name, logo?}`.
- **Player** : `{id, league_id, firstname, lastname, icon}`. Création : `{firstname, lastname, icon?}`.
- **Season** : `{id, league_id, name, start_on, end_on, match_win_pts, match_draw_pts, match_loss_pts, tie_breakers}`. `tie_breakers` parmi `goal_difference`, `goals_scored`, `head_to_head`, `fair_play`, `random`.
- **Équipes d'une saison** : `GET .../seasons/{seasonID}/teams`, `POST` et `DELETE .../teams/{teamID}`.
- **Effectif** : membre `{membership_id, player_id, firstname, lastname, icon, number, joined_on, left_on}`. Entrée `{player_id, number?, joined_on}`, numéro `{number}`, départ `{left_on}`, transfert `{player_id, from_team_id, to_team_id, number?, on}`. Dates au format `YYYY-MM-DD`.
- **Match** : `{id, season_id, home_team, away_team, matchday, kickoff_at, status, home_score, away_score, venue, referee, convocation_at, video_url}`. Programmer `{home_team_id, away_team_id, matchday, kickoff_at?, venue?}`. Actions : `start`, `score` (`{home, away}`), `finish`, `postpone` (`{kickoff_at?}`), `cancel`.
- **Classement** : lignes `{rank, team_id, team_name, played, won, drawn, lost, goals_for, goals_against, goal_difference, points}`.

### Endpoints manquants (contrat proposé, à confirmer avec 6bb213)

| Méthode | Chemin | Accès | Corps | Réponse |
|---|---|---|---|---|
| `POST` | `/users` | superadmin | `{email, name}` | 201 `{id, email, name, is_superadmin}` ; 409 e-mail déjà pris |
| `GET` | `/users` | superadmin | — | 200 liste de `{id, email, name, is_superadmin}` |
| `GET` | `/leagues/{leagueID}/admins` | admin | — | 200 liste de `{id, email, name}` |
| `POST` | `/leagues/{leagueID}/admins` | superadmin | `{user_id}` | 204 |
| `DELETE` | `/leagues/{leagueID}/admins/{userID}` | superadmin | — | 204 |
| `PATCH` | `/leagues/{leagueID}` | admin | `{name?, logo?}` | 200 League |
| `PATCH` | `/leagues/{leagueID}/teams/{teamID}` | admin | `{name?, logo?}` | 200 Team |
| `DELETE` | `/leagues/{leagueID}/teams/{teamID}` | admin | — | 204 ; 409 si historique |
| `GET` | `/leagues/{leagueID}/players?q=` | public | — | 200 liste de Player |
| `PATCH` | `/leagues/{leagueID}/players/{playerID}` | admin | `{firstname?, lastname?, icon?}` | 200 Player |
| `DELETE` | `/leagues/{leagueID}/players/{playerID}` | admin | — | 204 ; 409 si historique |
| `PATCH` | `/leagues/{leagueID}/seasons/{seasonID}` | admin | champs de Season, tous optionnels | 200 Season |
| `DELETE` | `/leagues/{leagueID}/seasons/{seasonID}` | admin | — | 204 ; 409 si elle a des matchs |

Hypothèse sur le premier mot de passe : `POST /users` ne prend pas de mot de passe. L'API envoie un e-mail de réinitialisation et le nouvel admin choisit son mot de passe sur `/admin/reset-password`.

Les écrans qui dépendent de ces endpoints sont codés contre ce contrat et testés avec des mocks. Ils fonctionnent en réel quand l'API les fournit.

## Architecture

### Emplacement

Sources dans `go-blueprint/league-s/admin/`, avec son propre `package.json`. `go:embed` exige que `dist` soit dans le module Go, d'où ce choix. À confirmer avec 6bb213.

Côté Go (écrit par 6bb213) : `admin/embed.go` avec `//go:embed all:dist`, et une route `GET /admin/*` qui sert les fichiers et retombe sur `index.html` pour les routes de la SPA.

### Dev et prod

- **Dev** : serveur Vite sur `localhost:5173`, `base: '/admin/'`, proxy de `/api` vers `localhost:8080`. Le cookie passe par le proxy, donc même origine aussi en dev.
- **Prod** : `npm run build` produit `admin/dist`, embarqué dans le binaire.
- `ADMIN_URL` côté API doit valoir `http://localhost:5173/admin` en dev et `https://<hôte>/admin` en prod, pour que le lien de réinitialisation pointe sur `/admin/reset-password?token=`.

### Structure

```
admin/
  src/
    api/         client fetch, types, un fichier par ressource
    auth/        session courante, gardes de routes
    features/    un dossier par ressource : pages et formulaires
    ui/          table, champ, modale, bouton, bandeau d'erreur
    routes.tsx
    main.tsx
```

Chaque unité a un rôle :

- `api/client.ts` : `fetch` avec `credentials: 'same-origin'`, encodage des segments d'URL, conversion des réponses non-2xx en `ApiError {status, message}`.
- `api/<ressource>.ts` : fonctions typées, sans état.
- `auth/` : charge `GET /me`, expose l'utilisateur et `canWrite(leagueId)`, `isSuperadmin`.
- `features/` : pages qui combinent requêtes TanStack Query et composants `ui/`.
- `ui/` : composants de présentation sans appel réseau.

## Routes

Toutes sous `/admin`.

| Route | Écran | Accès |
|---|---|---|
| `/login` | Connexion | public |
| `/forgot-password` | Demande de lien | public |
| `/reset-password?token=` | Nouveau mot de passe | public |
| `/` | Liste des ligues | connecté |
| `/account` | Changer son mot de passe | connecté |
| `/users` | Comptes | superadmin |
| `/leagues/:leagueId` | Ligue : équipes, joueurs, saisons, admins | admin de la ligue |
| `/leagues/:leagueId/seasons/:seasonId` | Saison : équipes inscrites, matchs, classement | admin de la ligue |
| `/leagues/:leagueId/seasons/:seasonId/teams/:teamId` | Effectif | admin de la ligue |

## Comportements

### Auth

- Au démarrage, `GET /me`. Un 401 redirige vers `/login` en gardant la page demandée pour y revenir après connexion.
- Un 401 sur un appel quelconque vide la session et renvoie au login.
- Un 403 affiche « accès refusé » sans déconnecter.
- Une route `/leagues/:leagueId` pour une ligue non administrée affiche « accès refusé ».
- Un admin avec une seule ligue est redirigé de `/` vers cette ligue.

### Ligues

- Superadmin : liste complète (`GET /leagues`), création, suppression avec confirmation. Un 409 à la suppression affiche « cette ligue a un historique ».
- Admin : liste issue de `GET /me`.

### Dans une ligue

- **Équipes** et **joueurs** : liste, création, modification, suppression.
- **Saisons** : liste, création (dates, barème de points, départages), modification, suppression.
- **Admins** : liste visible par tous les admins de la ligue. Ajout (choix d'un compte existant) et retrait par le superadmin.

### Dans une saison

- **Équipes inscrites** : inscrire, désinscrire.
- **Effectif** : faire entrer un joueur, changer le numéro, faire partir, transférer vers une autre équipe inscrite.
- **Matchs** : liste filtrable par journée et statut. Programmer, modifier, supprimer. Actions selon le statut :
  - `scheduled` : démarrer, reporter, annuler, modifier, supprimer.
  - `live` : saisir le score, terminer.
  - `finished`, `postponed`, `cancelled` : les actions que l'API accepte, à relever dans `internal/app/match/service.go` au moment du plan.
- **Classement** : lecture seule, rafraîchi après chaque action sur un match.

### Comptes (superadmin)

- Liste des comptes, création (`email`, `name`).
- Après création, message : « un e-mail a été envoyé pour choisir le mot de passe ».

## Erreurs

- 400, 409, 422 : message de l'API affiché dans le formulaire.
- 403 : « accès refusé ».
- 404 : page « introuvable ».
- 5xx et panne réseau : bandeau générique avec bouton « réessayer ».
- Pendant une écriture, le bouton est désactivé pour éviter le double envoi.

## Tests

- Vitest + Testing Library, API simulée avec MSW.
- `api/client` : construction des URL, conversion des erreurs.
- `auth` : redirection sur 401, garde superadmin, garde par ligue.
- Un test par page pour le chemin nominal et un cas d'erreur.
- Matchs : les actions affichées pour chaque statut.

## Vérification finale

Une fois la webapp terminée et l'API à jour :

1. Créer un jeu de données réel via la webapp : une ligue, une saison, des équipes, des joueurs, des effectifs, des matchs avec scores.
2. Avec la session 6bb213 (API) et la session 7d0da1 (app mobile), vérifier que l'app mobile affiche correctement ces données : suivi, classement, équipe, match.

## Hors périmètre v1

- Envoi de fichiers pour les logos (l'API attend une URL).
- Pagination (l'API n'en a pas).
- Journal d'audit, multilingue.

## Points ouverts

1. Emplacement `go-blueprint/league-s/admin/` : attente de l'accord de 6bb213.
2. Contrat des endpoints manquants : proposé ci-dessus, à valider par 6bb213.
3. Premier mot de passe d'un admin : hypothèse « e-mail de réinitialisation ».
4. Valeur de `ADMIN_URL` avec le préfixe `/admin`.
