# Donnees elm.leblanc - Murale basse temperature tirage naturel

Extraction realisee depuis:

`https://www.catalogueinteractif.elmlecube.fr/Product/ProductByFilter?idFilter=71&idBrand=E0`

Categorie source:

`elm.leblanc > Gaz > Chaudiere murale > Basse temperature > Tirage naturel`

## Fichiers principaux

- `elmleblanc-tirage-naturel-metadata.json`
  - resume de l'extraction: nombre de modeles, pieces, vues eclatees, documents.

- `elmleblanc-tirage-naturel-models.json`
  - liste des appareils.
  - cle principale: `id`.
  - champs utiles: `reference`, `displayName`, `familyName`, `productUrl`, `mainDrawingUrl`, `partCount`, `documentCount`.

- `elmleblanc-tirage-naturel-parts-by-model.json`
  - arborescence des pieces par appareil.
  - cle racine: `modelId`.
  - chaque appareil contient `sections[]`, puis `sections[].parts[]`.
  - chaque piece contient `position`, `label`, `itemId`, `reference`, `detailsUrl`.

- `elmleblanc-tirage-naturel-part-details.json`
  - details publics des references de pieces uniques.
  - cle: reference de piece.
  - champs utiles: `statusMessage`, `reference`, `designation`, `ean`, `detailsUrl`.

- `elmleblanc-tirage-naturel-exploded-views.json`
  - vues eclatees PDF par appareil.
  - cle racine: `modelId`.
  - chaque vue contient `level`, `position`, `title`, `pdf`, `url`.

- `elmleblanc-tirage-naturel-documents-by-model.json`
  - documentations par appareil.
  - cle racine: `modelId`.
  - chaque document contient `title`, `mimeType`, `uri`, `url`.

## Fichiers JavaScript

Les memes donnees existent aussi en `.js` avec des variables globales:

- `ELMLEBLANC_TIRAGE_NATUREL_MODELS`
- `ELMLEBLANC_TIRAGE_NATUREL_PARTS_BY_MODEL`
- `ELMLEBLANC_TIRAGE_NATUREL_PART_DETAILS`
- `ELMLEBLANC_TIRAGE_NATUREL_EXPLODED_VIEWS`
- `ELMLEBLANC_TIRAGE_NATUREL_DOCUMENTS_BY_MODEL`

Ces fichiers sont pratiques si l'application charge deja ses catalogues avec des balises `<script>`.

## Liaison recommandee pour l'application

1. Afficher les appareils depuis `models`.
2. Au clic sur un appareil, charger ses pieces avec `partsByModel[model.id]`.
3. Afficher les vues eclatees avec `explodedViews[model.id]`.
4. Enrichir une piece avec `partDetails[part.reference]`.
5. Afficher les notices et listes PDF avec `documentsByModel[model.id]`.

## Donnees brutes

Les reponses HTML/JSON sources sont archivees dans:

`backups/elmleblanc-tirage-naturel-raw/`
