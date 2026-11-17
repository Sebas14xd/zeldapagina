# El ciclo de Hyrule

Guía estática en español sobre la cronología y los videojuegos de The Legend of Zelda.

## Estructura

```text
.
├── assets/
│   ├── css/              # Estilos compartidos
│   ├── images/           # Imágenes locales
│   └── js/
│       ├── data/         # Atlas y catálogo de SteamGridDB
│       ├── pages/        # Lógica de páginas y fichas
│       └── shared/       # Utilidades comunes del sitio
├── scripts/
│   └── build-pages.js    # Generador de páginas estáticas
├── index.html
├── juego-*.html
├── ficha-*.html
└── package.json
```

Las páginas HTML generadas permanecen en la raíz para conservar las URLs públicas actuales.

## Desarrollo

No se necesitan dependencias externas. En Windows PowerShell, con Node.js instalado, regenera el sitio con:

```powershell
npm.cmd run build
```

El generador también puede ejecutarse directamente desde cualquier carpeta:

```powershell
node scripts/build-pages.js
```
