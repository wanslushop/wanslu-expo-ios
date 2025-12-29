import { ProductShareData } from '../types/deep-links';

export const generateProductShareData = (productId: string, productName: string, source: '1688' | 'tb' | 'local' | 'chinese'): ProductShareData => {
  let deepLink = '';
  let webFallback = '';
  if (source === '1688') {
    deepLink = `wanslu://w/${productId}`;
    webFallback = `https://wanslu.shop/w/${productId}`;
  } else if (source === 'tb') {
    deepLink = `wanslu://r/${productId}`;
    webFallback = `https://wanslu.shop/r/${productId}`;
  } else if (source === 'local') {
    deepLink = `wanslu://l/${productId}`;
    webFallback = `https://wanslu.shop/l/${productId}`;
  }  else if (source === 'chinese') {
    deepLink = `wanslu://c/${productId}`;
    webFallback = `https://wanslu.shop/c/${productId}`;
  } else {
    // fallback to old
    deepLink = `wanslu://product/${productId}`;
    webFallback = `https://wanslu.shop/product/1688/${productId}`;
  }
  return {
    productId,
    productName,
    deepLink,
    webFallback,
  };
};

export const createShareMessage = (shareData: ProductShareData): string => {
  return `Check out this amazing product!\n\n${shareData.productName}\n\n${shareData.webFallback}`;
};

export const parseDeepLink = (url: string): { productId?: string, source?: '1688' | 'tb' | 'local' | 'chinese'} => {
  try {
    // Remove scheme (wanslu:// or wanslu:///)
    const cleaned = url.replace(/^wanslu:\/\/+/, '');
    const pathSegments = cleaned.split('/').filter(Boolean);
    if (pathSegments[0] === 'w' && pathSegments[1]) {
      return { productId: pathSegments[1], source: '1688' };
    }
    if (pathSegments[0] === 'r' && pathSegments[1]) {
      return { productId: pathSegments[1], source: 'tb' };
    }
    if (pathSegments[0] === 'l' && pathSegments[1]) {
      return { productId: pathSegments[1], source: 'local' };
    }
    if (pathSegments[0] === 'c' && pathSegments[1]) {
      return { productId: pathSegments[1], source: 'chinese' };
    }
    // fallback for old links
    if (pathSegments[0] === 'product' && pathSegments[1]) {
      return { productId: pathSegments[1] };
    }
  } catch (error) {
    console.error('Error parsing deep link:', error);
  }
  return {};
};

/**
 * Send FCM token to backend API
 * @param fcmToken The FCM token to send
 * @param deviceType 'android' | 'ios'
 * @param authToken The user's auth token (Bearer)
 * @returns Promise<Response>
 */
export async function sendFcmTokenToBackend(fcmToken: string, deviceType: 'android' | 'ios', authToken: string): Promise<Response> {
  return fetch('https://api.wanslu.shop/api/etc/update-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: fcmToken,
      device_type: deviceType,
    }),
  });
}

// Add default export
export default {
  generateProductShareData,
  createShareMessage,
  parseDeepLink,
  sendFcmTokenToBackend,
};