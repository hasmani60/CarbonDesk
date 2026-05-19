import { Toaster } from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

/** Toast styles that adapt to light/dark so they stay legible on any background */
export default function ThemeToaster() {
  const dark = useTheme().theme === 'dark';

  const neutral = dark
    ? {
        background: 'rgb(30 41 59)',
        color: '#f8fafc',
        border: '1px solid rgb(51 65 85)',
        boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
      }
    : {
        background: '#ffffff',
        color: '#0f172a',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 25px rgba(15,23,42,0.08)',
      };

  const iconNeutral = dark
    ? { primary: '#f8fafc', secondary: 'rgb(30 41 59)' }
    : { primary: '#0f172a', secondary: '#ffffff' };

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: neutral,
        iconTheme: iconNeutral,
        success: {
          duration: 3000,
          style: dark
            ? {
                background: 'rgb(6 95 70)',
                color: '#ecfdf5',
                border: '1px solid rgb(52 211 153)',
              }
            : {
                background: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #a7f3d0',
              },
          iconTheme: { primary: dark ? '#ecfdf5' : '#ffffff', secondary: '#10b981' },
        },
        error: {
          duration: 5000,
          style: dark
            ? {
                background: 'rgb(127 29 29)',
                color: '#fecaca',
                border: '1px solid rgb(248 113 113)',
              }
            : {
                background: '#fef2f2',
                color: '#991b1b',
                border: '1px solid #fecaca',
              },
          iconTheme: { primary: dark ? '#fecaca' : '#ffffff', secondary: '#ef4444' },
        },
        loading: {
          style: dark
            ? {
                background: 'rgb(30 58 138)',
                color: '#dbeafe',
                border: '1px solid rgb(96 165 250)',
              }
            : {
                background: '#eff6ff',
                color: '#1e3a8a',
                border: '1px solid #bfdbfe',
              },
          iconTheme: { primary: dark ? '#dbeafe' : '#1e40af', secondary: '#3b82f6' },
        },
      }}
    />
  );
}
