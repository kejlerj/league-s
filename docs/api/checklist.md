# Checklist league-s

## ✅ Fait

- [x] **Infrastructure** : Postgres dans Docker, `pgxpool`, goose (`make migrate-*`), sqlc (avec `time.Time` via les `overrides`), gotestsum
- [x] **Schéma** : 7 tables, multi-tenant par ligue, clés composites, index, enum `match_status`
- [x] **Domaines** : `league`, `team`, `player`, `season` (avec `season_team`), chacun avec son handler, son store, sa validation et la traduction de ses erreurs
- [x] **Seeder de test** : `testdb.New(t, pool)` (base vidée + seeder), ligue par défaut, options (`WithName`, `InLeague`…), plus aucun ID en dur dans les tests de domaine
- [x] **Tests** : 94 tests d'intégration, les helpers `testdb` et `testhttp`, le tag `integration`, `make test` et `make itest`
- [x] **Config** : package `internal/config` (lecture et validation de l'environnement, DSN échappée), `database.New(ctx, dsn)`, `server.NewServer(port, db)`, 13 tests unitaires
- [x] **Lint** : golangci-lint v2 (`.golangci.yml`, `make lint`, `make fmt`, job de CI), imports groupés avec `gci` et `goimports`
- [x] **CI** : `.github/workflows/ci.yml` (vérifié avec actionlint, pas encore poussé)
- [x] **README** : schéma, notes de conception, endpoints
- [x] **Stack locale et données de démo** : `make dev-up` (Postgres, migrations, API) et `make seed` (`cmd/seed`, package `internal/demo`) : une ligue de démo, 10 équipes de 8 joueurs, deux saisons aller-retour, IDs fixes pour les tests E2E

## 🔜 Avant le prochain commit

- [x] **Recréer la base locale** : migrations renumérotées, passage à Postgres 18 et aux UUID v7
  - `docker compose down -v`, `make docker-run`, puis `make migrate-up`
- [ ] **Commiter et pousser**, puis vérifier que les deux jobs de CI passent sur GitHub
  - premier vrai test de testcontainers sur les runners GitHub
- [x] **Ajouter un `.env.example`** avec les variables attendues, sans vrais secrets
- [x] **Corriger une incohérence** : la valeur par défaut de `tie_breakers` en base est `{goal_difference,goals_for}`, mais le validator n'accepte que `goals_scored`
  - choisir un seul nom, sinon une saison créée avec les valeurs par défaut ne pourra plus être renvoyée telle quelle à l'API

## 🧹 Dette technique

- [ ] **Une seule saison à la fois par ligue** (voir `spec.md`) : contrainte de non-chevauchement sur `season`
  - `EXCLUDE USING gist (league_id WITH =, daterange(start_on, end_on, '[]') WITH &&)`, avec `btree_gist` (décision 008)
  - la traduire en 409 dans `season.CreateError`
- [x] **Les points par défaut d'une saison** : si le client omet `match_win_pts`…, la saison est créée avec 0/0/0 au lieu de 3/1/0
  - pointeurs dans le DTO, ou valeurs par défaut appliquées dans le handler
- [ ] **Des messages de validation lisibles** : `httpx.Decode` renvoie encore le tag brut (`"required"`, `"url"`)
- [ ] **Des dates au format `2025-08-01`** dans les DTO de saison, au lieu de `time.Time` complet
  - `string` avec `validate:"datetime=2006-01-02"`, puis `time.Parse(time.DateOnly, …)`
- [x] **Les codes HTTP** : 201 pour l'inscription d'une équipe, 204 pour la désinscription
  - mettre à jour les tests en même temps
- [ ] **Les endpoints de liste manquants** : saisons d'une ligue (`GetByLeague` existe déjà), équipes et joueurs d'une ligue
  - penser à la pagination dès le début (`limit`, `offset`, ou par curseur)
- [ ] **Modification et suppression** (`PATCH` / `DELETE`) pour `league`, `team`, `player` et `season`
  - mettre `updated_at = now()` dans chaque `UPDATE`
  - `RESTRICT` renverra une violation de clé étrangère si la ressource a un historique : la traduire en 409
- [ ] **Un helper pour les erreurs Postgres** (`database.ConstraintName(err)`), dès qu'il sera répété dans `squadmembership`

## ⚽ Squad (effectifs)

- [x] **Créer le package `internal/app/squadmembership`** : types, erreurs par opération, requêtes SQL et store (`Join`, `Leave`, `Active`, `List`, `WithTx`)
  - `SquadPlayer` et `GetByTeamAndSeason` retirés de `player`, remplacés par `squadmembership.Member` et `List`
- [x] **Les routes** sous `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad`, et `/transfers` sous la saison
  - faire entrer un joueur, le faire partir (`left_on`), lister l'effectif (actifs par défaut, option pour tout l'historique)
- [x] **Toujours insérer `league_id`**, pris dans l'URL : les clés composites en ont besoin
- [x] **Les IDs dans le body** (`player_id`…) : un champ `string` avec `validate:"required,uuid"`, puis `uuid.Parse`
  - pas de champ `uuid.UUID` directement dans le DTO : le décodage JSON accepterait les formats non standards (`urn:uuid:`, accolades, sans tirets)
- [x] **Traduire les erreurs par nom de contrainte** (dans le store, codes HTTP à choisir dans le handler)
  - `squad_membership_active_number` → numéro déjà pris (409)
  - `squad_membership_active_player` → joueur déjà actif dans une équipe cette saison (409)
  - `squad_membership_player_fkey` → joueur inconnu ou d'une autre ligue (404)
  - `squad_membership_season_team_fkey` → équipe non inscrite à la saison (404 ou 422)
- [x] **Le transfert** = un départ suivi d'une arrivée, dans une transaction
  - `Service.Transfer` passe par `store.InTx`, et applique les mêmes règles que `Join` et `Leave`
- [x] **Valider les dates** : `joined_on` et `left_on` pendant la saison (`SquadRules.CheckJoin` et `CheckLeave`, appelées par le service)
- [x] **La taille maximale de l'effectif** : `Service.Join` verrouille `season_team`, compte les actifs, puis décide (`ErrJoinSquadFull`)
  - `left_on` après `joined_on` : déjà garanti par la contrainte `squad_membership_left_after_joined`, traduite en `ErrLeaveBeforeJoining`
- [x] **Des tests de store directs** pour les transferts, là où l'API seule est pénible à préparer
- [ ] Optionnel : le club actuel dans `GET /players/{playerID}` (requête avec `LEFT JOIN`, pas `LATERAL`)

## 🥅 Match

- [x] **L'entité avec ses règles** : `match.New`, `Start`, `SetScore`, `Finish`, `Postpone`, `Reschedule`, `Cancel`, `Winner`
  - des tests unitaires sans tag
- [x] **Un service** pour le cycle « charger → appliquer la règle → sauvegarder »
- [x] **Traduire l'enum** `db.MatchStatus` vers `match.Status` dans le store
- [x] **Les routes** sous `/leagues/{leagueID}/seasons/{seasonID}/matches`
  - le calendrier : filtres `matchday`, `team`, `from` et `to`, avec `sqlc.narg`
- [x] **⚠️ Le filtrage par ligue** : `match` n'a pas de `league_id`
  - chaque lecture joint `season` et filtre sur `season.league_id`
  - testé : un match est introuvable depuis l'URL d'une autre ligue
- [x] **Les erreurs** : `match_home_team_fkey` ou `match_away_team_fkey` → équipe non inscrite (422)
- [x] **Les règles de calendrier dans le service** : une seule rencontre par équipe et par journée, coup d'envoi pendant la saison

## 📊 Classement

- [x] **`standing.Compute(teams, matches, rules)`** : une fonction pure qui réutilise `Match.Winner()`
- [x] **Des tests unitaires table-driven**
- [x] **Les départages dans l'ordre défini par la saison** : différence de buts, buts marqués, confrontation directe
  - la confrontation directe est le cas le plus délicat, avec plusieurs équipes à égalité
  - `fair_play` et `random` restent à décider : ils sont ignorés pour l'instant
- [x] **L'endpoint** `GET /leagues/{leagueID}/seasons/{seasonID}/standings`, qui ne compte que les matchs `finished`

## 🧪 Tests de scénario

- [ ] **Le package `internal/scenario`**, sur le vrai routeur (le package `config` est prêt)
- [ ] **3 à 5 parcours** : une saison complète jusqu'au classement, un transfert en cours de saison, un match reporté
- [ ] **Étendre le seeder** (`internal/testdb/seed.go`) à chaque nouveau domaine : `s.SquadMember(...)` avec `squad`, un vrai `s.Match(...)` avec options (score, statut) avec `match`

## 🔐 Authentification et rôles

- [x] **Les tables** `app_user` (avec `is_superadmin`), `league_admin (user_id, league_id)` et `session`
- [x] **Le hachage des mots de passe** avec bcrypt, jamais en clair (10 caractères minimum)
- [x] **Sessions plutôt que JWT** : un jeton aléatoire, dont seul le condensat est en base. Cookie `HttpOnly` pour le web, en-tête `Authorization: Bearer` pour le mobile
- [x] **Un middleware d'authentification**, qui place l'utilisateur dans le `context`
- [x] **Un middleware d'autorisation**, qui lit `{leagueID}` dans l'URL et vérifie le rôle
  - les `GET` restent publics, seules les écritures sont protégées
  - créer et supprimer une ligue : réservé au superadmin
- [x] **Des tests** 401 (non connecté), 403 (admin d'une autre ligue) et 201 (bon admin, superadmin)
- [x] **Le premier superadmin** : créé au démarrage depuis `SUPERADMIN_EMAIL`, sans mot de passe, avec un lien de configuration envoyé par e-mail (SMTP, Mailpit en local sur http://localhost:8025)
- [x] **Mot de passe oublié et changement de mot de passe** : lien de réinitialisation à usage unique envoyé par e-mail (`auth.EmailNotifier`, SMTP). Sans `SMTP_HOST`, aucun e-mail ne part et le lien n'est écrit nulle part
- [ ] **Les invitations** : le superadmin invite un admin sur une ligue par un lien à usage unique, valable 7 jours
  - table `invitation` (ligue, e-mail, condensat du jeton, expiration, date d'acceptation)
  - accepter le lien crée le compte, ou rattache la ligue à un compte existant
  - lister et retirer les admins d'une ligue
- [ ] **Nettoyer les sessions expirées** (une requête périodique, ou à la connexion)

## 🔒 Sécurité

- [x] **Resserrer le CORS** : `AllowedOrigins: https://*` avec `AllowCredentials: true` accepte n'importe quel site
  - lire la liste des origines autorisées depuis la config (`CORS_ORIGINS`)
  - à faire avant l'authentification, sinon n'importe quel site pourra appeler l'API avec la session d'un admin
- [x] **Limiter la taille des body** dans `httpx.Decode` : `http.MaxBytesReader` (par exemple 1 Mo), sinon un client peut envoyer un body énorme
- [x] **Refuser les champs inconnus** dans `httpx.Decode` : `DisallowUnknownFields()`
  - un `"league_id"` envoyé dans le body renverra 400 au lieu d'être ignoré en silence
- [ ] **Des headers de sécurité** via un middleware, pour toutes les réponses :
  - `X-Content-Type-Options: nosniff`
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (une API JSON n'a rien à charger ni à afficher dans une iframe)
  - `Referrer-Policy: no-referrer`
  - `Cache-Control: no-store` sur les réponses authentifiées
  - `Strict-Transport-Security` seulement si l'app gère elle-même le TLS, sinon c'est au reverse proxy de l'ajouter
- [x] **Sécuriser `/health`** : il est public, répond 200 même quand la base est down, et renvoie l'erreur brute de pgx et les stats du pool
  - en public : juste `{"status":"up"}` ou `"down"`, avec un 503 quand c'est down
  - l'erreur détaillée va dans les logs (et dans Sentry), pas dans la réponse
- [x] **Du rate limiting**, au moins sur la connexion une fois l'auth en place (`github.com/go-chi/httprate`)
- [x] **Épingler la version de Postgres** (`postgres:18`) : `postgres:latest` dans `docker-compose.yml`, `testdb` et `database_test.go`
  - sinon une nouvelle version majeure peut arriver sans prévenir, en local comme en CI
- [x] **Lancer `govulncheck`** en CI (`make vuln`, job `Vulnerabilities`) : il signale les dépendances qui ont une faille connue *et* dont le code vulnérable est réellement appelé
- [x] **Passer les IDs en UUID v7** (décision 006), avant `squad`, `match` et `app_user`
  - migrations : `UUID PRIMARY KEY DEFAULT uuidv7()`, et toutes les clés étrangères en `UUID`, y compris `league_id`
  - `sqlc.yaml` : `override` de `uuid` vers `github.com/google/uuid.UUID`, puis `sqlc generate`
  - Go : `int64` → `uuid.UUID` dans les types du domaine, les stores et les DTO. `httpx.IDParam` avec `uuid.Parse`
  - tests : un `uuid.New()` à la place de `999` pour les IDs inconnus, `%s` à la place de `%d`
  - recréer la base locale

## 📡 Observabilité

- [ ] **Intégrer Sentry** (`github.com/getsentry/sentry-go`)
  - `SENTRY_DSN` dans la config, optionnel : pas de DSN en local ni en test, donc rien n'est envoyé
  - `Environment` depuis `APP_ENV`, et `Release` depuis le commit (injecté au build avec `-ldflags`)
  - le middleware `sentryhttp` à la place de `middleware.Recoverer`, pour remonter les panics
  - envoyer les `slog.ErrorContext` vers Sentry via son intégration `slog` : les 500 des handlers remontent sans toucher aux handlers
  - vérifier ce qui part : pas de body de requête, pas de headers `Authorization` ni de cookies (`SendDefaultPII: false`)
  - appeler `sentry.Flush` au shutdown, sinon les dernières erreurs sont perdues
- [x] **Des logs `slog` en JSON** et un request ID (`internal/logging`, `LOG_FORMAT`, `LOG_LEVEL`)
  - reste à reprendre le request ID dans les événements Sentry, pour relier une erreur à ses logs

## 🚀 Plus tard

- [ ] **Une documentation OpenAPI** de l'API
- [ ] **Le déploiement** : image Docker de l'app, migrations au démarrage ou dans un job séparé
