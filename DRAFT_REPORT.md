# Draft report: robots-txt-kit

## Verdict

À garder, mais pas encore à publier. La passe conformité stricte avait confirmé un NO-GO; une passe de durcissement a corrigé les plus gros points locaux, notamment les groupes multiples pour un même user-agent et les entrées runtime non-string. Il reste à ajouter des fixtures inspirées RFC/crawlers avant de le promouvoir.

## Shortlist exploratoire

| Package source | Famille prometteuse | Idée clean-room | Décision |
| --- | --- | --- | --- |
| `robots-txt-parse` | Robots.txt / SEO tooling | Parser robots.txt structuré, browser-friendly, avec diagnostics et matching local | GO: usage visible, package ancien, MVP démontrable et non couvert localement. |
| `robots-txt-parser` | Robots.txt / crawler policy | Parseur/évaluateur sans fetch ni cache implicite | Signal utile, mais `robots-txt-parse` est le meilleur signal usage/abandon. |
| `robots-parser` | Robots.txt / crawler policy | Évaluation spec-like des chemins | NO GO source direct: plus proche d'un leader de fait, publié il y a 3 ans et très téléchargé. |
| `generate-robotstxt` | Génération robots.txt | Builder robots.txt typé | NO GO: besoin adjacent, plus orienté génération et moins différenciant pour un MVP. |
| `robotstxt-util` | Robots.txt typed parser/builder | Parser/builder RFC 9309 typé | NO GO concurrent: maintenu récemment, même si usage faible. |

## Score détaillé

- Usage actuel vérifié: 2/2. `robots-txt-parse` affiche 19 606 téléchargements hebdomadaires sur npm; `robots-txt-parser` affiche environ 4 930 téléchargements hebdomadaires sur npm.
- Abandon ou maintenance faible: 2/2. `robots-txt-parse` est en `2.0.1`, publié il y a 5 ans; `robots-txt-parser` est en `2.0.3`, publié il y a 3 ans, et Snyk le classe maintenance inactive.
- MVP démontrable: 2/2. Parser groupes/règles/sitemaps puis décider `allowed` pour un chemin tient dans une API courte et testable.
- Douleur utilisateur: 2/2. Les outils SEO, crawlers internes et tests de conformité ont besoin d'expliquer quelle ligne autorise ou bloque une URL, pas seulement d'obtenir un booléen.
- Différenciation + trajectoire produit: 2/2. Le brouillon expose diagnostics, lignes sources, règle sélectionnée, sitemaps et matching local sans fetch/cache Node implicite.

Score total: 10/10.

## Preuves

- `robots-txt-parse`: npm indique `2.0.1`, MIT, 5 dépendants, streaming parser, 19 606 weekly downloads, publié il y a 5 ans.
- `robots-txt-parser`: npm indique `2.0.3`, MIT, 6 dépendants, 4 930 weekly downloads, publié il y a 3 ans.
- Snyk indique `robots-txt-parser` maintenance inactive, sans release npm récente, dernier commit/release autour de 4 ans.
- `robots-parser` reste un concurrent fort: l'écosystème code.gouv indique plus de 4M de téléchargements mensuels, avec dernière publication il y a 3 ans.

## Concurrents

- `robots-parser`: alternative très utilisée et probablement leader pour matching robots.txt; le brouillon ne doit pas se positionner comme remplacement complet sans audit RFC.
- `robotstxt-util`: récent, typé, sans dépendance, orienté RFC 9309, mais très faible usage observé sur npm.io.
- `robots-txt-parser`: Node-first avec wildcards, caching et promesses; signal de demande mais moins browser-friendly.
- `robots-txt-parse`: streaming parser Node avec dépendance, utile comme signal mais pas repris.

## Raison du GO

Le GO repose sur une niche plus stricte que les leaders: une petite lib browser-friendly qui parse un texte déjà fourni, retourne des diagnostics stables et explique la décision avec la règle et la ligne source. Elle évite volontairement les responsabilités de fetch, cache, réseau, stockage par domaine ou conformité exhaustive.

## MVP

- `parseRobotsTxt(input)` retourne groupes, règles, sitemaps et diagnostics.
- `checkRobotsTxt(input, urlOrPath, options?)` parse et décide en un appel.
- `matchRobotsTxt(document, urlOrPath, options?)` évalue un document déjà parsé.
- `listRobotsTxtSitemaps(input)` extrait les sitemaps valides.
- Support MVP: `User-agent`, `Allow`, `Disallow`, `Sitemap`, `Crawl-delay`, wildcard `*`, ancre finale `$`, règle la plus spécifique.

## Différenciation du MVP

`robots-txt-kit` retourne la règle et la ligne qui expliquent une décision de crawl, plus des diagnostics stables, dans un coeur pur qui ne fait ni fetch, ni cache, ni accès Node implicite.

## Trajectoire produit

1. Durcir l'interprétation RFC 9309 avec fixtures réelles et cas Google documentés.
2. Ajouter un formatter minimal et une fonction d'audit de robots.txt pour erreurs fréquentes.
3. Ajouter une CLI optionnelle `robots-txt-check` pour fichiers locaux seulement.
4. Ajouter une démo navigateur permettant de coller un robots.txt et tester une liste d'URLs.

## Contrôle anti-doublon

Inventaire consulté:

- `/Users/guillaumepapinutti/Developer/ExperienceAlpha/docs/package-dashboard.md`;
- `/Users/guillaumepapinutti/Developer/ExperienceAlpha/docs/npm-publication-queue.md`;
- `/Users/guillaumepapinutti/Developer/ExperienceAlpha/docs/extension-backlog.md`;
- `/Users/guillaumepapinutti/Developer/ExperienceAlpha/Recoveredd/README.md`;
- dossiers locaux `/Users/guillaumepapinutti/Developer/ExperienceAlpha/*-kit/`;
- dossiers locaux `/Users/guillaumepapinutti/Developer/ExperienceAlpha/draft-libs/*-kit/`;
- mémoire de l'automatisation si disponible.

Libs proches trouvées:

- `http-cache-control-kit`, `http-accept-language-kit`, `http-link-header-kit`: parseurs HTTP, sans rapport avec la politique crawler.
- `domain-name-validate-kit`, `text-url-extract-kit`, `github-repo-url-kit`: domaines URL/host adjacents, mais pas robots.txt.
- `large-log-viewer-kit`, `junit-report-doctor-kit`, `har-redaction-kit`: outils support/debug, sans recouvrement fonctionnel.
- Aucun package local ne parse ou n'évalue `robots.txt`.

Raison anti-doublon: le nom, le domaine et la promesse utilisateur ne recoupent pas 70% d'un package Recoveredd existant. Le besoin utilisateur est "expliquer une décision robots.txt locale", pas parser une URL, valider un domaine ou inspecter un header.

## Justification browser-friendly

Le coeur utilise uniquement chaînes, tableaux, objets, `RegExp` et l'API standard `URL`. Il n'importe pas `fs`, `path`, `node:*`, `Buffer`, `process`, module natif ou réseau. Les entrées sont du texte et des URLs/chemins fournis par l'appelant.

## CLI

Pas de CLI dans le brouillon. Une CLI deviendrait naturelle seulement après durcissement des cas RFC, pour vérifier un fichier local contre une liste d'URLs sans fetch réseau.

## Nom retenu

Nom: `robots-txt-kit`.

Justification: le nom est court, descriptif dans une liste npm/GitHub, cohérent avec les packages Recoveredd en `*-kit`, et désigne directement le format pris en charge. Il évite la proximité exacte avec `robots-txt-parse`, `robots-txt-parser` et `robots-parser`.

## API

- `parseRobotsTxt(input)`
- `checkRobotsTxt(input, urlOrPath, options?)`
- `matchRobotsTxt(document, urlOrPath, options?)`
- `listRobotsTxtSitemaps(input)`

## Risques et limites

- Le matching user-agent est volontairement simple et substring-based.
- La sélection de groupes n'est pas encore assez robuste pour promettre une conformité RFC 9309.
- Les groupes multiples qui ciblent le même user-agent doivent être étudiés et testés avant promotion.
- La gestion des chemins doit être validée avec davantage de cas d'encodage URL, query string, wildcard et ancre `$`.
- Les directives non supportées sont diagnostiquées mais ignorées.
- Pas de fetch, pas de cache, pas de gestion par domaine.
- `URL` est une API web standard, mais les runtimes très anciens ne sont pas ciblés.

## Passe conformité stricte 2026-05-14

Résultat: conserver le brouillon, ne pas promouvoir.

Points bloquants avant une vraie lib:

- clarifier et tester la règle de sélection des groupes quand plusieurs groupes correspondent au même robot;
- ajouter des fixtures inspirées de RFC 9309 et des documentations Google/Bing, sans reprendre de code concurrent;
- vérifier le comportement attendu des chemins avec query strings, percent-encoding, wildcard `*` et fin de chaîne `$`;
- ajouter des tests de non-régression sur `Disallow:` vide, `Allow:` vide, noms de robots proches et groupes `*` fallback;
- décider si le README doit parler de "robots.txt inspector" plutôt que d'"evaluate" tant que la conformité n'est pas complète.

Ce qui reste bon:

- API courte et compréhensible;
- diagnostics stables avec lignes sources;
- coeur browser-friendly sans fetch/cache implicite;
- démo navigateur facile à imaginer.

## Durcissement 2026-05-14

Décision après durcissement: passer de NO-GO strict à "à garder". Le brouillon ne doit toujours pas être publié comme une implémentation complète de robots.txt, mais il n'a plus les lacunes les plus évidentes pour une inspection locale.

Corrections faites:

- fusion des règles quand plusieurs groupes ont le même meilleur match de user-agent;
- non-mélange du fallback `*` quand un groupe plus spécifique existe;
- tests sur `Disallow:` et `Allow:` vides comme règles no-op;
- diagnostics au lieu d'exception quand l'URL/le chemin n'est pas une chaîne;
- README repositionné en "portable inspector" plutôt que remplacement de validateurs crawler-specific.

Validations après durcissement:

- `npm run typecheck`: OK.
- `npm test`: OK, 15 tests.
- `npm run build`: OK.
- `npm_config_cache=/private/tmp/robots-txt-kit-npm-cache npm pack --dry-run`: OK, 12.7 kB packed.
- Smoke `dist`: fusion de groupes équivalents OK.

Reste avant promotion:

- fixtures RFC 9309 et documentation Google/Bing;
- cas percent-encoding plus poussés;
- décision sur une éventuelle CLI locale;
- CI GitHub verte si le brouillon devient une vraie lib.

## Validations

- Générateur interne lancé: `node scripts/create-lib.mjs robots-txt-kit --description "Parse and evaluate robots.txt rules with structured diagnostics." --keywords "robots,robots.txt,crawler,parser,seo" --no-git --install`.
- L'installation du générateur est restée bloquée sans sortie; un second `npm install --package-lock-only --prefer-offline` avec cache local est également resté bloqué sans sortie.
- Les deux installations ont fini en échec `ENOTFOUND registry.npmjs.org`.
- Pour ne pas dépendre du registry, `node_modules` a été lié vers un brouillon local existant contenant les mêmes dépendances dev, et un `package-lock.json` local a été repris depuis un brouillon de même gabarit puis renommé.
- `npm run typecheck`: OK après durcissement.
- `npm test`: OK, 15 tests passés.
- `npm run build`: OK.
- `npm_config_cache=/private/tmp/robots-txt-kit-npm-cache npm pack --dry-run`: OK, tarball prévue `robots-txt-kit-0.1.0.tgz`, 8 fichiers, 12.7 kB packed.
- Passe conformité stricte 2026-05-14: NO-GO publication tant que les règles de groupe et fixtures RFC ne sont pas durcies.
- Passe de durcissement 2026-05-14: groupes multiples et entrées runtime corrigés; publication toujours différée jusqu'aux fixtures RFC/crawlers.

## État Git local

- Tentative lancée uniquement dans `/Users/guillaumepapinutti/Developer/ExperienceAlpha/draft-libs/robots-txt-kit`.
- `git init`: OK lors d'une passe ultérieure.
- `git branch -M main`: a affiché un message `HEAD.lock`, mais le dépôt est bien sur `main`.
- Commits locaux créés dans le dossier du brouillon.
- Aucun remote ajouté.
- Aucune commande Git n'a été lancée dans le workspace parent.
