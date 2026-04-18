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
