# Writing DotComma content

Everything players see lives in two text files:

- `content/prompts.txt` — the prompt deck (file order = deck order)
- `content/words.txt` — the allowed vocabulary + merge rules

After editing either, run from the repo root:

```
node scripts/build-content.mjs
```

and commit the regenerated JSON it writes into `backend/shared/` and
`frontend/proj/app/shared/`. The app reads only that JSON — if you forget
to run the build, your edits don't ship (`--check` mode exists to catch
this in CI later).

## Prompt format

One block per prompt, separated by a line containing only `---`:

```
KEY: rule-2-short-words
HEADING: Rule 2: Short words!
INTRO: Rewrite the following line in **short**, plain words.
PROMPT: "I utilize sophisticated vocabulary to communicate my thinking."
CLUE: Clue:  I u__ ___rt ___ds __ ___k.
CORRECT: I use short words to talk
ANSWERS: I use short words to talk | I use small words to talk
HINT: NA
```

- **KEY** — stable id, lowercase-with-dashes. Saved answers in the database
  attach to it, so never change a key after the prompt has been live.
- **HEADING** — the page title.
- **INTRO** — repeat the line for multi-line intros; each line is one
  click-to-reveal stage. `**bold**` works in INTRO and PROMPT.
- **PROMPT** — the line the player responds to.
- **CLUE** — optional underscores-style clue; `NA` when absent.
- **CORRECT** — the canonical answer. Must validate (see below).
- **ANSWERS** — accepted answers separated by ` | `; usually includes
  CORRECT. Matching any of these earns the +5 exact bonus.
- **HINT** — optional; `NA` when absent.

## The lint is your friend

The build checks every CORRECT and ANSWERS line against the vocabulary and
warns about words players would see marked red. Fix the answer or add the
word to `words.txt` — never ship a prompt whose own answer fails.
`--strict` turns those warnings into build failures.

## Writing inside the vocabulary

The word list is harshly small on purpose. Things it does NOT have:

- **No copulas or auxiliaries**: is, are, was, were, am, will, would, can.
- **No glue words**: a, an, and, of, or, but, not, no, for, from, by, so.
- **No inflections**: verbs are base forms only — *start* works, *starts*
  and *started* don't. Nouns are singular only unless listed (only
  *words* has its plural so far).

What works:

- Subjects that take base verbs: **I, you, we, they** — "We build the
  city", never "He builds the city".
- Comma-compression instead of glue: "One world, one speech" instead of
  "The world was of one speech". This is the house style — it's the game's
  name.
- Punctuation is free: commas, colons, dashes and quotes are never marked
  invalid, only words are.
- Merges: a listed pair typed in a row becomes one valid word
  ("be ing" → "being"). Add pairs in the `[merges]` section of words.txt.

## Scoring (for calibrating difficulty)

- All words valid: **+10**, plus a brevity bonus of `10 − word count`
  (floor 0) — shorter is better.
- Answer exactly matches CORRECT or any ANSWERS entry: **+5**.
- Any invalid word: 0 base score (exact bonus still applies).
