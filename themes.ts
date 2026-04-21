import { createV5Theme, defaultChildrenThemes } from '@tamagui/config/v5'
import { v5ComponentThemes } from '@tamagui/themes/v5'
import { yellow, yellowDark, red, redDark, green, greenDark } from '@tamagui/colors'

// ---------------------------------------------------------------------------
// Light mode:  bg #FEFEFE, text #2C2828, warm deep purple accent
// Dark mode:   derived inverse
// ---------------------------------------------------------------------------

const lightPalette = [
  'hsla(0, 0%, 99.6%, 1)',   // 1  — background (#FEFEFE)
  'hsla(0, 0%, 95%, 1)',     // 2  — subtle surface
  'hsla(0, 0%, 90%, 1)',     // 3  — borders, dividers
  'hsla(0, 0%, 84%, 1)',     // 4  — stronger borders
  'hsla(0, 0%, 70%, 1)',     // 5  — placeholder
  'hsla(0, 0%, 56%, 1)',     // 6  — muted text
  'hsla(0, 0%, 44%, 1)',     // 7  — secondary text
  'hsla(0, 0%, 34%, 1)',     // 8  — tertiary
  'hsla(0, 0%, 26%, 1)',     // 9  — strong
  'hsla(0, 0%, 20%, 1)',     // 10 — emphasis
  'hsla(0, 0%, 17%, 1)',     // 11 — near-text
  'hsla(0, 0%, 16%, 1)',     // 12 — text (#2C2828)
]

const darkPalette = [
  'hsla(5, 6%, 7%, 1)',      // 1  — background
  'hsla(5, 5%, 11%, 1)',     // 2  — subtle surface
  'hsla(5, 4%, 16%, 1)',     // 3  — borders
  'hsla(5, 4%, 21%, 1)',     // 4  — stronger borders
  'hsla(0, 0%, 24%, 1)',     // 5  — placeholder
  'hsla(0, 0%, 28%, 1)',     // 6  — muted text
  'hsla(0, 0%, 34%, 1)',     // 7  — secondary text
  'hsla(0, 0%, 42%, 1)',     // 8  — tertiary
  'hsla(0, 0%, 52%, 1)',     // 9  — strong
  'hsla(0, 0%, 65%, 1)',     // 10 — emphasis
  'hsla(0, 0%, 92%, 1)',     // 11 — near-text
  'hsla(0, 0%, 96%, 1)',     // 12 — text
]

// Deep warm purple accent
const accentLight = {
  accent1:  'hsla(270, 40%, 20%, 1)',
  accent2:  'hsla(270, 40%, 25%, 1)',
  accent3:  'hsla(270, 40%, 30%, 1)',
  accent4:  'hsla(270, 40%, 35%, 1)',
  accent5:  'hsla(270, 42%, 40%, 1)',
  accent6:  'hsla(270, 42%, 45%, 1)',
  accent7:  'hsla(270, 44%, 50%, 1)',
  accent8:  'hsla(270, 44%, 55%, 1)',
  accent9:  'hsla(270, 46%, 58%, 1)',
  accent10: 'hsla(270, 46%, 63%, 1)',
  accent11: 'hsla(270, 30%, 92%, 1)',
  accent12: 'hsla(270, 30%, 96%, 1)',
}

const accentDark = {
  accent1:  'hsla(270, 40%, 15%, 1)',
  accent2:  'hsla(270, 40%, 19%, 1)',
  accent3:  'hsla(270, 40%, 24%, 1)',
  accent4:  'hsla(270, 40%, 28%, 1)',
  accent5:  'hsla(270, 42%, 33%, 1)',
  accent6:  'hsla(270, 42%, 38%, 1)',
  accent7:  'hsla(270, 44%, 44%, 1)',
  accent8:  'hsla(270, 44%, 50%, 1)',
  accent9:  'hsla(270, 46%, 55%, 1)',
  accent10: 'hsla(270, 46%, 60%, 1)',
  accent11: 'hsla(270, 30%, 88%, 1)',
  accent12: 'hsla(270, 30%, 94%, 1)',
}

const builtThemes = createV5Theme({
  darkPalette,
  lightPalette,
  componentThemes: v5ComponentThemes,
  accent: {
    light: accentLight,
    dark: accentDark,
  },
  childrenThemes: {
    ...defaultChildrenThemes,
    warning: { light: yellow, dark: yellowDark },
    error: { light: red, dark: redDark },
    success: { light: green, dark: greenDark },
  },
})

export type Themes = typeof builtThemes

export const themes: Themes =
  process.env.TAMAGUI_ENVIRONMENT === 'client' &&
  process.env.NODE_ENV === 'production'
    ? ({} as any)
    : (builtThemes as any)
