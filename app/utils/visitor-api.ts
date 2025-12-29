import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const GEO_DATA_KEY = 'geo-data';
const IP_CACHE_KEY = 'ip-address-cache';
const IP_CACHE_TIMESTAMP_KEY = 'ip-address-cache-timestamp';
const IP_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

interface GeoData {
  countryCode?: string;
  countryName?: string;
}

interface IPCache {
  ip: string;
  timestamp: number;
}

interface VisitorPayload {
  app: boolean;
  device: string;
  country_code: string;
  country_name: string;
  ip: string;
}

// Get IP address using a simple IP-only service
export const getIPAddress = async (): Promise<string> => {
  try {
    // Check cache first
    const cachedIPStr = await AsyncStorage.getItem(IP_CACHE_KEY);
    const cachedTimestampStr = await AsyncStorage.getItem(IP_CACHE_TIMESTAMP_KEY);
    
    if (cachedIPStr && cachedTimestampStr) {
      const cache: IPCache = JSON.parse(cachedIPStr);
      const timestamp = parseInt(cachedTimestampStr, 10);
      const now = Date.now();
      
      // Use cached IP if it's less than 1 hour old
      if (cache.ip && (now - timestamp) < IP_CACHE_DURATION) {
        return cache.ip;
      }
    }

    // Fetch fresh IP using simple IP-only service (IPv4)
    const ipServices = [
      'https://api.ipify.org?format=json',
      'https://api64.ipify.org?format=json',
      'https://ipv4.icanhazip.com',
    ];

    for (const service of ipServices) {
      try {
        if (service.includes('icanhazip')) {
          // This service returns plain text
          const response = await fetch(service);
          if (response.ok) {
            const ip = (await response.text()).trim();
            if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
              // Cache the IP
              await AsyncStorage.setItem(IP_CACHE_KEY, JSON.stringify({ ip }));
              await AsyncStorage.setItem(IP_CACHE_TIMESTAMP_KEY, Date.now().toString());
              return ip;
            }
          }
        } else {
          // JSON response
          const response = await fetch(service);
          if (response.ok) {
            const data = await response.json();
            const ip = data.ip || data.query;
            if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
              // Cache the IP
              await AsyncStorage.setItem(IP_CACHE_KEY, JSON.stringify({ ip }));
              await AsyncStorage.setItem(IP_CACHE_TIMESTAMP_KEY, Date.now().toString());
              return ip;
            }
          }
        }
      } catch (error) {
        console.log(`Failed to fetch IP from ${service}, trying next...`);
        continue;
      }
    }

    // If all services fail, try to use cached IP even if expired
    if (cachedIPStr) {
      const cache: IPCache = JSON.parse(cachedIPStr);
      if (cache.ip) {
        return cache.ip;
      }
    }

    return '';
  } catch (error) {
    console.error('Error getting IP address:', error);
    return '';
  }
};

export const callVisitorAPI = async (authToken: string): Promise<boolean> => {
  try {
    // Get geo data from storage (country info, not IP)
    const geoDataStr = await AsyncStorage.getItem(GEO_DATA_KEY);
    let geoData: GeoData = {};
    
    if (geoDataStr) {
      try {
        const stored = JSON.parse(geoDataStr);
        geoData = {
          countryCode: stored.countryCode,
          countryName: stored.countryName,
        };
      } catch (e) {
        console.error('Failed to parse geo data:', e);
      }
    }

    // Get IP address (cached, refreshed every hour)
    const ip = await getIPAddress();

    // Get device name
    const deviceName = Platform.OS === 'ios' 
      ? `iOS ${Platform.Version}` 
      : Platform.OS === 'android' 
        ? `Android ${Platform.Version}` 
        : Platform.OS;

    // Prepare payload
    const payload: VisitorPayload = {
      app: true,
      device: deviceName,
      country_code: geoData.countryCode || 'US',
      country_name: geoData.countryName || 'United States',
      ip: ip,
    };

    // Call visitor API
    const response = await fetch('https://api.wanslu.shop/api/etc/visitor', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('✅ Visitor API called successfully');
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Visitor API failed:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error calling visitor API:', error);
    return false;
  }
};

