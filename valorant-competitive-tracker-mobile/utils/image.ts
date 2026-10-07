import { Platform } from 'react-native';

/**
 * Normalizes image URLs (especially VLR/owcdn team logos and agent icons).
 * On Web, uses wsrv.nl proxy to bypass 403 Forbidden hotlink/referer blocks on owcdn.net.
 */
export function normalizeLogoUrl(url: string | undefined | null): string {
    if (!url) return 'https://www.vlr.gg/img/vlr/tmp/vlr.png';

    let cleanUrl = url.trim();
    if (cleanUrl.startsWith('//')) {
        cleanUrl = `https:${cleanUrl}`;
    } else if (cleanUrl.startsWith('/')) {
        cleanUrl = `https://www.vlr.gg${cleanUrl}`;
    }

    if (Platform.OS === 'web') {
        // Bypass hotlink referer block on owcdn.net/vlr.gg for web/PWA deployment
        return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}`;
    }

    return cleanUrl;
}
