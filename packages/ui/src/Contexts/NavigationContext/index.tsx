import {
  createContext,
  useContext,
  useMemo,
  useState,
  type FC,
  type PropsWithChildren,
} from 'react';

export type NavigationDataContextType = {
  currentPageTitle: string;
  currentPageUrl: string;
  sidebarOpen: boolean;
  disabledPaths?: string[];
};

type UpdateKey = keyof NavigationDataContextType;

export type NavigationContextType = {
  data: NavigationDataContextType;
  updateData<K extends UpdateKey>(key: K, value: NavigationDataContextType[K]): void;
};

export const INITIAL_DATA: NavigationDataContextType = {
  currentPageTitle: '',
  currentPageUrl: '',
  sidebarOpen: true,
};

export const NavigationContext = createContext<NavigationContextType>({
  data: INITIAL_DATA,
  updateData: () => {
    /* noop default */
  },
});

export const useNavigationContext = (): NavigationContextType =>
  useContext(NavigationContext);

export type NavigationProviderProps = PropsWithChildren<{
  initial?: Partial<NavigationDataContextType>;
}>;

export const NavigationProvider: FC<NavigationProviderProps> = ({ initial, children }) => {
  const [data, setData] = useState<NavigationDataContextType>({
    ...INITIAL_DATA,
    ...initial,
  });
  const value = useMemo<NavigationContextType>(
    () => ({
      data,
      updateData: (key, val) => setData((prev) => ({ ...prev, [key]: val })),
    }),
    [data],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};
