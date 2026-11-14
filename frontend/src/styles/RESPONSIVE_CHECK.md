# Responsive check (CCD-138)

Open the app (`npm run dev`), open browser DevTools (F12), turn on the device toolbar
(Ctrl+Shift+M in Chrome/Edge), set the width and take a screenshot of each page.

| Width | Device | What to check |
|---|---|---|
| 375 px | Phone | Menu button shows; tapping it opens the links; no sideways scroll; search box and Go button fit |
| 768 px | Tablet | Links are in the bar (at 768 px and below they collapse into the menu); county grid has several columns |
| 1280 px | Laptop | Content is centred (max 72rem); footer text lines are not too long |

Pages to check at each width: Home (/), County (/county/cork), Compare, Flooding, About, Log in, Not found.
