# Explications league-s

Des notions à savoir expliquer, sans être des décisions propres au projet. Les décisions sont dans `decision.md`.

## 1 · Pourquoi on recopie les données champ par champ entre les couches

### Le constat

Une même équipe passe par trois structures différentes :

```
Postgres ──► db.Team ──toTeam()──► team.Team ──toResponse()──► teamResponse ──► JSON
            (sqlc)     store.go     (domaine)    handler.go      (DTO)
```

Et dans l'autre sens, le JSON reçu est décodé dans `createTeamRequest`, puis recopié dans un `team.Team`.

À chaque passage, on recopie les champs un par un, et pour une liste on crée un nouveau slice :

```go
res := make([]teamResponse, len(teams))
for i, t := range teams {
	res[i] = toResponse(t)
}
```

Pourquoi ne pas renvoyer directement `db.Team` au client ?

### Raison 1 : le contrat de l'API ne doit pas suivre le schéma de la base

`db.Team` est **généré** à partir des migrations. Il contient tout ce qu'a la table, y compris `CreatedAt` et `UpdatedAt`, et il change à chaque migration.

Si on renvoyait `db.Team` directement :
- **ajouter une colonne l'exposerait automatiquement dans l'API.** Aujourd'hui c'est `updated_at`. Demain, dans une table `user`, ce serait `password_hash` ;
- **renommer une colonne casserait les clients**, alors que c'est un simple changement interne ;
- **on ne peut pas choisir les noms JSON**, puisqu'on ne modifie pas du code généré.

`teamResponse` est le contrat public : il liste exactement ce que le client reçoit, avec les noms choisis (`league_id`). La base peut évoluer sans que l'API change, et inversement.

### Raison 2 : le client ne doit pas pouvoir tout envoyer (mass assignment)

`createTeamRequest` ne contient que `Name` et `Logo`. Si on décodait le JSON directement dans `team.Team` ou `db.Team`, le client pourrait envoyer :

```json
{ "name": "Les Bleus", "id": 12, "league_id": 7 }
```

et choisir lui-même l'ID, ou **créer une équipe dans une autre ligue** que celle de l'URL. Ce serait une faille d'isolation multi-tenant (voir décision 002).

Avec un DTO de requête, les champs sensibles n'existent tout simplement pas. `LeagueID` est pris dans l'URL, jamais dans le body. Le DTO porte aussi les règles de validation (`validate:"required,max=50"`), qui ne concernent que l'entrée HTTP.

C'est une faille classique : le « mass assignment » (OWASP API Security Top 10, « Broken Object Property Level Authorization »).

### Raison 3 : le domaine ne dépend ni de la base ni de HTTP

`team.Team` est le type métier. Il n'a ni tag `json`, ni type pgx, ni champ technique :
- le store le construit à partir de `db.Team` (`toTeam`) ;
- le handler le transforme en `teamResponse` (`toResponse`).

C'est ce qui permettra d'écrire la logique de `match` (`Start`, `SetScore`, `Finish`, `Winner`) sur des types simples, testables sans base et sans HTTP.

Chaque couche a son type, et chaque conversion est une frontière :

| Type | Couche | Dépend de | Change quand… |
|---|---|---|---|
| `db.Team` | store | schéma SQL (généré) | une migration change la table |
| `team.Team` | domaine | rien | le métier change |
| `teamResponse` / `createTeamRequest` | handler | contrat HTTP | l'API change (versionnée) |

### Pourquoi une boucle et un `make`

Go n'a pas de `.map()` sur les slices comme JavaScript, et la stdlib n'en propose pas (le package `slices` n'a pas de `Map`). La boucle explicite est la façon idiomatique.

`make([]teamResponse, len(teams))` crée le slice **à la bonne taille dès le départ** : une seule allocation, puis on remplit par index. Avec `append` sur un slice vide, Go devrait agrandir le tableau plusieurs fois.

On ne peut pas non plus convertir directement `[]db.Team` en `[]teamResponse`. Même avec des champs identiques, Go ne convertit pas les slices d'un type à l'autre, et ici les champs diffèrent de toute façon (`CreatedAt`, les tags).

Un détail à connaître : `make([]T, n)` crée un slice de longueur `n`, rempli de valeurs zéro. Pour une liste vide, on obtient `[]` en JSON, alors qu'un slice `nil` donnerait `null`. Les clients apprécient d'avoir toujours un tableau.

### Le coût

- **Du code en plus** : des fonctions `toX` à écrire et à tenir à jour.
- **Une copie par requête**, négligeable face à l'aller-retour vers Postgres et le réseau.
- **Un risque d'oubli** : un nouveau champ ajouté au domaine mais pas au DTO n'apparaît pas dans la réponse. Les tests d'intégration le détectent.

### Et si on faisait la projection directement en SQL ?

`SELECT id, league_id, name, logo` au lieu de `SELECT *` : sqlc génère alors une struct avec seulement ces champs.

- **Pour la raison 1, ça marche en grande partie.** Une nouvelle colonne ne fuit plus, et un alias (`AS`) protège d'un renommage. Mais le contrat de l'API est alors écrit dans les fichiers SQL et lié à une requête. On ne peut pas y exprimer une réponse imbriquée, un champ calculé, un format de date, ou une réponse qui combine plusieurs requêtes.
- **Pour la raison 2, ça ne suffit pas.** La projection concerne ce qui sort, alors que le mass assignment concerne ce qui entre. Un `INSERT` qui liste ses colonnes empêche bien d'écrire `id`. Mais `league_id` est une colonne légitime de l'`INSERT` : la question n'est pas *quelles colonnes* on écrit, mais *d'où vient chaque valeur*. `league_id` doit venir de l'URL, pas du body. Seul le DTO de requête sépare les deux sources.

### La raison 3 n'est pas fonctionnelle

Les raisons 1 et 2 ont un effet visible : le contrat de l'API et la sécurité. La raison 3 n'en a aucun : l'appli se comporte exactement pareil avec ou sans couche domaine. C'est une question d'architecture et de dépendances, donc du coût des changements futurs :
- une migration ne touche que le store ;
- un changement d'API ne touche que le handler ;
- la logique métier se teste sans base ni HTTP.

C'est pour ça que certains projets la sautent sur un CRUD simple, alors que personne ne devrait sauter les DTO.

### Les nuances à connaître

- Sur un petit CRUD, certains projets sautent la couche domaine et convertissent directement `db.Team` en DTO. Ça se défend. La frontière qui compte vraiment est celle du **DTO HTTP** : c'est elle qui protège le contrat et la sécurité.
- sqlc peut générer des tags `json` (`emit_json_tags`), ce qui rend tentant de renvoyer `db.Team` directement. C'est exactement ce qu'on évite ici, pour les raisons 1 et 2.
- Incohérence actuelle dans le projet : `League` et `Season` ont des tags `json` alors qu'ils ont des DTO, contrairement à `Team` et `Player`. Ces tags ne servent à rien et suggèrent à tort que le type du domaine est sérialisé.

### À dire en entretien, en une phrase

« Je sépare le modèle de la base, le modèle métier et les DTO HTTP : l'API a un contrat stable qui ne suit pas le schéma, le client ne peut envoyer que les champs autorisés, ce qui compte pour l'isolation par ligue, et le métier reste testable sans base ni HTTP. Le prix, c'est du code de conversion. »

## 2 · Vérifier puis écrire : la concurrence

### Le problème

Toute opération qui fait **« lire → décider → écrire »** a le même défaut : entre la lecture et l'écriture, une autre requête peut passer et rendre la décision fausse. Ça vaut pour une vérification dans un service, dans une entité riche ou dans un handler.

**Exemple 1 : le numéro de maillot (unicité).** Deux admins donnent le numéro 10 à deux joueurs différents, en même temps :

```
Admin A : « le 10 est libre ? » → oui
Admin B : « le 10 est libre ? » → oui
Admin A : INSERT numéro 10 → OK
Admin B : INSERT numéro 10 → OK sans contrainte en base : deux joueurs ont le 10
```

**Exemple 2 : la taille de l'effectif (comptage).** L'effectif a 9 joueurs sur 10. Deux ajouts simultanés comptent chacun 9, insèrent chacun, et l'effectif finit à 11.

**Exemple 3 : le cycle de vie d'un match (entité).**

```
Requête A : charge le match (live) → m.Finish() OK
Requête B : charge le match (live) → m.Cancel() OK → sauvegarde : cancelled
Requête A : sauvegarde : finished
```

Le match finit `finished` alors qu'il a été annulé entre-temps. La mise à jour de B est perdue : c'est une « lost update ». Aucun `CHECK` ne l'empêche, parce qu'un `CHECK` ne voit que la **nouvelle** ligne, jamais l'ancienne : il ne peut pas interdire une transition.

### Les solutions

Pour qu'une règle soit **garantie**, il faut l'une de ces deux choses :
- **la base décide au moment de l'écriture** ;
- **ce qu'on a lu reste vrai jusqu'à l'écriture**.

| Solution | Principe | Exemple dans le projet | Quand l'utiliser |
|---|---|---|---|
| **Contrainte en base** | La base refuse l'écriture. Le store traduit l'erreur en erreur métier | `squad_membership_active_number` → `ErrJoinNumberTaken` | Unicité, existence, non-chevauchement |
| **Écriture conditionnelle** | La règle est dans le `WHERE` : `UPDATE … WHERE id = $1 AND status = 'live'`. Zéro ligne modifiée = la règle n'est plus vraie | `CloseSquadMembership` : `WHERE … AND left_on IS NULL` | Une transition simple sur une seule ligne |
| **Verrou pessimiste** | `SELECT … FOR UPDATE` dans une transaction : les autres requêtes attendent que la transaction se termine | Verrouiller la ligne `season_team` avant de compter l'effectif | Un comptage, ou une règle qui lit plusieurs lignes |
| **Verrou optimiste** | On relit une version au moment d'écrire : `UPDATE … WHERE id = $1 AND updated_at = $ancien`. Zéro ligne = quelqu'un est passé avant → 409 « réessayez » | À envisager pour les entités riches (`match`) | Conflits rares, et on ne veut pas bloquer |

Le verrou pessimiste bloque, mais ne fait jamais échouer. Le verrou optimiste ne bloque pas, mais peut échouer, et le client doit alors réessayer.

### Et la vérification en amont ?

Vérifier avant d'écrire, dans un service ou une entité, **reste utile** : dans 99 % des cas il n'y a pas de concurrence, et on peut donner un message précis avant de toucher à la base. Mais ce n'est **pas une garantie**. Il faut quand même l'un des mécanismes ci-dessus, et l'erreur de la base doit rester traduite pour le 1 % restant.

Pour une contrainte en base déjà traduite par le store, la vérification en amont n'apporte rien au client : il reçoit le même 409, avec le même message, et une requête de moins est faite. Elle devient intéressante quand :
- on veut remonter **plusieurs erreurs d'un coup** (la base s'arrête à la première) ;
- l'opération a un **effet de bord** avant l'écriture (un appel externe, un email) ;
- l'opération fait un **gros travail** avant l'écriture.

Son coût : la règle est écrite à deux endroits, qu'il faut garder synchronisés.

### Où placer chaque règle

| Type de règle | En premier | Garantie finale |
|---|---|---|
| Format (longueur, plage, URL) | Validation du DTO (422) | `CHECK` en base |
| Transition d'état d'une entité | Méthode de l'entité | Verrou (pessimiste ou optimiste) ou écriture conditionnelle. Un `CHECK` ne suffit pas |
| Unicité, existence, chevauchement | Contrainte en base, traduite par le store | La même contrainte |
| Règle sur plusieurs lignes ou tables (comptage, dates de la saison) | Service | Verrou pessimiste dans la transaction |

### À dire en entretien, en une phrase

« Une vérification avant une écriture n'est pas une garantie, parce qu'une autre requête peut passer entre les deux. Soit la base décide au moment de l'écriture (contrainte, `WHERE` conditionnel), soit je verrouille ce que j'ai lu (`FOR UPDATE`, ou une version). La vérification en amont sert à donner un bon message, pas à garantir la règle. »
