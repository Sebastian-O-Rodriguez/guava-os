import { createTamagui } from 'tamagui'
import { themes } from './themes'
import { defaultConfig } from '@tamagui/config/v5'

const config = createTamagui({
  ...defaultConfig,
  themes,
})

export type AppConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config
