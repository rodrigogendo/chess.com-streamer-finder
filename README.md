# The Streamer’s Gambit

[GitHub Pages](https://rodrigogendo.github.io/chess.com-streamer-finder/)

A React + TypeScript app that displays live and offline Chess.com streamers, supports search and filtering, and lets users save favorites.

## Project summary

This project pulls data from the public Chess.com streamers API and presents it in a clean dark-themed interface. Users can:

- browse all streamers
- view only live streamers
- filter by favorites
- search by username or display name
- open a stream or profile link when available
- save and remove favorite streamers

## Tech stack

- React
- TypeScript
- Vite
- CSS Modules-style custom styling in a single stylesheet

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Deployment

This project is configured for GitHub Pages deployment via GitHub Actions.

- Push to the `main` branch
- GitHub Actions will build and deploy the app
- The site will be available at the link at the top of this README

## Notes

The app uses relative asset paths for GitHub Pages compatibility and includes a GitHub Actions workflow for automated deployment.
