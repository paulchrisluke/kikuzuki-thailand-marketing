import type { Config } from 'tailwindcss'
import colors from 'tailwindcss/colors'
import typographyPlugin from '@tailwindcss/typography'

export default <Config>{
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
    "./nuxt.config.{js,ts}"
  ],
  theme: {
    extend: {
      colors: {
        primary: colors.black,
        secondary: colors.white,
        gray: colors.gray,
        stone: colors.stone,
        orange: {
          600: '#FB553C'
        }
      },
      fontFamily: {
        sans: ['"Poppins"', 'sans-serif'],
        poppins: ['"Poppins"', 'sans-serif']
      },
      screens: {
        'xs': '375px',
        'sm': '576px',
        'md': '768px',
        'lg': '992px',
        'xl': '1200px',
        '2xl': '1366px',
        '3xl': '1600px',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px'
      }
    },
  },
  plugins: [typographyPlugin],
  darkMode: 'class'
}
