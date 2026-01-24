import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = ({ className = '' }) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-all duration-200
                       bg-secondary hover:bg-secondary/80
                       text-foreground border border-border
                       hover:ring-2 hover:ring-primary/20
                       ${className}`}
            title={theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}
            aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
        >
            {theme === 'dark' ? (
                <Sun size={18} className="text-yellow-500" />
            ) : (
                <Moon size={18} className="text-blue-500" />
            )}
        </button>
    );
};

export default ThemeToggle;
