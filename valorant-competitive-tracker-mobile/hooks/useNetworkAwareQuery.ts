import { useEffect, useState, useRef } from 'react';
import { useQuery } from 'convex/react';
import { useNetwork } from '../providers/NetworkProvider';

interface UseNetworkAwareQueryOptions {
    query: any;
    args?: any;
    enabled?: boolean;
    retryDelay?: number;
    maxRetries?: number;
}

interface NetworkAwareQueryResult<T> {
    data: T | undefined;
    isLoading: boolean;
    isError: boolean;
    isOffline: boolean;
    retry: () => void;
    error: Error | null;
}

export function useNetworkAwareQuery<T>({
    query,
    args,
    enabled = true,
    retryDelay = 2000,
    maxRetries = 3,
}: UseNetworkAwareQueryOptions): NetworkAwareQueryResult<T> {
    const { isConnected, isInternetReachable } = useNetwork();
    const [retryCount, setRetryCount] = useState(0);
    const [error, setError] = useState<Error | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const convexQuery = useQuery(query, enabled ? args : "skip");

    // Handle retry logic
    const retry = () => {
        if (retryCount < maxRetries) {
            setRetryCount(prev => prev + 1);
            setError(null);
        }
    };

    // Auto-retry on network reconnection
    useEffect(() => {
        if (isConnected && isInternetReachable && retryCount > 0) {
            const timeout = setTimeout(() => {
                retry();
            }, retryDelay);

            return () => clearTimeout(timeout);
        }
    }, [isConnected, isInternetReachable, retryCount, retryDelay]);

    // Determine if we're offline
    const isOffline = !isConnected || isInternetReachable === false;

    // Determine loading state
    const isLoading = convexQuery === undefined && enabled && !isOffline;

    // Determine error state
    const isError = convexQuery === null || (retryCount >= maxRetries && convexQuery === undefined);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        data: convexQuery,
        isLoading,
        isError,
        isOffline,
        retry,
        error,
    };
}
