import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],

  theme: {
    extend: {
      colors: {
        'padua': {  
          DEFAULT: '#A8E6CF',
            50: '#FBFEFD',  
            100: '#EFFAF6', 
            200: '#D8F4E9',  
            300: '#C0EDDC',
            400: '#A8E6CF', 
            500: '#80DBB9', 
            600: '#59CFA3', 
            700: '#37BE8C',
            800: '#2B976F', 
            900: '#206F52', 
            950: '#1A5B43'
        },
      }
    }
  },

  plugins: [typography, forms, containerQueries]
} satisfies Config;
