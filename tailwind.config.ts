import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1d2e27',
        forest: '#19382e',
        moss: '#9be789',
        paper: '#f6f7f2',
        line: '#e4e9e1',
        orange: '#e9975c',
      },
      boxShadow: {
        soft: '0 16px 40px rgba(29, 46, 39, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
