module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        website_bg: 'url(../public/assets/website-bg.png)',
        pattern: 'url(../public/assets/shellrunner-pattern.png)',
      },
      fontFamily: {
        primary: ['Space Grotesk', 'Josefin Sans', 'sans-serif'],
        mono: [
          'IBM Plex Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
    },
    colors: {
      black: '#313131',
      blue: '#125F83',
      lightblue: '#9FE4FF',
      lightgrey: '#e5e7eb',
      whiteish: '#F1FCFF',
      sand: '#E7C7B4',
      greyish: '#F8F8F8',
      purple: '#B6D8F8',
      grey: '#8E8E8E',
      red: '#ff0000',
      purpleish: '#C2CCF1',
    },
  },
  plugins: [],
};
