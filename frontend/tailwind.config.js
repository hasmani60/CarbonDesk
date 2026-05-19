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
          bg: 'hsl(var(--background))',
          fg: 'hsl(var(--foreground))',
          card: 'hsl(var(--card))',
          muted: 'hsl(var(--muted))',
          'muted-fg': 'hsl(var(--muted-foreground))',
          border: 'hsl(var(--border))',
        },
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
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      boxShadow: {
        'teal-sm': '0 1px 2px 0 rgba(0, 108, 84, 0.05)',
        'teal-md': '0 4px 6px -1px rgba(0, 108, 84, 0.1)',
        'teal-lg': '0 10px 15px -3px rgba(0, 108, 84, 0.1)',
        'teal-xl': '0 20px 25px -5px rgba(0, 108, 84, 0.1)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.05)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        'glow': '0 0 15px rgba(16, 185, 129, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
        'glass-gradient-dark': 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(2, 6, 23, 0.9) 100%)',
      }
    },
  },
  plugins: [],
}