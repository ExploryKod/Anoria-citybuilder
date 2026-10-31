# Base

The `base/` folder holds what we might call the boilerplate code for the project. In there, you might find some typographic rules, and probably a stylesheet (that I’m used to calling `_base.scss`), defining some standard styles for commonly used HTML elements.

Reference: [Sass Guidelines](http://sass-guidelin.es/) > [Architecture](http://sass-guidelin.es/#architecture) > [Base folder](http://sass-guidelin.es/#base-folder)

## Typography

`.dci-title-sm` est une class scss pouvant être utilisé sur les textes afin que celui-ci respecte la nomenclature décidé dans le design system.

Cette class contient:

- L'appel d'une fonction qui génère un clamp afin d'adapter les tailles de textes aux écrans
- Des modifier permettant d'ajouter du gras, de l'italic, un texte justifié etc...
- Une couleur et une typo associé à ce titre
- Dans certains cas Margin et padding sont déterminés et donc scopés séparément et non dans la class de titre/texte elle-même

Typography contient aussi des règles via des scopes qui imposent tel ou tel attribut au texte ou au titre selon la place où il se trouve.

- Le scope des sections ou page est utilisé pour isolé la règle scss: tous le titres dans ce scope produiront par exemple une margin ou padding
- Il est possible de spécifier ici une couleur ou une typo différente si besoin
