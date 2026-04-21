# PittHub

PittHub is an open community hub for University of Pittsburgh students. It's a shared
space to connect, play, and discover the people on your campus. It hosts a
collection of Pitt-themed daily games and tools that are powered by real
student profiles, so every game becomes a fun way to learn about other Panthers.

**Play the live version here:** [https://koljahribar.github.io/pitty-games-frontend/](https://koljahribar.github.io/pitty-games-frontend/)

## How it works

Students sign up, fill out a profile (home county, major, dorm, clubs, etc.), 
and can opt in to be featured as the
answer to the daily games. Every day at local midnight different
opted-in Panthers are automatically picked, one for Guess Who, one for
Wordle, and one for Student of the Day.

Accounts, profiles, game progress, and daily results are stored in
[Supabase](https://supabase.com/), so stats and streaks follow you across
devices.

## Games & tools

- **Guess Who** — Clues are revealed one at a time (year, major, dorm,
  dining, club, high school). Identify the mystery Panther in as few guesses
  as possible.
- **Wordle** — A Pitt-flavored Wordle where the answer is the last name of
  today's mystery Panther.
- **Student of the Day** — A full profile card for one featured Panther,
  refreshed every day.
- **Impostor** — Spot the Panther who doesn't fit today's shared trait.
- **Connections** — Group Pitt-themed items into four hidden categories.
- **Study Abroad Matcher** — Quick quiz that suggests a Pitt study-abroad
  program based on your answers.

## Project layout

- `index.html` — the PittHub landing page (game cards, auth, profile modal)
- `app.js` — shared auth, profile, and Supabase logic
- `guess-who.html` / `guess-who.js` — Guess Who game
- `wordle.html` / `wordle.js` — Wordle game
- `student-of-the-day.html` / `student-of-the-day.js` — Student of the Day
- `impostor.html` / `impostor.js` — Impostor game
- `connections.html` / `connections.js` — Connections game
- `study-abroad.html` / `study-abroad.js` — Study Abroad Matcher
- `style.css` — Pitt blue/gold styling and responsive layout
- `data/` — static reference data used by some games

## Tech stack

- Plain HTML, CSS, and vanilla JavaScript (no build step)
- [Supabase](https://supabase.com/) for authentication, profile storage, and
  per-user game stats
- Hosted as a static site on GitHub Pages

## Deployment

This site is automatically deployed via GitHub Pages. Any new commits pushed
to the `main` (or `master`) branch will rebuild and update the live website
within a few minutes.
