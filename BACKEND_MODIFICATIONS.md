# Backend Modifications for Mobile App OAuth Support

## Problem
Currently, your backend redirects all OAuth completions to the web account page, but mobile apps need to redirect back to the app with access tokens.

## Solution
Modify your backend to detect mobile app requests and redirect appropriately.

## Required Changes

### 1. Update `/api/auth/google/redirect` endpoint

Add support for mobile app parameters:

```php
// In your Google redirect endpoint
public function getGoogleRedirect(Request $request)
{
    $platform = $request->query('platform'); // 'mobile' or 'web'
    $app = $request->query('app'); // 'wanslu'
    
    // Store platform info in session for later use
    session(['oauth_platform' => $platform, 'oauth_app' => $app]);
    
    // Generate Google OAuth URL as usual
    $googleAuthUrl = $this->generateGoogleAuthUrl();
    
    return response()->json([
        'redirect_url' => $googleAuthUrl
    ]);
}
```

### 2. Update `/api/auth/google/callback` endpoint

Modify to handle mobile app redirects:

```php
// In your Google callback endpoint
public function handleGoogleCallback(Request $request)
{
    $code = $request->input('code');
    $redirectUri = $request->input('redirect_uri');
    $platform = $request->input('platform', session('oauth_platform'));
    $app = $request->input('app', session('oauth_app'));
    
    // Exchange code for tokens (your existing logic)
    $tokens = $this->exchangeCodeForTokens($code);
    
    if ($platform === 'mobile' && $app === 'wanslu') {
        // For mobile app, redirect back to app with tokens
        $mobileRedirectUrl = $redirectUri . '?' . http_build_query([
            'token' => $tokens['access_token'],
            'expires_at' => $tokens['expires_at'],
            'user_id' => $tokens['user_id'] ?? null,
            'success' => 'true'
        ]);
        
        return redirect($mobileRedirectUrl);
    } else {
        // For web, redirect to account page as usual
        return redirect('/account');
    }
}
```

### 3. Alternative: Add new mobile-specific endpoint

Create a new endpoint specifically for mobile apps:

```php
// New endpoint: /api/auth/google/mobile-callback
public function handleMobileCallback(Request $request)
{
    $code = $request->input('code');
    $redirectUri = $request->input('redirect_uri');
    
    // Exchange code for tokens
    $tokens = $this->exchangeCodeForTokens($code);
    
    // Always redirect back to mobile app
    $mobileRedirectUrl = $redirectUri . '?' . http_build_query([
        'token' => $tokens['access_token'],
        'expires_at' => $tokens['expires_at'],
        'user_id' => $tokens['user_id'] ?? null,
        'success' => 'true'
    ]);
    
    return redirect($mobileRedirectUrl);
}
```

## Google Cloud Console Configuration

Add these redirect URIs to your OAuth client:

```
wanslu://auth?platform=mobile&app=wanslu
wanslu://auth
```

## Testing

1. Test with mobile app parameters
2. Verify tokens are passed in redirect URL
3. Ensure web flow still works normally

## Security Notes

- Validate the platform and app parameters
- Ensure tokens are only passed to authorized redirect URIs
- Consider using state parameter for additional security
