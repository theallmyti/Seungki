import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkContextType {
    isConnected: boolean;
    isInternetReachable: boolean | null;
    connectionType: string | null;
    isLoading: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
    const [networkState, setNetworkState] = useState<NetworkContextType>({
        isConnected: true, // Start optimistically
        isInternetReachable: true,
        connectionType: null,
        isLoading: true,
    });

    useEffect(() => {
        // Get initial network state
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            setNetworkState({
                isConnected: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable,
                connectionType: state.type,
                isLoading: false,
            });
        });

        // Also get the current state immediately
        NetInfo.fetch().then((state: NetInfoState) => {
            setNetworkState({
                isConnected: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable,
                connectionType: state.type,
                isLoading: false,
            });
        });

        return () => unsubscribe();
    }, []);

    return (
        <NetworkContext.Provider value={networkState}>
            {children}
        </NetworkContext.Provider>
    );
}

export function useNetwork() {
    const context = useContext(NetworkContext);
    if (context === undefined) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return context;
}
