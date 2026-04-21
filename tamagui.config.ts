import { createFont, createTamagui, createTokens } from 'tamagui'
import { createAnimations } from '@tamagui/animations-css'
import { themes } from './themes'
import { defaultConfig } from '@tamagui/config/v5'

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

const sans = createFont({
  family: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
  weight: {
    1: '300',
    2: '300',
    3: '400',
    4: '400',
    5: '500',
    6: '600',
    7: '700',
    8: '800',
    true: '400',
  },
  size: defaultConfig.fonts.body.size,
  lineHeight: defaultConfig.fonts.body.lineHeight,
  letterSpacing: defaultConfig.fonts.body.letterSpacing,
})

const mono = createFont({
  family: '"JetBrains Mono", monospace',
  weight: {
    1: '400',
    4: '400',
    7: '700',
    true: '400',
  },
  size: defaultConfig.fonts.body.size,
  lineHeight: defaultConfig.fonts.body.lineHeight,
  letterSpacing: defaultConfig.fonts.body.letterSpacing,
})

// ---------------------------------------------------------------------------
// Tokens — override radius for smoother edges
// ---------------------------------------------------------------------------

const tokens = createTokens({
  ...defaultConfig.tokens,
  radius: {
    ...defaultConfig.tokens.radius,
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 38,
    10: 44,
    11: 50,
    12: 9999,
    true: 16,
  },
})

// ---------------------------------------------------------------------------
// Animations — CSS transitions
// ---------------------------------------------------------------------------

const animations = createAnimations({
  fast: 'ease-in-out 150ms',
  medium: 'ease-in-out 250ms',
  slow: 'ease-in-out 400ms',
  bouncy: 'ease-in-out 350ms',
  lazy: 'ease-in-out 600ms',
  quick: 'ease-in-out 100ms',
  tooltip: 'ease-in-out 200ms',
})

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const config = createTamagui({
  ...defaultConfig,
  tokens,
  themes,
  fonts: {
    body: sans,
    heading: sans,
    mono,
  },
  animations,
})

export type AppConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config
