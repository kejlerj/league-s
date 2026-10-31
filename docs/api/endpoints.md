# Endpoints league-s

Tous les chemins commencent par `/api/v1`.

The request and response shapes are in `docs/openapi.yaml`. A new or changed route updates both files; `internal/server/openapi_test.go` fails when a router route is missing from the OpenAPI file.

**Légende**
- Statut : ✅ fait, 🔜 prévu
- Accès (une fois l'authentification en place) : **public** (sans connexion), **admin** (admin de la ligue de l'URL, ou superadmin), **superadmin**

## Validation errors

A body that fails validation gets a 422 with one readable French message per field: `{"errors": {"<field>": "<message>"}}`. The key is the JSON field name (`tie_breakers[0]` for an item of a list).

| Rule | Message |
|---|---|
| `required` | `obligatoire` |
| `min` / `max` on text | `<n> caractères minimum` / `<n> caractères maximum` |
| `min` / `max` on a number | `doit être au moins <n>` / `doit être au plus <n>` |
| `http_url` | `doit être une URL http ou https` |
| `email` | `doit être une adresse e-mail valide` |
| `uuid` | `doit être un identifiant valide` |
| `datetime=2006-01-02` | `doit être une date au format AAAA-MM-JJ` |
| `gtfield` | `doit être après <other field>` |
| `nefield` | `doit être différent de <other field>` |
| `oneof` | `doit valoir <a>, <b> ou <c>` |
| any other rule | `invalide` |

## Santé

| Statut | Méthode | Chemin | Accès | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/health` (hors `/api/v1`) | public | État de la base : `{"status":"up"}` (200) ou `{"status":"down"}` (503) |

## Ligues

| Statut | Méthode | Chemin | Accès | Description |
|---|---|---|---|---|
| ✅ | `POST` | `/leagues` | superadmin | Créer une ligue |
| ✅ | `GET` | `/leagues` | public | Lister les ligues, triées par nom |
| ✅ | `GET` | `/leagues/{leagueID}` | public | Lire une ligue |
| ✅ | `PATCH` | `/leagues/{leagueID}` | admin | Modifier le nom ou le logo |
| ✅ | `DELETE` | `/leagues/{leagueID}` | superadmin | Supprimer une ligue (refusé si elle a un historique : 409) |

## Admins de ligue

| Statut | Méthode | Chemin | Accès | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/leagues/{leagueID}/admins` | admin | Lister les admins de la ligue |
| ✅ | `POST` | `/leagues/{leagueID}/invitations` | superadmin | Nommer un admin : passe par une invitation (voir Authentification) |
| ✅ | `DELETE` | `/leagues/{leagueID}/admins/{userID}` | superadmin | Retirer un admin |

## Équipes

| Statut | Méthode | Chemin | Accès | Description |
|---|---|---|---|---|
| ✅ | `POST` | `/leagues/{leagueID}/teams` | admin | Créer une équipe |
| ✅ | `GET` | `/leagues/{leagueID}/teams` | public | Lister les équipes de la ligue, triées par nom. Ligue inconnue → 404 |
| ✅ | `GET` | `/leagues/{leagueID}/teams/{teamID}` | public | Lire une équipe |
| ✅ | `PATCH` | `/leagues/{leagueID}/teams/{teamID}` | admin | Modifier le nom ou le logo |
| ✅ | `DELETE` | `/leagues/{leagueID}/teams/{teamID}` | admin | Supprimer (refusé si elle a un historique) |
| ✅ | `GET` | `/leagues/{leagueID}/teams/{teamID}/seasons` | public | Saisons où l'équipe est inscrite, la plus récente d'abord. Équipe inconnue ou d'une autre ligue → 404 |

## Joueurs

| Statut | Méthode | Chemin | Accès | Description |
|---|---|---|---|---|
| ✅ | `POST` | `/leagues/{leagueID}/players` | admin | Créer un joueur |
| ✅ | `GET` | `/leagues/{leagueID}/players` | public | Lister les joueurs de la ligue, triés par nom puis prénom. `q` cherche dans « prénom nom » et « nom prénom », sans tenir compte de la casse. Ligue inconnue → 404 |
| ✅ | `GET` | `/leagues/{leagueID}/players/{playerID}` | public | Lire un joueur, avec son club actuel (`current_team` : l'équipe de son passage en cours dans la saison la plus récente, sinon `null`) |
| ✅ | `PATCH` | `/leagues/{leagueID}/players/{playerID}` | admin | Modifier le nom ou l'icône |
| ✅ | `DELETE` | `/leagues/{leagueID}/players/{playerID}` | admin | Supprimer (refusé s'il a un historique) |
| ✅ | `GET` | `/leagues/{leagueID}/players/{playerID}/career` | public | Tous ses passages en club (saison, équipe, numéro, dates), le plus récent d'abord. Joueur inconnu ou d'une autre ligue → 404 |

## Saisons

| Statut | Méthode | Chemin | Accès | Description |
|---|---|---|---|---|
| ✅ | `POST` | `/leagues/{leagueID}/seasons` | admin | Créer une saison (points 3/1/0 par défaut, `max_squad_size` optionnel) |
| ✅ | `GET` | `/leagues/{leagueID}/seasons` | public | Lister les saisons de la ligue, la plus récente d'abord. Ligue inconnue → 404 |
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}` | public | Lire une saison |
| ✅ | `PATCH` | `/leagues/{leagueID}/seasons/{seasonID}` | admin | Modifier dates, points ou départages (attention au classement déjà publié) |
| ✅ | `DELETE` | `/leagues/{leagueID}/seasons/{seasonID}` | admin | Supprimer (refusé si elle a des matchs). Ses inscriptions et effectifs sont supprimés avec elle |

## Équipes inscrites à une saison

| Statut | Méthode | Chemin | Accès | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/teams` | public | Lister les équipes inscrites |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}` | admin | Inscrire une équipe. Répond 201 |
| ✅ | `DELETE` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}` | admin | Désinscrire (refusé si elle a des matchs). Répond 204 |

## Effectifs (squad)

| Statut | Méthode | Chemin | Accès | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad` | public | Effectif actuel (`?all=true` pour inclure les départs) |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad` | admin | Faire entrer un joueur (`player_id`, `number`, `joined_on`) |
| ✅ | `PATCH` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad/{membershipID}` | admin | Changer le numéro |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad/{membershipID}/leave` | admin | Faire partir un joueur (`left_on`) |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/transfers` | admin | Transfert : départ puis arrivée, dans une transaction |

## Matchs

| Statut | Méthode | Chemin | Accès | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/matches` | public | Calendrier (`?matchday=`, `?from=&to=`, `?team=`, `?status=`). Chaque match porte le nom et le logo des deux équipes |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/matches` | admin | Programmer un match (`venue` optionnel) |
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}` | public | Lire un match |
| ✅ | `PATCH` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}` | admin | Modifier la journée ou le coup d'envoi, et renseigner lieu, arbitre, convocation, lien vidéo |
| ✅ | `DELETE` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}` | admin | Supprimer un match programmé par erreur |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/start` | admin | Passer en `live` |
| ✅ | `PUT` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/score` | admin | Mettre à jour le score |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/finish` | admin | Terminer le match |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/postpone` | admin | Reporter (nouvelle date optionnelle) |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/cancel` | admin | Annuler |

## Classement

| Statut | Méthode | Chemin | Accès | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/standings` | public | Classement calculé à partir des matchs terminés |

## Authentification

| Statut | Méthode | Chemin | Accès | Description |
|---|---|---|---|---|
| ✅ | `POST` | `/auth/login` | public | Connexion |
| ✅ | `POST` | `/auth/logout` | connecté | Déconnexion |
| ✅ | `GET` | `/me` | connecté | Utilisateur courant et ligues qu'il administre |
| ✅ | `PUT` | `/me/password` | connecté | Changer son mot de passe (`current_password`, `new_password`) |
| ✅ | `POST` | `/auth/password-reset` | public | Demander un lien de réinitialisation (`email`). Répond 204 dans tous les cas |
| ✅ | `POST` | `/auth/password-reset/confirm` | public | Choisir un nouveau mot de passe (`token`, `password`) |
| ✅ | `POST` | `/leagues/{leagueID}/invitations` | superadmin | Inviter un admin (`email`). Renvoie `link`, à envoyer par `mailto:` depuis l'admin web. Valable 7 jours, remplace l'invitation précédente de la même adresse |
| ✅ | `GET` | `/leagues/{leagueID}/invitations` | superadmin | Invitations en attente |
| ✅ | `DELETE` | `/leagues/{leagueID}/invitations/{invitationID}` | superadmin | Annuler une invitation |
| ✅ | `POST` | `/invitations/lookup` | public | Lire une invitation (`token`) : adresse, ligue, `account_exists` |
| ✅ | `POST` | `/invitations/accept` | public | Accepter (`token`, et `name` + `password` si le compte n'existe pas) |
| ✅ | `GET` | `/leagues/{leagueID}/admins` | admin | Admins de la ligue |
| ✅ | `DELETE` | `/leagues/{leagueID}/admins/{userID}` | superadmin | Retirer un admin de la ligue (le compte reste) |
