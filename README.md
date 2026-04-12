# JL-website

Statische website voor **Jonge Libertariërs** (HTML, CSS, JavaScript).

**Repository:** [github.com/Mikbit-VS/JL-website](https://github.com/Mikbit-VS/JL-website)

## Lokaal bekijken

Open `index.html` in je browser, of start een eenvoudige server in de projectmap:

```bash
npx --yes serve .
```

Daarna bijvoorbeeld `http://localhost:3000` openen.

## Structuur

| Pad | Inhoud |
|-----|--------|
| `index.html` | Standaard homepage |
| `index-alt.html` | Alternatieve homepage |
| `css/styles.css` | Hoofdstylesheet |
| `js/main.js` | Navigatie, cookies, e.d. |
| `assets/images/` | Logo, hero-afbeeldingen |

## GitHub Pages

De repository bevat een GitHub Actions-workflow die de site kan publiceren.

1. Op GitHub: **Settings → Pages → Build and deployment → Source:** kies **GitHub Actions**.
2. Push naar de branch `main`; workflow **Deploy static site to Pages** draait automatisch.
3. De site wordt bereikbaar op `https://mikbit-vs.github.io/JL-website/` (tenzij je een custom domain instelt).

## Eerste push naar GitHub

Als deze map nog geen remote heeft:

```bash
git init
git branch -M main
git remote add origin https://github.com/Mikbit-VS/JL-website.git
git add .
git commit -m "Initial commit: JL static site"
git push -u origin main
```

Maak het lege repository **JL-website** eerst aan onder de organisatie of gebruiker **Mikbit-VS** op GitHub (zonder README/license, om merge-conflicten te voorkomen), voer daarna bovenstaande commando’s uit.
