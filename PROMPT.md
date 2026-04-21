# AI prompts used for this frontend

This site was built in large collaboration by chatting with AI tools. I leaned on three of them throughout the project:

- **Cursor (Composer / Agent)** with **Claude Opus 4.7** — my main driver for writing and editing the actual code (`index.html`, `style.css`, `app.js`, per-game `.html` / `.js` files, Supabase wiring, UI polish).
- **Google Gemini 3.1** — used outside the editor for research-heavy tasks: finding the 35 Pitt study abroad programs, gathering real 2024/25 stats (cost of living, HRMI, English proficiency, etc.) and turning them into a CSV / normalized JSON dataset.
- **Cursor Auto (smaller models)** — occasional questions like "how do I test this locally" and prompts trying to understand what Opus gave me and how it connect to the rest of the code.

Below are the prompts that actually moved the product forward, grouped by the chat they came from.

## Chat 1 — Initial scaffold & header (Cursor + Opus 4.7)

**1.** Create a web app structure with an index.html, style.css, and app.js. The UI should look like a tittle at the top (Pitty Games), 4 big clickable cards that will later on take you to specific games and a footer with this in it:
"

What are Pitty Games?
Pitty Games are your home for daily Pitt games. Test your knowledge of students, the university, and the city through games like Grid, Bingo, Wordle, Connections with new challenges every single day.

When do daily games reset?
Games reset every day at midnight, allowing you to play fresh set of challenges every 24 hours.

Will new games be added?
Absolutely. Pitty Games are expanding with new daily game modes, along with fresh challenges to keep things exciting.

Created by Kolja Hribar in collaboration with Google Gemini and Cursor"

Use a clean, modern color palette (perferably Pitt colours, make it Pitt themed and include the Pitt logo or Pittsburgh landmarks).

**2.** Colors are good but the logos arent working properly. Centralize the title and footer text instead of left leaning text. Put a Pittsburgh university logo (old panthers one or new Pitt one) in the top left corner of the screen. Put a log in and sign up button in the top right of the screen. Make them match with the current screen colors and make them be modern shape

**3.** remove all the code responsible for the logo in the top left corner of the page. Keep the website as it is, just dont have the feature of the top left corner having the logo

**4.** put the title Pitty Games back to the center top of the website, like it was before.

---

## Chat 2 — Supabase authentication (Cursor + Opus 4.7)

**1.** I need to integrate Supabase authentication into my existing frontend using the Supabase CDN. Please update my `index.html` and `app.js` with the following requirements, making sure NOT to delete any of my existing layout or game logic:

1. In `index.html`: Add the Supabase CDN script `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>` just before my `app.js` script tag.
2. In `app.js`: At the very top of the file, initialize the Supabase client using `window.supabase.createClient()`. Use placeholder strings for the URL and anon key for now.
3. In `index.html`: Ensure there is a basic Auth modal or section with inputs for 'email' and 'password', and two buttons: "Sign Up" and "Log In". Ensure they have clear IDs.
4. In `app.js`: Add event listeners to the Sign Up and Log In buttons.
   - For Sign Up: Use `supabase.auth.signUp()`. If there's an error, show an alert with the error message. If successful, alert "Success! Check your email to confirm your account."
   - For Log In: Use `supabase.auth.signInWithPassword()`. If there's an error, show an alert. If successful, alert "Logged in successfully!" and hide the Auth modal.

Please implement this and ensure the new code blends seamlessly with my current setup.

**2.** I inspected the page on safari, tried clicking a few buttons but really nothing appeared in conosle. its like the buttons dont do anything after clicking them. and it goes for all the buttons. even the game buttons, which previously said "coming soon" are now doing nothing — fix the bug.

**3.** When a user clicks the log in button, a box like now should appear, but it shoudl only let them log in. currenlty there are two buttons for the box for the log in button and log in and sign in buttons for the sign up as well. make it so it makes sense when you click the sign up button to bo signing up and when clicking the log in button to only log in

---

## Chat 3 — Profile management (Cursor + Opus 4.7)

**1.** My Supabase authentication is working. Now I need a Profile management system. Please update my `index.html` and `app.js` with the following:

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

**2.** the log out button isnt logging out. fix the issue so that the profile and log in buttons appear only after the user logs in (when the user is logged in, sign up and log in buttons should disappear). whn the user clicks log out button, log in and sign in buttons appear again

**3.** I have added 10 new columns to my 'profiles' table in Supabase. I need to update my Profile UI to allow users to fill these out.

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

## Chat 4 — Guess Who game (Cursor + Opus 4.7)

**1.** Context: daily puzzle web app for university students using Vanilla JavaScript, HTML, CSS, and the Supabase JS CDN. Database: `profiles` (id, first_name, last_name, major, year, high_school, freshman_dorm, campus_job, favorite_floor_of_cathy, favorite_dining_option, most_used_bus_number, worst_professor_taken, best_professor_taken, frat_sorority, favorite_pitt_club, …) and `daily_puzzles` (id, puzzle_date, target_profile_id).

**Task 1 — `index.html`:** Find the existing "Grid" game card; rename it to "Guess Who"; change its button/link to navigate to `guess-who.html` instead of a "Coming Soon" toast.

**Task 2 — `guess-who.html`:** New file with same overall header/navigation styling as `index.html`; Supabase CDN in `<head>`; main UI: Back to `index.html`, clue container (cards per revealed clue), autocomplete name search with absolute-positioned dropdown `<ul>`, Guess button, guess history list, hidden-by-default results modal (win/loss, target full name, "Copy Results" to clipboard emojis); script `guess-who.js` at bottom.

**Task 3 — `guess-who.js`:** Initialize Supabase (placeholder URL/key acceptable initially). Clue order (6 guesses): `year`, `major`, `freshman_dorm`, `favorite_dining_option`, `favorite_pitt_club`, `high_school`. On load: `localStorage` check if already played today → show results modal; fetch today's `daily_puzzles` (local date), target profile, all profiles' names for autocomplete. Reveal first clue immediately; wrong guess → history, clear input, next clue; correct → win modal + `localStorage`; six wrong → loss modal + `localStorage`.

**2.** After a win, users could not return to the hub. Replace "Copy results" with a **Back to home** control to `index.html`. The only way out of the win/loss overlay should be **Back to home** (no × close, no backdrop/Escape dismiss).

**3.** New Supabase table `user_game_stats`: `user_id`, `game_type`, `total_wins`, `current_streak`, `last_played_date`, `today_status`, `today_guesses` (jsonb). **Remove all Guess Who `localStorage` usage.**

**On load (`guess-who.js`):** Require logged-in user (`getUser`). Fetch row where `game_type` = `'guess_who'`. If no row: insert defaults (`total_wins` 0, `current_streak` 0, `today_status` `'in_progress'`, `today_guesses` `[]`, `last_played_date` today). If row exists and `last_played_date` ≠ today: reset `today_status` to `'in_progress'`, `today_guesses` to `[]`, set `last_played_date` to today (preserve wins/streak). If `today_status` is `'won'` or `'lost'`: show end-game modal immediately. If `'in_progress'`: restore UI from `today_guesses` so the user can resume.

**During play:** After each guess, `upsert` updated `today_guesses`. On **win:** increment `total_wins` and `current_streak`, set `today_status` `'won'`. On **loss** (six wrong): set `current_streak` to 0, `today_status` `'lost'`.

**UI:** On `guess-who.html`, show **Score** (`total_wins`) and **Streak**; on **`index.html`** Guess Who card, show the user's Guess Who score when logged in.

**Database:** `upsert` with `onConflict` on `(user_id, game_type)` requires a matching unique constraint in Supabase.

---

## Chat 5 — Wordle game (Cursor + Opus 4.7)

**1.** Build a **Wordle**-style game as a **standalone** `wordle.html` / `wordle.js` page (Vanilla JS, HTML, CSS), reusing the site header and `style.css`, with Supabase CDN.

**Hub (`index.html`):** Point the Wordle game card at `wordle.html` (same pattern as the Guess Who link card).

**UI (`wordle.html`):** Back to hub; subtitle for target + letter count; empty **grid** and **on-screen keyboard** (QWERTY + ENTER + BACKSPACE); **results modal** matching `guess-who.html` (score, streak, revealed name); link `wordle.js` at the bottom.

**Data / logic (`wordle.js`):** Mirror Guess Who's Supabase flow: `daily_puzzles` (today's row) → `profiles` for the target; `user_game_stats` with `game_type = 'wordle'`, same **ensure / upsert** pattern as Guess Who (new day resets `today_status` / `today_guesses`). Fetch stats; if `today_status` is `in_progress`, restore **`today_guesses`** into the grid with correct tile colors.

**Gameplay:** Exactly **5** rows; columns = target word length. Target word from profile: **clean** (remove spaces/hyphens, uppercase). Physical + virtual keyboard; Enter submits only when guess length matches; **no dictionary check**. Tiles: green / yellow / gray with **correct Wordle duplicate-letter behavior**; keyboard keys reflect best-known state per letter. On each guess, upsert `today_guesses`. **Win** = exact match → `today_status = 'won'`, increment wins and streak, show modal. **Loss** after 5 misses → `lost`, streak 0, modal.

**2.**
1. Show **Score** on the **Wordle** card on the home screen the same way as Guess Who (`user_game_stats` for `game_type = 'wordle'`).
2. **Fix** Wordle so the answer is **only** the user's **last name** (no first-name / day-of-month rule).
3. Update the **game intro** (and related copy) on the Wordle page to match last-name play.

---

## Chat 6 — Impostor game (Cursor + Opus 4.7)

**1.** Context: Daily puzzle web app for university students with working Guess Who and Wordle. Build an **Impostor** odd-one-out game as a standalone page using Vanilla JS/HTML/CSS and Supabase.

1. **Hub (`index.html`)**: Replace Bingo placeholder with **Impostor** and link to `impostor.html`.
2. **UI (`impostor.html`)**: Keep site header/style; include Supabase CDN; add Back button; subtitle
   "Find the Impostor: 4 of these students share something in common. 1 does not. You have 1 guess.";
   render 5 large clickable name buttons; include a results modal matching Guess Who stats layout plus
   `<p id="results-modal-explanation">` for post-game explanation.
3. **Logic (`impostor.js`)**: Use `user_game_stats` upsert flow with `game_type = 'impostor'`; fetch today's target from `daily_puzzles`; fetch all `profiles`; find first qualifying shared attribute among non-impostors; deterministic sorting by first name; one guess only; on click set win/loss, persist stats, and show modal with explanation + updated score/streak.

**2.** When running Impostor, UI showed "Today's puzzle could not be built from profile data. Check back later." Given only 5 students in the DB, fix the bug so the game still renders and is playable.

**3.** Show the **Impostor** score on the home card the same way as Guess Who and Wordle. Display score even when it is **0** (do not hide the badge for new users). Investigate/fix why **Impostor** and **Connections** card scores were not showing and make them visible.

---

## Chat 7 — Study Abroad dataset (Google Gemini 3.1)

**1.** Find 35 Pitt study abroad programs and gather 7 stats for each: 2026 Cost of Living in Dollars, Average Temperature, 2026 Population Density, Distance from Pittsburgh, 2026 Human Rights Index, English Proficiency, program duration.

Take all the programs you find from the Pitt study abroad website, pick a main location they are set in and fill out the row in the csv with data for that location (ideally a city, if its multiple cities, average the data out). Use the most recent published values (2024/2025 from Numbeo, Worldometers, HRMI, Climate-data.org) and label them honestly. Output as a CSV.

**2.** I have a CSV structure with columns: `program_name,primary_city,country,cost_of_living_usd_monthly_no_rent,avg_temp_celsius,population_density_per_km2,distance_from_pgh_miles,hrmi_quality_of_life_score,english_proficiency_ef_epi_2024,program_duration_weeks,notes`.

Write a Python script using pandas that applies min-max normalization to numeric columns so every value is between `0.0` and `1.0`, output to `normalized_programs.json`, and include a single `feature_vector` array per program.

**3.** Add these 3 columns to the JSON for every program: `image_url`, `pro_text`, `con_text`. For each program, use a city image plus one unique pro and one unique con.

---

## Chat 8 — Study Abroad feature (Cursor + Opus 4.7)

**1.** I am adding a 'Study Abroad Matcher' tool to my existing vanilla HTML/JS hub. It will be a card replacing the Connections card, it will have no score and it should link to the study-abroad.html

Create a new file called study-abroad.html. It should use the exact same header, navigation, and footer structure as my guess-who.html file.

In the main content area, create a UI for a stack of swipeable cards (similar to a dating app). Each card should have placeholders for an image, the program name, the location, and a section below for 'AI Pro' and 'AI Con'.

Update style.css to handle the absolute positioning required to stack these cards on top of each other. Add smooth CSS transitions for when a card is dragged and released.

Create a basic study-abroad.js file. Pull in the Hammer.js library via CDN and set up the event listeners so the top card can be dragged. If dragged far enough right, trigger a 'Like' console log and animate the card off-screen. If dragged left, trigger a 'Pass' console log and animate it off-screen.

**2.** Give me the SQL command to create a new Supabase table called `study_abroad_programs`. It needs the following columns: id (uuid), name (text), location (text), image_url (text), pro_text (text), con_text (text), and feature_vector (float array). Also, provide the JavaScript code to fetch all these rows in my app.js file using my existing Supabase client.

**3.** I have a JSON file named `normalized_programs.json`. The array of study abroad programs is located inside the "programs" key.

Write a one-off Node.js script (`seed.js`) using `@supabase/supabase-js` that reads the JSON file, iterates through the "programs" array, and maps the data to match my SQL columns exactly:
- `name`: comes from `program_name`
- `location`: combine `primary_city` and `country` (e.g., 'London, United Kingdom')
- `image_url`, `pro_text`, `con_text`, `feature_vector`: as-is

**4.** Connect the Study Abroad card (currently placeholder) to the `study_abroad_programs` table and make it a real product. Each card's image is the row's `image_url`; the user swipes right (like) or left (pass).

In `study-abroad.js`:
- Initialize Supabase using the existing credentials from other game files.
- On page load, fetch all rows from `study_abroad_programs` into `remainingPrograms`, and render the first few programs into the card-stack UI.
- Create `userProfileVector` (array of floats, initially zeros) and a `likedCount` variable.
- Implement an Euclidean distance helper between two numeric arrays.
- On swipe right: average the liked program's `feature_vector` into `userProfileVector` (running mean).
- Whenever `userProfileVector` updates, re-sort `remainingPrograms` ascending by Euclidean distance between the new profile vector and each program's `feature_vector`.
- Ensure the next top card is always `remainingPrograms[0]` after sorting.

**5.** Add a "Top match" results screen once the deck empties. Track liked programs during the session. When `remainingPrograms` is empty, hide the swipe actions and display the liked program closest (smallest Euclidean distance) to `userProfileVector` as the top match — show its image, name, location, a "Why you'll love it" block populated from `pro_text`, a "Based on N liked programs" meta line, and Start over / Back to home buttons. Handle the zero-likes case gracefully.

---

## Chat 9 — Home-screen card UI refresh (Cursor + Opus 4.7)

**1.** Make the follwoing changes to the UI of the cards on home screen:
- Make the title bigger, centralized and follow the Pitt theme
- Delete the current emojies in the top right side of the cards
- Delete the mini description of the game from evey card on home screen
- Make the Score and Title appear more visually modern and exciting. No bland simple white background Cards with just words and a hwole lot of empty space

**2.** This looks a lot better. Now make the titles of the card in gold and not just plain text but a bit more inticing, attracting the user to click on them.

**3.** Put more lightnings out of the cards, currently its a single bolt per card. Make it multiple bolts per card and make them be spread out, not mimicking a straight line. Have them start from the cards and end right before the left/right sides of a screen with a little arrow at the end. Only horizontal — no lightning should go up or down.

**4.** Add more bolts for each card. I like the fact that it is symetric, but make them more srepad out. A couple of bolts shoudl aim for the bottom/top right/left parts of the white chunk fo the screen. Remove the mini stars at the end of the bolts, dont make the bolts a fading colour, make the strong gold. Some lightning bolt sshould have multiple lightning bols come out of them, spreading like branches on a tree. Make sure the bolts dont intersect though

**5.** Delete the lightning bolts completely. Instead put golden footprints and paws on that empty white space right and left of the cards. Make the footprints be spread out, on random locations in that empty white space.

---

## Chat 10 — Student of the Day & Connections (Cursor + Opus 4.7)

**1.** Create two more cards on the home page. One card will be for the "Student of the Day" game and the other will be for the game "Connections". Do it the same way other cards are made. Make sure on the home screen that the paws footsteps extend to the 2 new cards as well. Create the .js and .html files for the 2 games. Dont make the games yet, whenever the user clicks on the card, it should give a message "in progress".

**2.** Make the following implementations for the Student of the Day segment. It shows a random student from the database, updated everyday at midnight like the other games. It would just be information about the student taken from the profiles table, presented in a modern and Pitt related way.

**3.** Implement the following version of the Connections game: everyday show 3 different students that have something in common (same year, same high school, same freshman dorm...). The user should have ABCD options to guess from (ABCD options should be columns from the profiles table). Scoring should be handled and implemented as for the other games. The game should fundamentally operate the same way as the other games.

**4.** Move the Connections card to be in the middle right spot of the home screen and move the Study Abroad card into the bottom right spot of the home screen for cards.

**5.** Bug in the Connections game: instead of just the names being visible, all the info associated to the students is shown. It should be just 3 names and then beneath them ABCD options. Fix the bug.
