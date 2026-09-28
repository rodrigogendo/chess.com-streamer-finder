# Project: Chess.com Streamers Listing

This project will use React to create a simple page, with Chess.com visual theme, that lists every streamer that is currently streaming.

## Functionalities

- A search input at the top to search for specific streamers (streamers auto filter as user types the name. If the user types "Hik" for example, show only streamers with "Hik" in their name)
- A grid with all streamers
- A thin bar below the search bar to change search filters:
    -- Top Rated, All and Live Only
- Clicking a streamer will open a new tab to the stream link
- A red pulsing icon at the corner of the streamer picture if they're live
- A grey static icon at the corner of the streamer picture if they're not live
- A star icon on the opposite side of the live icon to add that streamer to a 'Favorites' tab
- Prioritize showing first popular chess personalities (e.g., Hikaru Namakura, Magnus Carlsen, GothamChess, etc)

## Technical

- React, HTML, CSS and Vanilla Typescript
- All files, types, components, etc., should be cleanly organized by folders (use import/export)
- Utilize useEffect and useState

## API

Link for fetch streamers:
https://api.chess.com/pub/streamers

Needed items:
- username
- avatar
- twitch_url
- is_live

Link for fetch streamers' data:
https://api.chess.com/pub/player/{username}/stats

Needed item:
- rating

## Visuals and UI

A page theme similar to Chess.com, using the same color palletes (neutral, light gray, dark mode-like, green details).

Chess.com icon (.src/assets/chess-logo.png), with the title at the top of the page using the classic Chess.com theme. Title: "The Streamer's Gambit"

Search bar at the top, slightly below the title

Smaller bar with toggle/filter options below the search bar

Grid with the streamers list below the toggle/filter bar