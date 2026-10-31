# Layout

`/layout` contient les grandes structures des pages.

- `footer` contient tout ce qui est relatif au ou aux footer(s) par page
- `header` contient tout ce qui est relatif au ou aux header(s) par page
- `main` contient tous les contenus situés entre footer et header

Dans chacun de ces fichier il y a:

- Des règles scss générales à tout type de page
- Des règles scss qui s'appliquent sur des pages spécifiques

Exemple : le scope des règles s'appliquant à la page des mentions légales seulement sera enveloppé dans la class `.page-legal`
La class de page telle que `.page-legal` est déterminé dans les `body` de chaque page et inclu donc le footer et le header.

La création d'une page se fait via le dossier `/controller` en php via l'ajout d'une méthode ou class (POO) de page selon que l'architecture ait évolué.

Reference: [Sass Guidelines](http://sass-guidelin.es/) > [Architecture](http://sass-guidelin.es/#architecture) > [Layout folder](http://sass-guidelin.es/#layout-folder)
