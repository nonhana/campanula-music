import type { Config } from 'tailwindcss'
import containerQueries from '@tailwindcss/container-queries'
import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],

  theme: {
    extend: {
      colors: {
        /** 主色（清新嫩绿色） */
        primary: {
          DEFAULT: '#A8E6CF',
          50: '#F5FCF9',
          100: '#E8F8F1',
          200: '#D1F1E3',
          300: '#B9EAD5',
          400: '#A8E6CF',
          500: '#80DBB9',
          600: '#59CFA3',
          700: '#37BE8C',
          800: '#2B976F',
          900: '#206F52',
          950: '#1A5B43',
        },

        /** 辅助色（淡橙色） */
        secondary: {
          DEFAULT: '#FFD3B6',
          50: '#FFF8F2',
          100: '#FFEEE2',
          200: '#FFE1CC',
          300: '#FFD3B6',
          400: '#FFBF99',
          500: '#FFA877',
          600: '#FF8F55',
          700: '#FF7733',
          800: '#E6601F',
          900: '#B34719',
          950: '#8C3914',
        },

        /** 强调色（浅红色） */
        accent: {
          DEFAULT: '#FF8C94',
          50: '#FFF5F6',
          100: '#FFE8EB',
          200: '#FFD1D5',
          300: '#FFBAC0',
          400: '#FF8C94',
          500: '#FF5E69',
          600: '#FF3040',
          700: '#E01D2C',
          800: '#B31622',
          900: '#8C1019',
          950: '#6E0C14',
        },

        /** 中性色（灰色调，适用于背景、文本） */
        neutral: {
          DEFAULT: '#6B7280',
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
          950: '#0A0F1A',
        },

        /** 状态色（成功、警告、错误、信息） */
        success: {
          DEFAULT: '#81C784', // 成功（淡绿）
          50: '#F2FBF5',
          100: '#E6F7EB',
          200: '#C7EED1',
          300: '#A8E6B7',
          400: '#81C784',
          500: '#66B366',
          600: '#4A9951',
          700: '#35793D',
          800: '#265B2E',
          900: '#1A4121',
        },

        warning: {
          DEFAULT: '#FFC107', // 警告（亮黄）
          50: '#FFF8E1',
          100: '#FFECB3',
          200: '#FFE082',
          300: '#FFD54F',
          400: '#FFC107',
          500: '#FFA000',
          600: '#FF8F00',
          700: '#FF6F00',
          800: '#E65100',
          900: '#BF360C',
        },

        error: {
          DEFAULT: '#E57373', // 错误（淡红）
          50: '#FBE9E7',
          100: '#FFCCBC',
          200: '#FFAB91',
          300: '#FF8A65',
          400: '#E57373',
          500: '#EF5350',
          600: '#E53935',
          700: '#D32F2F',
          800: '#C62828',
          900: '#B71C1C',
        },

        info: {
          DEFAULT: '#64B5F6', // 信息（淡蓝）
          50: '#E3F2FD',
          100: '#BBDEFB',
          200: '#90CAF9',
          300: '#64B5F6',
          400: '#42A5F5',
          500: '#2196F3',
          600: '#1E88E5',
          700: '#1976D2',
          800: '#1565C0',
          900: '#0D47A1',
        },
      },

      /** 其他可扩展的 UI 样式 */
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },

      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
        30: '7.5rem',
      },
    },
  },

  plugins: [typography, forms, containerQueries],
} satisfies Config
