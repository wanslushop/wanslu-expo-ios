import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import CategoriesModal from './components/CategoriesModal';
import Header from './components/Header';
import ProductCard, { TrendingProduct } from './components/ProductCard';
import { useCartCount } from './context/CartCountContext';
import { useI18n } from './context/I18nContext';
import { useNavigation } from './context/NavigationContext';

type SourceKey = '1688' | 'tb' | 'local' | 'chinese' | 'all';

interface ActivityItem {
	id: number;
	user_id: number;
	pid: string;
	src: '1688' | 'tb' | 'local' | 'chinese';
	title: string;
	img: string;
	price: string;
	merchant: string;
	country: string;
	updated_at: string;
	created_at: string;
}

interface ActivityResponse {
	status: string;
	data: ActivityItem[];
	meta?: { total: number };
}

export default function ActivityScreen() {
	const { cartCount } = useCartCount();
	const { t } = useI18n();
	const { showCategoriesModal, setShowCategoriesModal } = useNavigation();

	// State
	const [items, setItems] = useState<ActivityItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [src, setSrc] = useState<SourceKey>('all');
	const [offset, setOffset] = useState(0);
	const [total, setTotal] = useState(0);
	const [limit] = useState(12);
	const [hasMore, setHasMore] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [wishlistMap, setWishlistMap] = useState<{ [pid: string]: { id: number } }>({});

	// Deduplicate by pid, keeping the latest created_at
	const dedupeByPid = (arr: ActivityItem[]) => {
		const byPid: { [pid: string]: ActivityItem } = {};
		for (const item of arr) {
			const existing = byPid[item.pid];
			if (!existing || new Date(item.created_at) > new Date(existing.created_at)) {
				byPid[item.pid] = item;
			}
		}
		return Object.values(byPid);
	};

	// Fetch wishlist map for quick lookup
	const fetchWishlistMap = async () => {
		try {
			const authToken = await AsyncStorage.getItem('authToken');
			if (!authToken) return;
			const response = await fetch(`https://api.wanslu.shop/api/account/wishlist?offset=0&limit=200`, {
				headers: { 'Authorization': `Bearer ${authToken}` }
			});
			if (response.ok) {
				const data = await response.json();
				const map: { [pid: string]: { id: number } } = {};
				(data.data || []).forEach((it: any) => {
					map[it.pid] = { id: it.id };
				});
				setWishlistMap(map);
			}
		} catch (e) {
			console.error('Failed to fetch wishlist map:', e);
		}
	};

	// Fetch activity
	const fetchActivity = async (isRefresh = false) => {
		if (isRefresh) {
			setLoading(true);
			setOffset(0);
			setHasMore(true);
		} else {
			setLoadingMore(true);
		}

		setError(null);

		try {
			const authToken = await AsyncStorage.getItem('authToken');
			if (!authToken) {
				router.push('/login');
				return;
			}

			const currentOffset = isRefresh ? 0 : offset;
			const base = `https://api.wanslu.shop/api/actions/activity`;
			const url = src === 'all'
				? `${base}?offset=${currentOffset}&limit=${limit}`
				: `${base}?offset=${currentOffset}&limit=${limit}&src=${src}`;

			const response = await fetch(url, {
				headers: { 'Authorization': `Bearer ${authToken}` }
			});

			if (response.ok) {
				const data: ActivityResponse = await response.json();
				const list = data.data || [];
				if (isRefresh) {
					const unique = dedupeByPid(list);
					setItems(unique);
					setTotal(Number(data.meta?.total) || 0);
				} else {
					setItems(prev => dedupeByPid([...prev, ...list]));
				}
				setOffset(currentOffset + list.length);
				setHasMore(list.length === limit);
			} else {
				setError(t('activity.failedToLoadActivity'));
				if (isRefresh) {
					setItems([]);
					setTotal(0);
				}
			}
		} catch (e) {
			console.error('Failed to fetch activity:', e);
			setError(t('activity.networkError'));
			if (isRefresh) {
				setItems([]);
				setTotal(0);
			}
		} finally {
			setLoading(false);
			setLoadingMore(false);
		}
	};

	// Map to product card
	const mapToProductCard = (item: ActivityItem): TrendingProduct => {
		return {
			pid: item.pid,
			src: item.src,
			title: item.title,
			img: item.img,
			price: parseFloat(item.price || '0'),
			view_count: 0,
		};
	};

	// Wishlist toggle for activity items
	const handleWishlistToggle = async (product: TrendingProduct) => {
		try {
			const authToken = await AsyncStorage.getItem('authToken');
			if (!authToken) {
				return;
			}

			const pid = String(product.pid);
			const exists = !!wishlistMap[pid];

			if (!exists) {
				// Add
				const response = await fetch('https://api.wanslu.shop/api/actions/wishlist', {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${authToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						src: product.src,
						pid: pid,
						img: product.img,
						title: product.title,
						price: product.price.toString(),
					}),
				});
				const data = await response.json();
				if (response.ok) {
					setWishlistMap(prev => ({ ...prev, [pid]: { id: data.id || data.data?.id } }));
				}
			} else {
				// Remove
				const response = await fetch('https://api.wanslu.shop/api/actions/wishlist', {
					method: 'DELETE',
					headers: {
						'Authorization': `Bearer ${authToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ id: wishlistMap[pid].id }),
				});
				if (response.ok) {
					setWishlistMap(prev => {
						const copy = { ...prev };
						delete copy[pid];
						return copy;
					});
				}
			}
		} catch (e) {
			console.error('Wishlist toggle failed:', e);
		}
	};

	// Navigation to product detail
	const handleProductPress = (product: TrendingProduct) => {
		const productData = {
			id: product.pid.toString(),
			title: product.title,
			price: product.price.toString(),
			originalPrice: product.price.toString(),
			images: [{ imageUrl: product.img }],
			description: product.title,
			minOrder: 1,
			stock: 100,
			source: product.src,
		};

		router.push({
			pathname: '/product-detail',
			params: {
				id: product.pid.toString(),
				source: product.src,
				productData: JSON.stringify(productData),
			},
		});
	};

	// Handlers
	const onRefresh = useCallback(() => {
		setRefreshing(true);
		Promise.all([fetchActivity(true), fetchWishlistMap()]).finally(() => setRefreshing(false));
	}, [src]);

	const onLoadMore = useCallback(() => {
		if (!loadingMore && hasMore && !loading) {
			fetchActivity(false);
		}
	}, [loadingMore, hasMore, loading, offset, src]);

	const handleSourceChange = (newSrc: SourceKey) => {
		setSrc(newSrc);
		setOffset(0);
		setHasMore(true);
		fetchActivity(true);
	};

	// Effects
	useEffect(() => {
		fetchActivity(true);
		fetchWishlistMap();
	}, []);

	useEffect(() => {
		fetchActivity(true);
		fetchWishlistMap();
	}, [src]);

	// Render item
	const renderActivityItem = ({ item }: { item: ActivityItem }) => {
		const productCard = mapToProductCard(item);
		return (
			<View style={styles.wishlistItem}>
				<ProductCard
					product={productCard}
					onPress={() => handleProductPress(productCard)}
					showWishlistButton={true}
					isInWishlist={!!wishlistMap[item.pid]}
					onWishlistToggle={handleWishlistToggle}
				/>
			</View>
		);
	};

	const renderFilterButtons = () => (
		<View style={styles.categoryContainer}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.categoryScrollContainer}
			>
				{[
					{ key: 'all', label: t('activity.all') },
					{ key: '1688', label: t('activity.wholesale') },
					{ key: 'tb', label: t('activity.retail') },
					{ key: 'chinese', label: t('activity.chinese') },
				].map((category, index) => (
					<TouchableOpacity
						key={category.key}
						style={[
							styles.categoryPill,
							index === 0 && styles.firstCategoryPill,
							index === 3 && styles.lastCategoryPill,
							src === (category.key as SourceKey) && styles.selectedCategoryPill,
						]}
						onPress={() => handleSourceChange(category.key as SourceKey)}
						activeOpacity={0.7}
					>
						<Text
							style={[
								styles.categoryPillText,
								src === (category.key as SourceKey) && styles.selectedCategoryPillText,
							]}
						>
							{category.label}
						</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
		</View>
	);

	const renderLoadMoreIndicator = () => {
		if (!loadingMore) return null;
		return (
			<View style={styles.loadMoreContainer}>
				<ActivityIndicator size="small" color="#E53E3E" />
				<Text style={styles.loadMoreText}>{t('activity.loadingMore')}</Text>
			</View>
		);
	};

	const renderEndText = () => {
		if (loadingMore || hasMore || items.length === 0) return null;
		return (
			<View style={styles.endTextContainer}>
				<Text style={styles.endText}>{t('activity.endReached')}</Text>
			</View>
		);
	};

	const renderErrorState = () => {
		if (!error) return null;
		return (
			<View style={styles.errorContainer}>
				<Ionicons name="alert-circle-outline" size={48} color="#E53E3E" />
				<Text style={styles.errorTitle}>{t('activity.somethingWentWrong')}</Text>
				<Text style={styles.errorMessage}>{error}</Text>
				<TouchableOpacity style={styles.retryButton} onPress={() => fetchActivity(true)}>
					<Text style={styles.retryButtonText}>{t('activity.tryAgain')}</Text>
				</TouchableOpacity>
			</View>
		);
	};

	return (
		<SafeAreaView style={styles.container}>
			<Header cartCount={cartCount} />

			<View style={styles.content}>
				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>{t('activity.title')}</Text>
					<Text style={styles.itemCount}>{t('activity.items', { count: total })}</Text>
				</View>

				{renderFilterButtons()}

				{loading && !refreshing ? (
					<View style={styles.loadingContainer}>
						<ActivityIndicator size="large" color="#E53E3E" />
						<Text style={styles.loadingText}>{t('activity.loading')}</Text>
					</View>
				) : error ? (
					renderErrorState()
				) : items.length === 0 ? (
					<View style={styles.emptyState}>
						<Ionicons name="time-outline" size={64} color="#ccc" />
						<Text style={styles.emptyTitle}>{t('activity.empty')}</Text>
						<Text style={styles.emptySubtitle}>
							{t('activity.startExploring')}
						</Text>
						<TouchableOpacity style={styles.browseButton} onPress={() => router.push('/') }>
							<Text style={styles.browseButtonText}>{t('activity.browseProducts')}</Text>
						</TouchableOpacity>
					</View>
				) : (
					<FlatList
						data={items}
						renderItem={renderActivityItem}
						keyExtractor={(item) => `${item.id}-${item.pid}`}
						showsVerticalScrollIndicator={false}
						contentContainerStyle={styles.listContainer}
						numColumns={2}
						columnWrapperStyle={styles.row}
						refreshControl={
							<RefreshControl
								refreshing={refreshing}
								onRefresh={onRefresh}
								colors={['#E53E3E']}
							/>
						}
						onEndReached={onLoadMore}
						onEndReachedThreshold={0.1}
						ListFooterComponent={() => (
							<View>
								{renderLoadMoreIndicator()}
								{renderEndText()}
							</View>
						)}
					/>
				)}
			</View>
			
			{/* Categories Modal */}
			<CategoriesModal 
				visible={showCategoriesModal} 
				onClose={() => setShowCategoriesModal(false)} 
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f5f5f5',
	},
	content: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 16,
	},
	sectionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#333',
	},
	itemCount: {
		fontSize: 14,
		color: '#666',
	},
	listContainer: {
		paddingBottom: 16,
	},
	row: {
		justifyContent: 'space-between',
		margin: 0,
		gap: 16,
	},
	wishlistItem: {
		flex: 1,
		margin: 0,
		maxWidth: '100%',
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: '#666',
	},
	loadMoreContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 16,
	},
	loadMoreText: {
		marginLeft: 8,
		fontSize: 14,
		color: '#666',
	},
	endTextContainer: {
		alignItems: 'center',
		paddingVertical: 24,
		paddingHorizontal: 16,
	},
	endText: {
		fontSize: 14,
		color: '#999',
		textAlign: 'center',
	},
	errorContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 32,
	},
	errorTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#333',
		marginTop: 16,
		marginBottom: 8,
	},
	errorMessage: {
		fontSize: 14,
		color: '#666',
		textAlign: 'center',
		marginBottom: 24,
		lineHeight: 20,
	},
	retryButton: {
		backgroundColor: '#E53E3E',
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 8,
	},
	retryButtonText: {
		color: 'white',
		fontSize: 16,
		fontWeight: 'bold',
	},
	emptyState: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 32,
	},
	emptyTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#333',
		marginTop: 16,
		marginBottom: 8,
	},
	emptySubtitle: {
		fontSize: 14,
		color: '#666',
		textAlign: 'center',
		marginBottom: 24,
		lineHeight: 20,
	},
	browseButton: {
		backgroundColor: '#E53E3E',
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 8,
	},
	browseButtonText: {
		color: 'white',
		fontSize: 16,
		fontWeight: 'bold',
	},
	categoryContainer: {
		backgroundColor: '#f8f8f8',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#e0e0e0',
		marginBottom: 16,
	},
	categoryScrollContainer: {
		alignItems: 'center',
		paddingHorizontal: 4,
	},
	categoryPill: {
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderWidth: 1,
		borderColor: '#e0e0e0',
		backgroundColor: 'white',
		marginHorizontal: -1,
		minWidth: 95,
		alignItems: 'center',
		justifyContent: 'center',
	},
	firstCategoryPill: {
		borderTopLeftRadius: 10,
		borderBottomLeftRadius: 10,
	},
	lastCategoryPill: {
		borderTopRightRadius: 10,
		borderBottomRightRadius: 10,
	},
	selectedCategoryPill: {
		backgroundColor: '#ed2027',
		borderColor: '#ed2027',
	},
	categoryPillText: {
		color: '#333',
		fontSize: 14,
		fontWeight: '500',
	},
	selectedCategoryPillText: {
		color: 'white',
		fontWeight: '600',
	},
});


