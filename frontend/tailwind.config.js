/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic tokens — same hsl variables as index.css (:root / .dark)
        app: {
          bg: 'hsl(var(--background) / <alpha-value>)',
          fg: 'hsl(var(--foreground) / <alpha-value>)',
          card: 'hsl(var(--card) / <alpha-value>)',
          muted: 'hsl(var(--muted) / <alpha-value>)',
          'muted-fg': 'hsl(var(--muted-foreground) / <alpha-value>)',
          border: 'hsl(var(--border) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        // Primary Brand Colors (from Figma)
        'primary-teal': '#006C54',
        'primary-dark': '#0A3124',
        'accent-cyan': '#79FFE1',
        'accent-warm': '#E9B376',
        'accent-warm-dark': '#D58745',
        
        // Background Colors
        'background-light': '#FAFAFA',
        'background-cream': '#E3EDDF',
        
        // Surface Colors
        'surface-gray': '#F0F0F0',
        'surface-gray-light': '#EFEFEF',
        'surface-neutral': '#EBEFEB',
        
        // Text Colors
        'text-primary': '#0A3124',
        'text-secondary': '#263238',
        'text-muted': '#ABCA9E',
        
        // Border Colors
        'border-light': '#E6E6E6',
        'border-neutral': '#F1F1F1',
        
        // Legacy emerald mapping (maintains compatibility)
        emerald: {
          50: '#E3EDDF',
          100: '#ABCA9E',
          200: '#79FFE1',
          300: '#79FFE1',
          400: '#79FFE1',
          500: '#006C54',
          600: '#006C54',
          700: '#0A3124',
          800: '#0A3124',
          900: '#0A3124',
        },
        
        // Scope colors updated to match new palette
        'scope-1': '#006C54',
        'scope-2': '#263238',
        'scope-3': '#D58745',
        
        // Status Colors (Traffic Light System) - WCAG AA compliant
        'status-green': '#15803d', // Tailwind green-700
        'status-green-bg': '#dcfce7', // Tailwind green-100
        'status-amber': '#b45309', // Tailwind amber-700
        'status-amber-bg': '#fef3c7', // Tailwind amber-100
        'status-red': '#b91c1c', // Tailwind red-700
        'status-red-bg': '#fee2e2', // Tailwind red-100

        // Premium Dark Mode palette (Slate/Gray blend)
        slate: {
          750: '#293548',
          850: '#162032',
          900: '#0F172A',
          950: '#020617',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'card-md': '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
        'teal-sm': '0 1px 2px 0 rgba(0, 108, 84, 0.05)',
        'teal-md': '0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 100%)',
        'glass-gradient-dark': 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(2, 6, 23, 0.8) 100%)',
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 1, boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)' },
          '50%': { opacity: 0.8, boxShadow: '0 0 25px rgba(16, 185, 129, 0.5)' },
        },
        'slide-up-fade': {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        }
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up-fade': 'slide-up-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }
    },
  },
  plugins: [],
}