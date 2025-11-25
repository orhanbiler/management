/**
 * Theme Configuration
 * 
 * This file contains predefined color palettes that can be used to quickly
 * change the look and feel of the application.
 * 
 * To change the theme:
 * 1. Copy the CSS variables from your desired palette
 * 2. Paste them into globals.css at the top of the :root section
 * 3. The entire application will update automatically
 */

export interface ColorPalette {
  name: string;
  description: string;
  colors: {
    dark: string;
    gray: string;
    accent: string;
    light: string;
  };
  css: string;
}

/**
 * Available color palettes
 * Each palette is designed to work well in both light and dark modes
 */
export const colorPalettes: ColorPalette[] = [
  {
    name: "Amber Minimal",
    description: "Warm amber/gold accent with clean minimal aesthetics - Elegant and modern",
    colors: {
      dark: "#333333",
      gray: "#444444",
      accent: "#D4A03C", // oklch(0.7686 0.1647 70.0804) ≈ amber/gold
      light: "#FFFFFF",
    },
    css: `
  /* Amber Minimal - oklch color space for precise color control */
  --primary: oklch(0.7686 0.1647 70.0804);
  --accent: oklch(0.9869 0.0214 95.2774);
    `.trim(),
  },
  {
    name: "Dusty Rose",
    description: "Warm dusty rose with soft cream tones - Elegant and sophisticated",
    colors: {
      dark: "#3D3232",
      gray: "#4A3F3F",
      accent: "#867070",
      light: "#F5EBEB",
    },
    css: `
  --brand-dark: #3D3232;
  --brand-gray: #4A3F3F;
  --brand-accent: #867070;
  --brand-light: #F5EBEB;
  --brand-secondary: #D5B4B4;
  --brand-muted: #E4D0D0;
    `.trim(),
  },
  {
    name: "Teal Dark",
    description: "Modern teal accent with dark navy backgrounds - Professional and clean",
    colors: {
      dark: "#222831",
      gray: "#393E46",
      accent: "#00ADB5",
      light: "#EEEEEE",
    },
    css: `
  --brand-dark: #222831;
  --brand-gray: #393E46;
  --brand-accent: #00ADB5;
  --brand-light: #EEEEEE;
    `.trim(),
  },
  {
    name: "Ocean Blue",
    description: "Deep blue with cyan accents - Calm and trustworthy",
    colors: {
      dark: "#0D1B2A",
      gray: "#1B263B",
      accent: "#00B4D8",
      light: "#E0E1DD",
    },
    css: `
  --brand-dark: #0D1B2A;
  --brand-gray: #1B263B;
  --brand-accent: #00B4D8;
  --brand-light: #E0E1DD;
    `.trim(),
  },
  {
    name: "Emerald",
    description: "Rich green tones - Fresh and natural",
    colors: {
      dark: "#1A1A2E",
      gray: "#16213E",
      accent: "#10B981",
      light: "#F0FDF4",
    },
    css: `
  --brand-dark: #1A1A2E;
  --brand-gray: #16213E;
  --brand-accent: #10B981;
  --brand-light: #F0FDF4;
    `.trim(),
  },
  {
    name: "Purple Haze",
    description: "Deep purple with violet accents - Creative and modern",
    colors: {
      dark: "#1A1625",
      gray: "#2D2640",
      accent: "#8B5CF6",
      light: "#F5F3FF",
    },
    css: `
  --brand-dark: #1A1625;
  --brand-gray: #2D2640;
  --brand-accent: #8B5CF6;
  --brand-light: #F5F3FF;
    `.trim(),
  },
  {
    name: "Sunset Orange",
    description: "Warm orange with dark backgrounds - Energetic and bold",
    colors: {
      dark: "#1C1917",
      gray: "#292524",
      accent: "#F97316",
      light: "#FFF7ED",
    },
    css: `
  --brand-dark: #1C1917;
  --brand-gray: #292524;
  --brand-accent: #F97316;
  --brand-light: #FFF7ED;
    `.trim(),
  },
  {
    name: "Rose",
    description: "Pink and rose tones - Elegant and feminine",
    colors: {
      dark: "#1C1917",
      gray: "#2A2725",
      accent: "#F43F5E",
      light: "#FFF1F2",
    },
    css: `
  --brand-dark: #1C1917;
  --brand-gray: #2A2725;
  --brand-accent: #F43F5E;
  --brand-light: #FFF1F2;
    `.trim(),
  },
  {
    name: "Slate Blue",
    description: "Classic blue-gray - Professional and corporate",
    colors: {
      dark: "#0F172A",
      gray: "#1E293B",
      accent: "#3B82F6",
      light: "#F8FAFC",
    },
    css: `
  --brand-dark: #0F172A;
  --brand-gray: #1E293B;
  --brand-accent: #3B82F6;
  --brand-light: #F8FAFC;
    `.trim(),
  },
  {
    name: "Amber Gold",
    description: "Golden amber tones - Luxurious and premium",
    colors: {
      dark: "#1C1917",
      gray: "#292524",
      accent: "#F59E0B",
      light: "#FFFBEB",
    },
    css: `
  --brand-dark: #1C1917;
  --brand-gray: #292524;
  --brand-accent: #F59E0B;
  --brand-light: #FFFBEB;
    `.trim(),
  },
];

/**
 * Get a color palette by name
 */
export function getPalette(name: string): ColorPalette | undefined {
  return colorPalettes.find(p => p.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get the current active palette name (for display purposes)
 * Note: This reads from CSS variables at runtime
 */
export function getCurrentPaletteName(): string {
  if (typeof window === 'undefined') return 'Unknown';
  
  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue('--brand-accent').trim();
  
  // Find matching palette
  const palette = colorPalettes.find(p => 
    p.colors.accent.toLowerCase() === accent.toLowerCase()
  );
  
  return palette?.name || 'Custom';
}

/**
 * Instructions for changing the theme
 */
export const themeInstructions = `
# How to Change the Theme

The theme is controlled by 4 CSS variables in \`src/app/globals.css\`:

\`\`\`css
:root {
  --brand-dark:    #222831;  /* Dark backgrounds */
  --brand-gray:    #393E46;  /* Secondary surfaces */
  --brand-accent:  #00ADB5;  /* Primary/accent color */
  --brand-light:   #EEEEEE;  /* Light backgrounds */
}
\`\`\`

## Quick Steps:
1. Open \`src/app/globals.css\`
2. Find the "BRAND COLORS" section at the top
3. Replace the hex values with your desired colors
4. Save - the entire site updates automatically!

## Available Presets:
${colorPalettes.map(p => `- **${p.name}**: ${p.description}`).join('\n')}

## Tips:
- The accent color is used for buttons, links, and highlights
- Dark and gray colors are used in dark mode
- Light color is used for text in dark mode
- All derived colors (hover states, transparencies) are calculated automatically
`;

