import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function WholesaleProductDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (id) {
      router.replace({ pathname: '/product-detail', params: { id, source: 'local' } });
    }
  }, [id]);
  return null;
}
