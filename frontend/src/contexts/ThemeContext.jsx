import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        // LocalStorage'dan oku, yoksa 'dark' varsayılan
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            return saved || 'dark';
        }
        return 'dark';
    });

    useEffect(() => {
        // LocalStorage'a kaydet
        localStorage.setItem('theme', theme);
        
        // HTML element'e class ekle
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;
