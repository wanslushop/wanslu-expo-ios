# Components

This directory contains reusable components for the Wanslu app.

## Header.tsx
A reusable header component with navigation and cart functionality.

## Navbar.tsx
Bottom navigation bar component.

## ProductCard.tsx
Product display card component.

## Address Screen
The address screen (`/address`) provides the following functionality:

### Features
- **View Addresses**: Display all saved addresses in a card layout
- **Add New Address**: Modal form to add a new delivery address
- **Edit Address**: Edit existing address information
- **Delete Address**: Remove addresses with confirmation
- **Country Code Selection**: Uses `react-native-country-picker-modal` for phone number country codes
- **Country Selection**: Country picker for address country selection
- **District Selection**: Dynamic district selection based on selected country

### Dependencies
- `react-native-country-picker-modal`: For country code and country selection
- `@expo/vector-icons`: For UI icons
- `expo-router`: For navigation

### API Integration
- Fetches addresses from: `https://api.wanslu.shop/api/account/address`
- Fetches area data from: `https://api.wanslu.shop/api/etc/area`
- Requires authentication token for all operations

### Form Fields
- First Name
- Last Name
- WhatsApp Number (with country code picker)
- Address Line 1
- Address Line 2 (optional)
- City
- ZIP Code
- Country (with country picker)
- District (dynamic based on country)

### Navigation
Accessible from the Account screen via the "Addresses" menu item.
