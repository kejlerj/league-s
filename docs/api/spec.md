# Spécifications métier league-s

Les règles du métier, indépendamment de la façon dont elles sont codées. Pour chaque règle : où elle est garantie aujourd'hui, ou ce qu'il reste à faire.

Les choix techniques sont dans `decision.md`, les tâches dans `checklist.md`, les routes dans `endpoints.md`.

**Légende**
- ✅ garantie (l'endroit est indiqué)
- ⚠️ pas encore garantie
- ❓ à confirmer (question métier ouverte)

## Contexte

Une application pour des ligues de foot amateur (five, foot urbain), pas pour le foot pro. Chaque ligue est gérée par ses organisateurs et totalement indépendante des autres.

## Ligue

| Règle | Statut |
|---|---|
| Une ligue est isolée des autres : ses équipes, joueurs, saisons et matchs ne sont ni visibles ni modifiables depuis une autre ligue | ✅ filtres `league_id` + clés étrangères composites (décision 002) |
| **Une ligue n'a qu'une seule saison à la fois** : les périodes de ses saisons ne se chevauchent pas | ⚠️ **pas garantie**. À ajouter sur `season` : une contrainte de non-chevauchement sur `(league_id, daterange(start_on, end_on))`, même mécanisme que la décision 008 |
| Une ligue avec un historique (équipes, joueurs, saisons) ne peut pas être supprimée | ✅ `ON DELETE RESTRICT`, 409 |
| Nom : obligatoire, 50 caractères max. Logo : URL, optionnel | ✅ validation du DTO |
| Créer ou supprimer une ligue : superadmin seulement | ⚠️ attend l'authentification |

## Équipe

| Règle | Statut |
|---|---|
| Une équipe appartient à une seule ligue | ✅ `team.league_id` |
| Le nom est unique dans la ligue (deux ligues peuvent avoir une équipe du même nom) | ✅ `UNIQUE (league_id, name)`, 409 |
| Nom : obligatoire, 50 caractères max. Logo : URL, optionnel | ✅ validation du DTO |
| Une équipe participe à une saison en s'y inscrivant | ✅ table `season_team` |
| Une équipe ne peut être inscrite qu'une fois à une saison | ✅ clé primaire `(season_id, team_id)`, 409 |
| Une équipe qui a déjà des matchs dans la saison ne peut pas être désinscrite | ✅ `ON DELETE RESTRICT`, 409 |

## Joueur

| Règle | Statut |
|---|---|
| Un joueur appartient à une seule ligue. Une même personne qui joue dans deux ligues a deux fiches joueur | ✅ `player.league_id` |
| Prénom et nom : obligatoires, 50 caractères max. Icône : URL, optionnelle | ✅ validation du DTO |
| Deux joueurs peuvent porter le même nom | ✅ pas de contrainte d'unicité |
| Un joueur n'a pas de poste : en five et en foot urbain les joueurs tournent pendant le match | ✅ aucun champ poste, ni sur le joueur ni dans l'effectif |

## Saison

| Règle | Statut |
|---|---|
| Les règles de la compétition (points, départages) sont portées par la saison, pas par la ligue : les changer ne réécrit pas les classements passés | ✅ colonnes de `season` |
| Le nom est unique dans la ligue | ✅ `UNIQUE (league_id, name)`, 409 |
| La fin est après le début | ✅ `CHECK (end_on > start_on)` et validation `gtfield` |
| **Une seule saison à la fois par ligue** | ⚠️ voir Ligue |
| Points par défaut : 3 (victoire), 1 (nul), 0 (défaite) | ✅ champs optionnels dans le DTO : un champ omis prend la valeur par défaut (`season.DefaultMatchWinPts`…), un `0` explicite est gardé |
| Départages possibles : différence de buts, buts marqués, confrontation directe, fair-play, tirage au sort, appliqués dans l'ordre choisi. Par défaut : différence de buts, puis buts marqués | ✅ `tie_breakers` omis à la création → `season.DefaultTieBreakers()` (`goal_difference`, `goals_scored`), comme la valeur par défaut de la colonne. Un seul nom, `goals_scored`, en base et dans le validator. `standing.Compute` applique `goal_difference`, `goals_scored` et `head_to_head`. ⚠️ `fair_play` et `random` sont acceptés mais ignorés : pas de données de cartons, et un tirage au sort recalculé à chaque requête changerait le classement. À égalité complète, l'ordre alphabétique décide |
| Taille maximale d'un effectif, optionnelle | ✅ `max_squad_size` (`NULL` = pas de limite, `CHECK > 0`), accepté à la création (`min=1`, 422 sinon) et renvoyé par l'API des saisons |

## Effectif (squad)

**Vocabulaire**
- un **passage** (`Membership`, une ligne de `squad_membership`) : un joueur, dans une équipe, pour une saison, entre deux dates ;
- l'**effectif** (squad) d'une équipe pour une saison : l'ensemble de ses passages. Il n'a pas de table à lui : il est ancré sur la ligne `season_team` (l'inscription de l'équipe à la saison).

| Règle | Statut |
|---|---|
| Seule une équipe inscrite à la saison peut avoir un effectif | ✅ clé étrangère vers `season_team` |
| Le joueur et l'équipe sont de la même ligue | ✅ clés étrangères composites |
| Un joueur n'est actif que dans une seule équipe à la fois. Comme une ligue n'a qu'une saison à la fois, « une par saison » revient à « une dans la ligue » | ✅ index partiel `squad_membership_active_player`, 409 (dépend de la règle « une saison à la fois ») |
| Un joueur peut quitter une équipe et revenir : chaque passage est une ligne | ✅ modèle de données |
| Un départ ne supprime rien : il renseigne `left_on`, et l'historique reste consultable | ✅ `CloseSquadMembership`, `ListSquadMemberships` avec historique |
| Le départ est le même jour ou après l'arrivée | ✅ `CHECK squad_membership_left_after_joined`, `ErrLeaveBeforeJoining` |
| Deux passages d'un même joueur ne se chevauchent pas, même dans le passé | ⚠️ seuls les passages actifs sont protégés (décision 008) |
| Numéro de maillot : optionnel, entre 1 et 99 | ✅ `CHECK` en base et validation du DTO (422) |
| Un numéro est unique dans l'effectif actif. Il se libère quand le joueur part | ✅ index partiel `squad_membership_active_number`, 409 |
| L'arrivée et le départ ont lieu pendant la saison (premier et dernier jour inclus) | ✅ `SquadRules.CheckJoin` et `CheckLeave`, appelées par le service : `ErrJoinOutsideSeason`, `ErrLeaveOutsideSeason` |
| L'effectif ne dépasse pas la taille maximale de la saison | ✅ `Service.Join` : `LockSquad` (verrou sur `season_team`), `CountActive`, puis `SquadRules.CheckJoin` → `ErrJoinSquadFull`. Vaut aussi pour l'équipe d'arrivée d'un transfert |
| Un transfert (départ puis arrivée) est tout ou rien | ✅ `Service.Transfer`, dans `store.InTx` |
| ❓ `left_on` : dernier jour dans l'équipe, ou premier jour où le joueur n'y est plus ? | ❓ à trancher avec la décision 008. La seconde option permet un transfert le même jour |

## Match (prévu)

| Règle | Statut |
|---|---|
| Un match oppose deux équipes différentes, toutes deux inscrites à la saison | ✅ `CHECK (home_team_id <> away_team_id)` + clés étrangères vers `season_team` |
| Numéro de journée strictement positif | ✅ `CHECK (matchday > 0)` |
| Le score est complet (les deux équipes) ou absent, jamais négatif | ✅ `CHECK` en base |
| Un match terminé a un score | ✅ `CHECK (status <> 'finished' OR home_score IS NOT NULL)` |
| Cycle de vie : programmé, en cours, terminé, reporté, annulé, avec des transitions interdites | ✅ entité riche `match.Match` (décision 007), 409 sur une transition interdite. Le service verrouille le match (`FOR UPDATE`) le temps de la transition |
| ❓ Transitions exactes : un match reporté peut-il être annulé ? Un match en cours peut-il être interrompu ? | ❓ à confirmer. Choix provisoire du code : un match reporté peut être annulé, un match en cours ne peut être ni annulé ni reporté |
| Le score démarre à 0-0 au coup d'envoi et ne change que pendant le match | ✅ `Match.Start`, `Match.SetScore` |
| Reporter sans nouvelle date met le match en `postponed`. Lui donner un coup d'envoi le reprogramme | ✅ `Match.Postpone`, `Match.Reschedule` |
| Une équipe n'a pas de stade attitré : le lieu (le terrain réservé) est propre à chaque match, optionnel, donné à la programmation ou plus tard | ✅ `match.venue`, accepté par `POST` et `PATCH` |
| Arbitre, heure de convocation et lien vidéo sont optionnels et renseignés par l'admin, quel que soit le statut du match | ✅ `Match.UpdateDetails`, par le `PATCH`. Le lien vidéo doit être en `http` ou `https` |
| Changer la journée ou le coup d'envoi reste réservé aux matchs programmés ou reportés | ✅ `Match.Reschedule`, 409. Un `PATCH` refusé ne modifie rien, même pas les détails envoyés avec |
| Les dates et heures sont stockées et renvoyées en UTC. Le fuseau d'affichage est celui de l'appareil du lecteur | ✅ `TIMESTAMPTZ` en base, `kickoff_at` et `convocation_at` renvoyés avec le suffixe `Z` |
| Seul un match encore programmé peut être supprimé | ✅ `Match.CheckDeletable`, 409 |
| Une équipe joue au plus un match par journée (les matchs annulés ne comptent pas) | ✅ `match.Service`, avec un verrou sur la saison contre les créations simultanées, 409 |
| Le coup d'envoi a lieu pendant la saison (premier et dernier jour inclus, en UTC) | ✅ `match.Service`, 422 |

## Classement (prévu)

| Règle | Statut |
|---|---|
| Le classement n'est pas stocké : il est calculé à partir des matchs, avec les règles de la saison | ✅ `standing.Compute` |
| Seuls les matchs terminés comptent | ✅ `Match.Winner` refuse les autres |
| Les départages s'appliquent dans l'ordre défini par la saison | ✅ `standing.Compute`. La confrontation directe ne compte que les matchs entre les équipes à égalité, et se recalcule sur le sous-groupe restant |

## Accès (prévu)

| Règle | Statut |
|---|---|
| Les lectures sont publiques | ✅ les `GET` passent sans session |
| Les écritures d'une ligue sont réservées à ses admins. Une ligue peut avoir plusieurs admins, et un admin plusieurs ligues | ✅ `auth.LeagueAdminWrites` sur chaque route de ligue : 401 sans session, 403 sans droit sur cette ligue |
| Le superadmin crée et supprime les ligues, et a tous les droits sur chacune | ✅ `auth.SuperadminWrites` |
| Le compte superadmin est créé au démarrage à partir de `SUPERADMIN_EMAIL`, sans mot de passe. Un lien à usage unique, valable une heure, est envoyé par e-mail (SMTP) pour en choisir un. Sans `SMTP_HOST`, aucun e-mail ne part et le lien n'est écrit nulle part | ✅ `auth.EnsureSuperadmin`. Un nouveau lien est émis à chaque démarrage tant qu'aucun mot de passe n'est défini |
| Mot de passe oublié : un lien à usage unique, valable une heure, envoyé par e-mail (SMTP). La réponse est la même que l'e-mail existe ou non | ✅ `POST /auth/password-reset` puis `/confirm`. Réinitialiser ferme toutes les sessions du compte |
| Un utilisateur connecté change son mot de passe en donnant l'actuel | ✅ `PUT /me/password`. Les autres sessions du compte sont fermées |
| Le superadmin nomme les admins par une invitation : un lien à usage unique, valable 7 jours, envoyé par `mailto:` depuis l'admin web | ⚠️ à écrire (table `invitation`). Pas d'inscription ouverte en v1 |
| Une session dure 30 jours, prolongés à chaque utilisation. Se déconnecter la supprime côté serveur | ✅ table `session`, seul le condensat du jeton est stocké |
| Un admin de la ligue A n'a aucun droit sur la ligue B | ✅ testé sur le vrai routeur (`internal/server/auth_test.go`) |
