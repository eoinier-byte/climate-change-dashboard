# styles/

The look of the site is defined once, in `theme.css`, as CSS variables. Components use the variables and never type a colour, font size or spacing value themselves.

| Variables | What |
|---|---|
| `--color-bg`, `--color-surface`, `--color-border` | Page, panel and line colours |
| `--color-text`, `--color-text-muted` | Body and secondary text |
| `--color-primary`, `--color-primary-dark`, `--color-on-primary` | Brand colour, its hover shade and text on top of it |
| `--color-focus` | Keyboard focus ring |
| `--space-1` to `--space-8`, `--radius`, `--max-width` | Spacing and shape |
| `--font-body`, `--font-size-base`, `--line-height` | Type |

`.btn` and `.btn--secondary` are the shared button styles.

## Scenario colours

The same three colours are used on every chart and on the map.

| Scenario | Colour | CSS variable | JavaScript |
|---|---|---|---|
| RCP2.6 | green `#2e7d32` | `--color-rcp26` | `SCENARIO_COLORS.rcp26` |
| RCP4.5 | amber `#b45309` | `--color-rcp45` | `SCENARIO_COLORS.rcp45` |
| RCP8.5 | red `#c62828` | `--color-rcp85` | `SCENARIO_COLORS.rcp85` |

Chart.js and Leaflet can't read CSS variables, so import the colours from `scenarioColors.js`:

```js
import { SCENARIO_COLORS, SCENARIO_LABELS } from '../styles/scenarioColors';
// dataset: { label: SCENARIO_LABELS.rcp45, borderColor: SCENARIO_COLORS.rcp45 }
```

Colour must never be the only cue (docs/data-flow.md): also use line styles or labels.

## Accessibility

`theme.test.js` checks that every text and background pair meets WCAG AA (4.5:1) and that the JavaScript colours match `theme.css`. If you change a colour, run `npm test`.
