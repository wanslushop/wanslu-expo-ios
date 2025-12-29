# Deep Link Sharing Implementation

This implementation adds deep link sharing functionality to the product detail page, allowing users to share products and open them directly in the app.

## Features

### 1. Share Button
- Added share buttons in multiple locations on the product detail page
- Header share button
- Action buttons section share button
- Bottom bar share button

### 2. Share Functionality
When a user presses the share button, it generates:
- **App Deep Link**:
  - 1688 (wholesale): `wanslu://w/{productId}`
  - Taobao (retail): `wanslu://r/{productId}`
- **Web Fallback**:
  - 1688 (wholesale): `https://wanslu.shop/w/{productId}`
  - Taobao (retail): `https://wanslu.shop/r/{productId}`

### 3. Dynamic Shipping Information
The product detail page now displays:
- **Dynamic China Shipping Fee**: Uses actual shipping data from API response
- **Price Breakdown**: Shows product price and shipping fee separately
- **Total Price**: Automatically calculates total including shipping

The share message includes both links, allowing recipients to:
- Open the product directly in the app (if they have it installed)
- View the product on the web (fallback)

### 4. Deep Link Handling
The app can receive and handle deep links in the format:
- 1688 (wholesale): `wanslu://w/{productId}`
- Taobao (retail): `wanslu://r/{productId}`

When a deep link is received:
1. The app parses the URL to extract the product ID and source
2. Navigates to the product detail page with the correct product ID and source
3. Loads the product information

## Implementation Details

### Files Modified/Created

1. **app.json**
   - Added deep link scheme: `wanslu`

2. **app/_layout.tsx**
   - Added deep link handling logic
   - Listens for incoming deep links
   - Handles initial deep links when app is opened

3. **app/product-detail.tsx**
   - Implemented `handleShare` function using React Native's Share API
   - Added share button functionality to all share buttons
   - Uses new /w/{pid} and /r/{pid} logic for deep links and web links

4. **app/product/[id].tsx** (New)
   - Dynamic route for handling product detail pages with IDs
   - Supports deep link navigation

5. **app/types/deep-links.ts** (New)
   - TypeScript interfaces for deep link handling
   - Ensures type safety

6. **app/utils/share-utils.ts** (New)
   - Utility functions for generating share URLs
   - Deep link parsing functions
   - Share message creation
   - Uses new /w/{pid} and /r/{pid} logic

## Usage

### For Users
1. Navigate to any product detail page
2. Tap any of the share buttons (header, action section, or bottom bar)
3. Choose your preferred sharing method (SMS, email, social media, etc.)
4. Recipients can tap the shared link to open the product

### For Developers
The implementation is modular and reusable:

```typescript
// Generate share data
const shareData = generateProductShareData(productId, productName, source); // source: '1688' | 'tb'

// Create share message
const shareMessage = createShareMessage(shareData);

// Parse incoming deep links
const { productId, source } = parseDeepLink(url);
```

## Testing

### Testing Deep Links

1. **iOS Simulator**:
   ```bash
   xcrun simctl openurl booted "wanslu://w/12345"
   xcrun simctl openurl booted "wanslu://r/67890"
   ```

2. **Android Emulator**:
   ```bash
   adb shell am start -W -a android.intent.action.VIEW -d "wanslu://w/12345" com.k3studio.wanslu
   adb shell am start -W -a android.intent.action.VIEW -d "wanslu://r/67890" com.k3studio.wanslu
   ```

3. **Physical Device**:
   - Send yourself a shared link via email/SMS
   - Tap the link to test deep link handling

### Testing Share Functionality
1. Open any product detail page
2. Tap the share button
3. Verify the generated links are correct (should be /w/{pid} or /r/{pid})
4. Test sharing via different platforms

## Configuration

The deep link scheme is configured in `app.json`:
```json
{
  "expo": {
    "scheme": "wanslu"
  }
}
```

## Security Considerations

- Deep links are validated before processing
- Error handling is implemented for malformed URLs
- The implementation uses TypeScript for type safety

## Future Enhancements

1. **Analytics**: Track deep link usage and conversion rates
2. **A/B Testing**: Test different share message formats
3. **Social Media Integration**: Direct sharing to specific platforms
4. **QR Code Generation**: Generate QR codes for product links
5. **Custom Share Sheets**: Platform-specific share options
