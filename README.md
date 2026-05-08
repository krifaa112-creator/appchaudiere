# BoilerCore EGS ENERGIES

Application locale/PWA pour gérer un catalogue de chaudières, modèles et pièces de rechange.

## Lancer l'application

Ouvrez `index.html` directement dans un navigateur, ou servez le dossier en local:

```bash
python -m http.server 8080
```

Puis ouvrez `http://localhost:8080`.

## Fonctionnalités

- Comptes locaux avec rôles admin/operator.
- Catalogue de modèles de chaudières et pièces associées.
- Ajout automatique de 261 modèles Saunier Duval depuis le fichier Excel fourni.
- Ajout automatique de 22 200 pièces détachées pour 246 modèles Saunier Duval trouvés.
- `DUOMAX CONDENS F30 90.1` est complété depuis PiecesXpress avec les codes PEX.
- Recherche par modèle, fabricant, code-barres, lien, note ou numéro de pièce.
- Filtres par fabricant et catégorie, avec tri du catalogue.
- Export JSON/CSV et import JSON pour les admins.
- Scanner code-barres avec saisie manuelle de secours.
- Installation possible comme application web quand servie en HTTP/HTTPS.
