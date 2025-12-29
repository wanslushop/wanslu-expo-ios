import React, { createContext, ReactNode, useContext, useState } from 'react';
import { NavItem } from '../components/Navbar';

interface NavigationContextType {
  currentScreen: NavItem;
  setCurrentScreen: (screen: NavItem) => void;
  searchQuery?: string;
  searchCategory?: string;
  navigateToSearch?: (query: string, category: string) => void;
  showCategoriesModal: boolean;
  setShowCategoriesModal: (show: boolean) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

interface NavigationProviderProps {
  children: ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<NavItem>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchCategory, setSearchCategory] = useState<string>('1688');
  const [showCategoriesModal, setShowCategoriesModal] = useState<boolean>(false);

  const navigateToSearch = (query: string, category: string) => {
    console.log('NavigationContext - navigateToSearch called:', { query, category });
    setSearchQuery(query);
    setSearchCategory(category);
    setCurrentScreen('search');
    console.log('NavigationContext - State updated:', { searchQuery: query, searchCategory: category });
  };

  return (
    <NavigationContext.Provider value={{ 
      currentScreen, 
      setCurrentScreen, 
      searchQuery, 
      searchCategory, 
      navigateToSearch,
      showCategoriesModal,
      setShowCategoriesModal
    }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

// Add default export for the provider
export default NavigationProvider;
