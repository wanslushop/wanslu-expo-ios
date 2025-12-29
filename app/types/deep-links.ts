export interface DeepLinkParams {
  id: string;
}

export interface ShareResult {
  action: string;
  activityType?: string;
}

export interface ProductShareData {
  productId: string;
  productName: string;
  deepLink: string;
  webFallback: string;
}

// Add default export for the module
const deepLinksModule = {
  // This module contains type definitions
  __types: 'DeepLinkParams, ShareResult, ProductShareData',
};

export default deepLinksModule;
