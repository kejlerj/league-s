# Webapp admin — design

Date : 2026-10-10

## But

Un back-office web pour gérer les ligues amateurs. Un admin doit pouvoir tenir une saison entière sans toucher à la base : équipes, joueurs, effectifs, calendrier, scores.

Deux rôles :

- **Superadmin** : voit toutes les ligues, les crée et les supprime, invite et retire les admins de ligue.
- **Admin** : ne voit que les ligues renvoyées par `GET /me` et y gère tout le reste.

## Décisions prises

| Sujet | Décision |
|---|---|
| Stack | Vite, React 19, TypeScript, Tailwind, React Router, TanStack Query |
| Livraison | Build statique embarqué dans le binaire Go avec `go:embed`, servi sous `/admin/` |
| Origine | Même origine que l'API. Pas de CORS en prod |
| Session | Cookie `session` `httpOnly` posé par l'API. La webapp ne stocke aucun jeton |
| Rôles | Admin par ligue, superadmin global |
| Périmètre v1 | Tout, y compris l'invitation des admins |
| Nouveaux admins | Invitation par lien à usage unique, valable 7 jours |
| Langue | Interface en français |

## API

L'API est dans `/Users/jeje/Documents/dev/go-blueprint/league-s` (session 6bb213). Tous les chemins commencent par `/api/v1`.

Conventions : JSON en snake_case, identifiants UUID, dates-heures en UTC (RFC 3339), dates simples `YYYY-MM-DD`.

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

Deux formes : `{"error": "message"}`, et pour la validation des champs (422) `{"errors": {"<champ>": "<règle>"}}`. JSON illisible : 400. Corps trop gros : 413. L'API refuse les champs inconnus.

`PATCH` : un champ absent n'est pas modifié. Vider un champ optionnel n'est pas possible en v1.

### Ressources existantes

- **League** : `{id, name, logo}`. Création : `{name, logo?}`.
- **Team** : `{id, league_id, name, logo}`. Création : `{name, logo?}`.
- **Player** : `{id, league_id, firstname, lastname, icon}`. Création : `{firstname, lastname, icon?}`.
- **Season** : `{id, league_id, name, start_on, end_on, match_win_pts, match_draw_pts, match_loss_pts, tie_breakers}`. `tie_breakers` parmi `goal_difference`, `goals_scored`, `head_to_head`, `fair_play`, `random`.
- **Équipes d'une saison** : `GET .../seasons/{seasonID}/teams`, `POST` et `DELETE .../teams/{teamID}`.
- **Effectif** : membre `{membership_id, player_id, firstname, lastname, icon, number, joined_on, left_on}`. Entrée `{player_id, number?, joined_on}`, numéro `{number}`, départ `{left_on}`, transfert `{player_id, from_team_id, to_team_id, number?, on}`. Dates au format `YYYY-MM-DD`.
- **Match** : `{id, season_id, home_team, away_team, matchday, kickoff_at, status, home_score, away_score, venue, referee, convocation_at, video_url}`. Programmer `{home_team_id, away_team_id, matchday, kickoff_at?, venue?}`. Actions : `start`, `score` (`{home, away}`), `finish`, `postpone` (`{kickoff_at?}`), `cancel`.
- **Classement** : lignes `{rank, team_id, team_name, played, won, drawn, lost, goals_for, goals_against, goal_difference, points}`.

### Endpoints manquants (contrat validé par 6bb213, pas encore implémenté)

| Méthode | Chemin | Accès | Corps | Réponse |
|---|---|---|---|---|
| `GET` | `/leagues/{leagueID}/admins` | admin | — | 200 liste de `{id, email, name}` |
| `DELETE` | `/leagues/{leagueID}/admins/{userID}` | superadmin | — | 204 |
| `POST` | `/leagues/{leagueID}/invitations` | superadmin | `{email}` | 201 `{id, email, expires_at, link}` ; 409 déjà admin de la ligue. Réinviter remplace l'invitation précédente |
| `GET` | `/leagues/{leagueID}/invitations` | superadmin | — | 200 liste des invitations en attente `{id, email, expires_at}` |
| `DELETE` | `/leagues/{leagueID}/invitations/{invitationID}` | superadmin | — | 204 |
| `POST` | `/invitations/lookup` | public | `{token}` | 200 `{email, league: {id, name}, account_exists}` ; 400 lien invalide, expiré ou déjà utilisé |
| `POST` | `/invitations/accept` | public | `{token, name, password}` si nouveau compte, `{token}` sinon | 204 ; 400 lien invalide ; 422 nom ou mot de passe manquant, ou règle de mot de passe |
| `PATCH` | `/leagues/{leagueID}` | admin | `{name?, logo?}` | 200 League |
| `PATCH` | `/leagues/{leagueID}/teams/{teamID}` | admin | `{name?, logo?}` | 200 Team |
| `DELETE` | `/leagues/{leagueID}/teams/{teamID}` | admin | — | 204 ; 409 si historique |
| `GET` | `/leagues/{leagueID}/players?q=` | public | — | 200 liste de Player |
| `PATCH` | `/leagues/{leagueID}/players/{playerID}` | admin | `{firstname?, lastname?, icon?}` | 200 Player |
| `DELETE` | `/leagues/{leagueID}/players/{playerID}` | admin | — | 204 ; 409 si historique |
| `PATCH` | `/leagues/{leagueID}/seasons/{seasonID}` | admin | champs de Season, tous optionnels | 200 Season |
| `DELETE` | `/leagues/{leagueID}/seasons/{seasonID}` | admin | — | 204 ; 409 si elle a des matchs |

Invitation : le superadmin invite une adresse sur une ligue. Le lien `{ADMIN_URL}/invitation?token=...` est à usage unique et valable 7 jours. Le jeton passe en paramètre puis dans le corps des requêtes, jamais dans un chemin, pour ne pas finir dans les logs. L'API renvoie le lien dans `link`, une seule fois, à la création. L'API n'envoie pas de mail d'invitation : la webapp affiche le lien avec un bouton « Copier le lien » et un lien `mailto:` prérempli. La personne choisit son nom et son mot de passe. Si l'adresse a déjà un compte, accepter rattache la ligue à ce compte, sans être connecté. Retirer un admin retire le droit sur la ligue, pas le compte. Il n'y a pas de `POST /users`.

Les écrans qui dépendent de ces endpoints sont codés contre ce contrat et testés avec des mocks. Ils fonctionnent en réel quand l'API les fournit.

## Architecture

### Emplacement

Sources dans `go-blueprint/league-s/admin/`, avec son propre `package.json`. `go:embed` exige que `dist` soit dans le module Go, d'où ce choix.

Côté Go, écrit par 6bb213 et pas par cette session : `admin/embed.go` avec `//go:embed all:dist`, et une route `GET /admin/*` qui sert les fichiers et retombe sur `index.html` pour les routes de la SPA.

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
| `/invitation?token=` | Accepter une invitation | public |
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
- **Admins** : liste visible par tous les admins de la ligue. Le superadmin invite une adresse e-mail, voit et annule les invitations en attente, et retire un admin.

### Dans une saison

- **Équipes inscrites** : inscrire, désinscrire.
- **Effectif** : faire entrer un joueur, changer le numéro, faire partir, transférer vers une autre équipe inscrite.
- **Matchs** : liste filtrable par journée et statut. Programmer, modifier, supprimer. Actions selon le statut :
  - `scheduled` : démarrer, reporter, annuler, modifier, supprimer.
  - `live` : saisir le score, terminer.
  - `finished`, `postponed`, `cancelled` : les actions que l'API accepte, à relever dans `internal/app/match/service.go` au moment du plan.
- **Classement** : lecture seule, rafraîchi après chaque action sur un match.

### Accepter une invitation

- La page appelle `POST /invitations/lookup` et affiche la ligue et l'adresse invitée.
- Nouveau compte : formulaire nom + mot de passe, puis redirection vers la connexion.
- Compte existant : un bouton « rejoindre la ligue », puis redirection vers la connexion.
- Lien invalide ou expiré : message clair, sans formulaire.

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

Aucun.

Réglé : l'utilisateur a confirmé l'embarqué et l'écriture dans `go-blueprint/league-s/admin/`. `admin/dist` n'est pas versionné, sauf un `.gitkeep`. `ADMIN_URL` accepte un chemin, donc `http://localhost:5173/admin` donne un lien vers `/admin/reset-password`.
