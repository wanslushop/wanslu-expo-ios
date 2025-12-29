import { useLocalSearchParams } from 'expo-router';
import ProductDetailScreen from '../product-detail';

export default function ProductDetailPage() {
  const params = useLocalSearchParams();
  
  // Pass the ID to the ProductDetailScreen component
  return <ProductDetailScreen />;
}
