# English and French interface

The header offers English and French buttons on desktop, mobile and record detail pages. English is the default. Submitting the switch keeps the current local path, query and fragment, saves the choice in a one-year same-site, HTTP-only cookie, and reloads the page. Bookmarks remain in their existing local storage. The form also works without JavaScript, using the same-origin Referer as its return path.

The root layout reads the cookie before rendering, sets `html lang`, and gives the same locale to server and client components. Interface labels, accessible names, navigation, filters, record headings and agenda/vote dates use the selected locale. No visitor request calls a translation service or the local AI model. Add reviewed French interface copy in `features/language/messages.mjs`; interpolate placeholders rather than concatenate grammatical sentences.

This is interface localization. Official notice text, agenda titles, committee names, motions and saved English AI explanations retain their original wording. English content is identified using `lang="en"` and a French note explains this limit. Links still lead to the original official documents. A complete French content-translation pipeline or certification against competition accessibility criteria is outside this implementation.

Language POST requests reject unsupported locales, cross-origin submissions and off-site return URLs. The smoke test checks French server-rendered pages, English request isolation, persistence cookies, preserved navigation targets and rejected requests.

```sh
npm run test:language
npm run check
```
