# AI prompts used for this frontend

This UI was built and iterated with **Cursor** using its **AI Agent** (automated code edits in the editor). The site footer credits **Google Gemini** and **Cursor** as collaborators; day-to-day file changes were driven through Cursor’s agent. Exact model names can vary by Cursor version (e.g. Auto / Composer routing).

Below are the **main user prompts** (verbatim from the chat) that shaped how the site looks and behaves today.

---

## Crucial prompts

### 1 — Initial scaffold

Create a web app structure with an index.html, style.css, and app.js. The UI should look like a tittle at the top (Pitty Games), 4 big clickable cards that will later on take you to specific games and a footer with this in it: 
"

What are Pitty Games?
Pitty Games are your home for daily Pitt games. Test your knowledge of students, the university, and the city through games like Grid, Bingo, Wordle, Connections with new challenges every single day.

When do daily games reset?
Games reset every day at midnight, allowing you to play fresh set of challenges every 24 hours.

Will new games be added?
Absolutely. Pitty Games are expanding with new daily game modes, along with fresh challenges to keep things exciting.

Created by Kolja Hribar in collaboration with Google Gemini and Cursor"

Use a clean, modern color palette (perferably Pitt colours, make it Pitt themed and include the Pitt logo or Pittsburgh landmarks). 

### 2 — Header, footer, auth buttons

Colors are good but the logos arent working properly. Centralize the title and footer text instead of left leaning text. Put a Pittsburgh university logo (old panthers one or new Pitt one) in the top left corner of the screen. Put a log in and sign up button in the top right of the screen. Make them match with the current screen colors and make them be modern shape

### 3 — `images/` + panthers corner, hide background

everything worked perfectly except the logo part. scratch the current code for the logo and rather create a folder named images. put the panthers.jpg in it. then put the panthers.jpg into the top left corner of the screen. Make sure just the panthers logo is seen and not the background of the picture

### 4 — Same logo + mobile polish

Make the panthers.jpg in the current images folder the logo that appears in the top left side of the screen. It should be just the logo, no background whatsoever. ALso make the website better compatible for mobile phones

### 5 — Fresh `app.js`, static JPG path

write me the app.js file from scratch. make sure it worked as before apart from the logo in the top left corner. make sure its the panthers.jpg currently in the folder. move it to the images folder and reference it from there

### 6 — Logo blend into header

Edit the current logo in the top left of the screen to blend in with the background.

### 7 — Revert blend, switch to AVIF, larger logo

return back to the previous version of the folder (1 prompt back). use pitt.avif instead of panthers.jpg for the logo in the top left. no need to worry about the background this time. just make sure that the logo is a bit bigger

### 8 — Remove logo entirely

remove all the code responsible for the logo in the top left corner of the page. Keep the website as it is, just dont have the feature of the top left corner having the logo

### 9 — Center title again

put the title Pitty Games back to the center top of the website, like it was before.

### 10 — Supabase authentication (CDN + modal)

I need to integrate Supabase authentication into my existing frontend using the Supabase CDN. Please update my `index.html` and `app.js` with the following requirements, making sure NOT to delete any of my existing layout or game logic:

1. In `index.html`: Add the Supabase CDN script `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>` just before my `app.js` script tag.
2. In `app.js`: At the very top of the file, initialize the Supabase client using `window.supabase.createClient()`. Use placeholder strings 'https://ydbivwgowrzrkntiasef.supabase.co ' and 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYml2d2dvd3J6cmtudGlhc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTE1OTQsImV4cCI6MjA5MjEyNzU5NH0.gfuxly4T4sEZKzZX2TaEe4x4so5ATK9whLBPnCLM4NA' for now.
3. In `index.html`: Ensure there is a basic Auth modal or section with inputs for 'email' and 'password', and two buttons: "Sign Up" and "Log In". Ensure they have clear IDs.
4. In `app.js`: Add event listeners to the Sign Up and Log In buttons. 
    - For Sign Up: Use `supabase.auth.signUp()`. If there's an error, show an alert with the error message. If successful, alert "Success! Check your email to confirm your account."
    - For Log In: Use `supabase.auth.signInWithPassword()`. If there's an error, show an alert. If successful, alert "Logged in successfully!" and hide the Auth modal.

Please implement this and ensure the new code blends seamlessly with my current setup.

### 11 — How to test locally

how to test this locally?

### 12 — Auth buttons not responding (diagnostic)

I tried to press log in and sign up buttons but nothing happened as of yet. is that because THere are bugs in the current code, or is it because i need to further set up the supabase

### 13 — Safari: no button clicks work

I inspected the page on safari, tried clicking a few buttons but really nothing appeared in conosle. its like the buttons dont do anything after clicking them. and it goes for all the buttons. even the game buttons, which previously said "coming soon" are now doing nothing

### 14 — Fix Safari button / script issue

Fix the bug of nothing happening when i click the buttons in safari

### 15 — Auth modal: login vs signup only

When a user clicks the log in button, a box like now should appear, but it shoudl only let them log in. currenlty there are two buttons for the box for the log in button and log in and sign in buttons for the sign up as well. make it so it makes sense when you click the sign up button to bo signing up and when clicking the log in button to only log in

### 16 — Profile management system

My Supabase authentication is working. Now I need a Profile management system. Please update my `index.html` and `app.js` with the following:

1. UI Updates (`index.html`):
- Add a "Profile" button to the navigation that is ONLY visible when the user is logged in.
- Create a new "Profile Modal" (hidden by default) with input fields for: First Name, Last Name, School, Major, Year (dropdown: Freshman, Sophomore, Junior, Senior, Grad), favorite sport, home county and a checkbox for "Opt-in to be a daily puzzle answer".
- Add a "Save Profile" button inside the modal.

2. Logic Updates (`app.js`):
- Listen for authentication state changes using `supabase.auth.onAuthStateChange()`. If a user is logged in, hide the Login/Signup buttons and show the Profile button + Logout button.
- When the "Save Profile" button is clicked, gather the form data and the current user's ID (`supabase.auth.getUser()`).
- Use `supabase.from('profiles').upsert()` to save the data to the 'profiles' table. Ensure the payload includes the user's `id`, `email`, and the form fields.
- Alert the user on success or failure. 

Ensure the styling matches my existing Pitt-themed design.

### 17 — Log out + header visibility

the log out button isnt logging out. fix the issue so that the profile and log in buttons appear only after the user logs in (when the user is logged in, sign up and log in buttons should disappear). whn the user clicks log out button, log in and sign in buttons appear again

### 18 — Remove school from profile

remove the school question on the profile part. Keep everything else the same, just no school

### 19 — Profile columns: `is_opted_in` and `updated_at`

this is what it said when i tried to input in the profile:
Could not find the 'opt_in_daily_puzzle_answer' column of 'profiles' in the schema cache
in my supabase i have a is_opted_in and updated_at columns. fix the issue so my next entry is correctly handled

### 20 — Profile column `year` (not `school_year`)

the problem is again:
Could not find the 'school_year' column of 'profiles' in the schema cache
Look at how its named in the actual database and fix the names you made:
id
uuid
PRIMARY
FOREIGN KEY
NON-NULLABLE

Edit

email
text
NULLABLE

Edit

first_name
text
NULLABLE

Edit

last_name
text
NULLABLE

Edit

major
text
NULLABLE

Edit

year
text
NULLABLE

Edit

favorite_sport
text
NULLABLE

Edit

home_county
text
NULLABLE

Edit

is_opted_in
bool
NULLABLE

Edit

updated_at
timestamptz
NULLABLE

Edit


### 21 — Ten new profile columns + grouped UI

I have added 10 new columns to my 'profiles' table in Supabase. I need to update my Profile UI to allow users to fill these out.

1. UI Updates (`index.html`):
Inside my existing Profile Modal, add input fields for the following new attributes. Group them logically (e.g., put academics together, campus life together) so the form isn't overwhelming. Use dropdowns where it makes sense (like for "Favorite Floor of Cathy" 1-40, or "Most Used Bus" 71A, 71B, 71C, 71D, 61A, 61B, 61C, 61D, 10A).
- High School
- Freshman Dorm
- Campus Job
- Favorite Floor of Cathy
- Favorite Dining Option
- Most Used Bus Number
- Worst Professor Taken
- Best Professor Taken
- Frat/Sorority
- Favorite Pitt Club

2. Logic Updates (`app.js`):
Update the "Save Profile" event listener. It needs to grab the values from all these new inputs and include them in the `supabase.from('profiles').upsert()` payload. 
Make sure the keys in the JavaScript payload exactly match the database columns (snake_case): high_school, freshman_dorm, campus_job, favorite_floor_of_cathy, favorite_dining_option, most_used_bus_number, worst_professor_taken, best_professor_taken, frat_sorority, favorite_pitt_club.

Ensure the modal is scrollable and looks good on mobile, maintaining the Pitt visual theme.

---

### 22 — Guess Who: hub card, standalone page, Supabase game loop (initial spec)

Context: daily puzzle web app for university students using Vanilla JavaScript, HTML, CSS, and the Supabase JS CDN. Database: `profiles` (id, first_name, last_name, major, year, high_school, freshman_dorm, campus_job, favorite_floor_of_cathy, favorite_dining_option, most_used_bus_number, worst_professor_taken, best_professor_taken, frat_sorority, favorite_pitt_club, …) and `daily_puzzles` (id, puzzle_date, target_profile_id).

**Task 1 — `index.html`:** Find the existing “Grid” game card; rename it to “Guess Who”; change its button/link to navigate to `guess-who.html` instead of a “Coming Soon” toast.

**Task 2 — `guess-who.html`:** New file with same overall header/navigation styling as `index.html`; Supabase CDN in `<head>`; main UI: Back to `index.html`, clue container (cards per revealed clue), autocomplete name search with absolute-positioned dropdown `<ul>`, Guess button, guess history list, hidden-by-default results modal (win/loss, target full name, “Copy Results” to clipboard emojis); script `guess-who.js` at bottom.

**Task 3 — `guess-who.js`:** Initialize Supabase (placeholder URL/key acceptable initially). Clue order (6 guesses): `year`, `major`, `freshman_dorm`, `favorite_dining_option`, `favorite_pitt_club`, `high_school`. On load: `localStorage` check if already played today → show results modal; fetch today’s `daily_puzzles` (local date), target profile, all profiles’ names for autocomplete. Reveal first clue immediately; wrong guess → history, clear input, next clue; correct → win modal + `localStorage`; six wrong → loss modal + `localStorage`.

### 23 — Guess Who: Supabase credentials + guess input focus

The game showed “Supabase is not configured” and the guess field would not take focus/cursor. Fix by using the same `SUPABASE_URL` and `SUPABASE_ANON_KEY` as in `app.js` (lines 4–7). Do not disable the search input when only Supabase init fails (so the field is not stuck unfocusable); keep the Guess button disabled if appropriate.

### 24 — Guess Who: results modal — home navigation and optional dismiss

After a win, users could not return to the hub; only “Copy results” existed. Replace “Copy results” with a **Back to home** control to `index.html`. Add an **×** in the corner (and backdrop/Escape dismiss) so users can close the modal and still see the Guess Who page (clues, history) after finishing.

### 25 — Guess Who: results modal — home only (remove ×)

Remove the × close and any dismiss-by-backdrop or Escape behavior. The only way out of the win/loss overlay should be **Back to home** (link to `index.html`).

### 26 — Guess Who: `user_game_stats` replaces `localStorage` (multi-device)

New Supabase table `user_game_stats`: `user_id`, `game_type`, `total_wins`, `current_streak`, `last_played_date`, `today_status`, `today_guesses` (jsonb). **Remove all Guess Who `localStorage` usage.**

**On load (`guess-who.js`):** Require logged-in user (`getUser`). Fetch row where `game_type` = `'guess_who'`. If no row: insert defaults (`total_wins` 0, `current_streak` 0, `today_status` `'in_progress'`, `today_guesses` `[]`, `last_played_date` today). If row exists and `last_played_date` ≠ today: reset `today_status` to `'in_progress'`, `today_guesses` to `[]`, set `last_played_date` to today (preserve wins/streak). If `today_status` is `'won'` or `'lost'`: show end-game modal immediately. If `'in_progress'`: restore UI from `today_guesses` (array of wrong guess strings) so the user can resume.

**During play:** After each guess, `upsert` updated `today_guesses`. On **win:** increment `total_wins` and `current_streak`, set `today_status` `'won'`, persist. On **loss** (six wrong): set `current_streak` to 0, `today_status` `'lost'`, persist.

**UI:** On `guess-who.html`, show **Score** (`total_wins`) and **Streak**; in the results modal, show updated score and streak. On **`index.html`** Guess Who card (if possible), show the user’s Guess Who score when logged in (`app.js` fetching the same table).

**Database:** `upsert` with `onConflict` on `(user_id, game_type)` requires a matching unique constraint in Supabase.

### 22 — Wordle clone (Vanilla JS page + Supabase)

Build a **Wordle**-style game as a **standalone** `wordle.html` / `wordle.js` page (Vanilla JS, HTML, CSS), reusing the site header and `style.css`, with Supabase CDN.

**Hub (`index.html`):** Point the Wordle game card at `wordle.html` (same pattern as the Guess Who link card).

**UI (`wordle.html`):** Back to hub; subtitle for target + letter count; empty **grid** and **on-screen keyboard** (QWERTY + ENTER + BACKSPACE); **results modal** matching `guess-who.html` (score, streak, revealed name); link `wordle.js` at the bottom.

**Data / logic (`wordle.js`):** Mirror Guess Who’s Supabase flow: `daily_puzzles` (today’s row) → `profiles` for the target; `user_game_stats` with `game_type = 'wordle'`, same **ensure / upsert** pattern as Guess Who (new day resets `today_status` / `today_guesses`). Fetch stats; if `today_status` is `in_progress`, restore **`today_guesses`** into the grid with correct tile colors.

**Gameplay:** Exactly **5** rows; columns = target word length. Target word from profile: **clean** (remove spaces/hyphens, uppercase). Physical + virtual keyboard; Enter submits only when guess length matches; **no dictionary check**. Tiles: green / yellow / gray with **correct Wordle duplicate-letter behavior**; keyboard keys reflect best-known state per letter. On each guess, upsert `today_guesses`. **Win** = exact match → `today_status = 'won'`, increment wins and streak, show modal. **Loss** after 5 misses → `lost`, streak 0, modal.

*(Original spec also asked for alternating first vs last name by calendar day; product direction later fixed the game to **last names only** — see prompt 23.)*

### 23 — Wordle hub score + last names only

1. Show **Score** on the **Wordle** card on the home screen **the same way** as Guess Who (e.g. `Score: …` using `user_game_stats` for `game_type = 'wordle'`).
2. **Fix** Wordle so the answer is **only** the user’s **last name** (no first-name / day-of-month rule).
3. Update the **game intro** (and related copy) on the Wordle page to match last-name play.
