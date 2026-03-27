import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1A2B3C',
        bone: '#F9F8F6',
        fog: '#F0EFEB',
        parchment: '#F4F1EA',
        mist: '#E7E3DB',
      },
      fontFamily: {
        hand: ['"Ma Shan Zheng"', '"Zhi Mang Xing"', '"Kalam"', '"Caveat"', 'cursive'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
      },
      boxShadow: {
        paper: '20px 20px 60px rgba(0,0,0,0.05), 0 10px 20px rgba(255,255,255,0.65)',
        emboss: '-4px -4px 10px rgba(255,255,255,0.8), 4px 4px 10px rgba(0,0,0,0.04)',
        deboss: 'inset -4px -4px 10px rgba(255,255,255,0.75), inset 4px 4px 10px rgba(0,0,0,0.06)',
        'emboss-soft': '-8px -8px 20px rgba(255,255,255,0.9), 8px 8px 20px rgba(26,43,60,0.05)',
      },
      backgroundImage: {
        papergrain:
          'radial-gradient(circle at 12% 20%, rgba(255,255,255,0.55) 0 1px, transparent 1px), radial-gradient(circle at 78% 34%, rgba(70,60,52,0.05) 0 1px, transparent 1px), radial-gradient(circle at 42% 76%, rgba(110,90,70,0.05) 0 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
} satisfies Config;
