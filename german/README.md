# Lingo — German ↔ English Flashcard Trainer

A Duolingo-styled flashcard app. Flip a card, test yourself, and the ones
you miss keep coming back (more often, the more you miss them) until you've
cleared every card in the lesson.

## Run it

Just **double-click `index.html`** — it opens in your browser. No install, no
server, works offline. (An internet connection only makes the font prettier.)

## How the learning works (Leitner system)

- Each lesson is a small batch of cards. You must clear **all** of them to finish.
- **Got it** → the card graduates and the progress bar moves.
- **Missed it** → you lose a heart, the card comes back **soon**, and it now
  needs to be answered right **more times in a row** before it clears. Miss it
  again and it comes back even sooner. Nothing leaves until it truly sticks.
- Combos, XP, hearts, streak, and confetti — the dopamine stuff.

## Direction toggle

On the home screen pick **German → English** or **English → German**.
The prompt side of every card flips accordingly; the word *and* the example
phrase both show.

## Adding your own cards  ←  the only file you touch

Open `js/cards.js` and edit the `WORDS` array. Each card:

```js
{
  german:        "das Haus",              // the German word/term
  english:       "the house",             // the English meaning
  germanPhrase:  "Das Haus ist groß.",    // (optional) example phrase, German
  englishPhrase: "The house is big.",     // (optional) example phrase, English
}
```

- `germanPhrase` / `englishPhrase` are optional — leave them out for a plain word.
- Cards are automatically split into lessons of `LESSON_SIZE` (default 6,
  in `js/app.js`) — just paste all your cards in one list.

## Files

```
index.html      structure / screens
css/style.css   the Duolingo design system (colors, 3D buttons, animations)
js/cards.js     ← your card content lives here
js/sound.js     synthesized bubbly sounds (WebAudio, no files)
js/app.js       the learning engine + session flow
```
