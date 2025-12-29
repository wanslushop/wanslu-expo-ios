# Internationalization (i18n) System Documentation

## Overview

This app now supports multiple languages through a comprehensive internationalization system. The system allows users to switch between different languages and see the entire app interface translated accordingly.

## Supported Languages

The following languages are currently supported:

- **English (en)** - Complete translations
- **Spanish (es)** - Complete translations  
- **French (fr)** - Complete translations
- **Russian (ru)** - Complete translations
- **Chinese Simplified (zh)** - Fallback to English
- **Chinese Traditional (zh-hans)** - Fallback to English
- **Arabic (ar)** - Fallback to English
- **Portuguese (pt)** - Fallback to English
- **German (de)** - Fallback to English
- **Japanese (ja)** - Fallback to English
- **Korean (ko)** - Fallback to English
- **Italian (it)** - Fallback to English

## How to Use the Translation System

### 1. Import the Hook

In any component where you need translations, import the `useI18n` hook:

```tsx
import { useI18n } from './context/I18nContext';

function MyComponent() {
  const { t } = useI18n();
  
  return (
    <Text>{t('common.loading')}</Text>
  );
}
```

### 2. Using Translations

The `t` function accepts a translation key and optional parameters:

```tsx
// Simple translation
<Text>{t('common.loading')}</Text>

// Translation with parameters
<Text>{t('product.price', { amount: '$10.99' })}</Text>

// Nested keys
<Text>{t('auth.welcomeBack')}</Text>
```

### 3. Translation Key Structure

Translation keys are organized hierarchically:

```
common.loading          → "Loading..."
common.error            → "Error"
auth.welcomeBack        → "Welcome Back"
auth.signIn             → "Sign In"
product.addToCart        → "Add to Cart"
cart.title              → "Shopping Cart"
settings.languageSettings → "Language Settings"
```

### 4. Adding New Translations

To add a new translation:

1. **Add to English translation file** (`app/i18n/translations/en.json`):
```json
{
  "mySection": {
    "myKey": "My English Text"
  }
}
```

2. **Add to other language files** (e.g., `app/i18n/translations/es.json`):
```json
{
  "mySection": {
    "myKey": "Mi Texto en Español"
  }
}
```

3. **Use in your component**:
```tsx
<Text>{t('mySection.myKey')}</Text>
```

### 5. Adding New Languages

To add support for a new language:

1. **Create translation file** (`app/i18n/translations/[lang].json`):
```json
{
  "common": {
    "loading": "Loading in New Language...",
    "error": "Error in New Language"
  }
}
```

2. **Import in I18nContext** (`app/context/I18nContext.tsx`):
```tsx
import newLangTranslations from './i18n/translations/new-lang.json';

const translations: Translations = {
  en: enTranslations,
  es: esTranslations,
  // ... existing languages
  'new-lang': newLangTranslations,
};
```

3. **Add to language options** (`app/lang-currency.tsx`):
```tsx
const languageOptions = [
  // ... existing options
  { label: 'New Language', value: 'new-lang' },
];
```

## Translation Categories

The translations are organized into the following categories:

### Common
- Basic UI elements (loading, error, save, cancel, etc.)
- Used across multiple screens

### Navigation
- Menu items and navigation labels
- Tab names and screen titles

### Authentication
- Login/register forms
- User account related text

### Home
- Home screen content
- Product sections and labels

### Product
- Product details and actions
- Shopping related text

### Cart
- Shopping cart functionality
- Checkout process

### Orders
- Order management
- Order status and history

### Account
- User profile and settings
- Account management

### Wallet
- Financial transactions
- Balance and payments

### Transfers
- Money transfer functionality
- Transaction details

### Notifications
- Notification management
- Alert messages

### Help
- Support and help content
- FAQ and contact information

### Settings
- App configuration
- Language and currency settings

### Search
- Search functionality
- Filters and sorting

### Wishlist
- Wishlist management
- Favorite items

### Checkout
- Purchase process
- Payment and shipping

### Errors
- Error messages
- Validation messages

## Best Practices

### 1. Use Descriptive Keys
```tsx
// Good
t('product.addToCart')
t('auth.forgotPassword')

// Avoid
t('button1')
t('text123')
```

### 2. Group Related Translations
```tsx
// Good - grouped by feature
t('cart.title')
t('cart.empty')
t('cart.checkout')

// Avoid - scattered keys
t('title')
t('emptyCart')
t('checkoutButton')
```

### 3. Use Parameters for Dynamic Content
```tsx
// Good - with parameters
t('product.price', { amount: '$10.99' })
t('cart.itemCount', { count: 5 })

// Avoid - hardcoded values
t('product.priceTenDollars')
```

### 4. Provide Fallbacks
The system automatically falls back to English if a translation is missing, but it's better to provide complete translations.

### 5. Test All Languages
When adding new features, test with different languages to ensure:
- Text fits properly in UI elements
- Right-to-left languages (Arabic) display correctly
- Special characters render properly

## Language Switching

Users can change the language through:
1. **Settings Screen** → Language & Currency
2. **Account Screen** → Settings → Language

The language change is:
- Saved to device storage
- Applied immediately across the app
- Persisted between app sessions

## Technical Implementation

### Context Structure
```tsx
interface I18nContextType {
  t: (key: string, params?: Record<string, string | number>) => string;
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  isLoading: boolean;
}
```

### Translation Loading
- Translations are loaded at app startup
- Language preference is stored in AsyncStorage
- Fallback to English if language not found

### Performance
- Translations are bundled with the app (no network requests)
- Fast key lookup using nested object access
- Minimal memory footprint

## Troubleshooting

### Common Issues

1. **Translation not found**
   - Check if key exists in translation files
   - Verify key spelling and nesting
   - Ensure language is supported

2. **Text not updating**
   - Check if component is wrapped in I18nProvider
   - Verify useI18n hook is imported correctly
   - Check if language change was saved

3. **Missing translations**
   - Add missing keys to all language files
   - Use English as fallback for incomplete languages

### Debug Mode
To debug translation issues, you can log the current language:
```tsx
const { t, language } = useI18n();
console.log('Current language:', language);
console.log('Translation result:', t('your.key'));
```

## Future Enhancements

Potential improvements to the i18n system:

1. **Dynamic Language Loading**
   - Load translations from server
   - Support for language updates without app updates

2. **Pluralization Support**
   - Handle singular/plural forms
   - Support for complex plural rules

3. **Date/Number Formatting**
   - Localized date formats
   - Currency formatting by region

4. **RTL Support**
   - Right-to-left layout support
   - Arabic and Hebrew text direction

5. **Translation Management**
   - Admin interface for managing translations
   - Translation status tracking
   - Crowdsourced translation support
