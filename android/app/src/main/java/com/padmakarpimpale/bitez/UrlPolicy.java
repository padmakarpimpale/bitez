package com.padmakarpimpale.bitez;

import java.net.URI;
import java.net.URISyntaxException;

/** A single trusted origin for app navigation, permissions and native messages. */
final class UrlPolicy {
    static final String ORIGIN = "https://bitez-sg.vercel.app";
    static final String HOME = ORIGIN + "/";
    static boolean isTrusted(String value) {
        if (value == null || value.length() > 8192) return false;
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && "bitez-sg.vercel.app".equalsIgnoreCase(uri.getHost())
                    && uri.getRawUserInfo() == null
                    && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (URISyntaxException e) { return false; }
    }
    static boolean isExternalWebLink(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getHost() != null && uri.getRawUserInfo() == null;
        } catch (URISyntaxException | NullPointerException e) { return false; }
    }
    static boolean isSafeMailLink(String value) {
        return value != null && value.equals("mailto:2002padmakar@gmail.com");
    }
    static boolean isShareInvite(String value) {
        if (!isTrusted(value)) return false;
        try {
            URI uri = new URI(value);
            return (uri.getPath().isEmpty() || "/".equals(uri.getPath()))
                    && uri.getRawFragment() == null
                    && (uri.getRawQuery() == null || uri.getRawQuery().matches("run=[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"));
        } catch (URISyntaxException e) { return false; }
    }
}
