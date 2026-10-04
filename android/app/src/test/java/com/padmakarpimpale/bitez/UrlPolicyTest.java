package com.padmakarpimpale.bitez;

import org.junit.Test;
import static org.junit.Assert.*;

public class UrlPolicyTest {
    @Test public void keepsTrustedInvitesAndRecoveryLinks() {
        assertTrue(UrlPolicy.isTrusted(UrlPolicy.HOME + "?run=123"));
        assertTrue(UrlPolicy.isTrusted(UrlPolicy.HOME + "#type=recovery"));
        assertTrue(UrlPolicy.isTrusted("https://bitez-sg.vercel.app:443/privacy"));
    }
    @Test public void rejectsLookalikesCredentialsAndUnsafeSchemes() {
        String[] invalid = {null, "", "http://bitez-sg.vercel.app", "https://bitez-sg.vercel.app.evil.com", "https://evil.com@bitez-sg.vercel.app", "https://bitez-sg.vercel.app@evil.com", "https://bitez-sg.vercel.app:8443", "https://bitez-sg.vercel.app%2Fevil.com", "javascript:alert(1)", "file:///etc/passwd", "intent://bitez-sg.vercel.app", "https://bitez-sg.vercel.app\\@evil.com"};
        for (String value : invalid) assertFalse(String.valueOf(value), UrlPolicy.isTrusted(value));
    }
    @Test public void externalNavigationOnlyUsesHttpsOrExactSupportEmail() {
        assertTrue(UrlPolicy.isExternalWebLink("https://www.openstreetmap.org/copyright"));
        assertFalse(UrlPolicy.isExternalWebLink("intent://evil.com"));
        assertFalse(UrlPolicy.isExternalWebLink("https://user:pass@evil.com"));
        assertTrue(UrlPolicy.isSafeMailLink("mailto:2002padmakar@gmail.com"));
        assertFalse(UrlPolicy.isSafeMailLink("mailto:evil@evil.com"));
    }
    @Test public void sharingCannotExportAuthTokensOrArbitraryPaths() {
        assertTrue(UrlPolicy.isShareInvite(UrlPolicy.HOME));
        assertTrue(UrlPolicy.isShareInvite(UrlPolicy.HOME + "?run=76d8e13e-a21f-4a71-b546-afdc43c5cbed"));
        assertFalse(UrlPolicy.isShareInvite(UrlPolicy.HOME + "#access_token=secret"));
        assertFalse(UrlPolicy.isShareInvite(UrlPolicy.HOME + "?code=secret"));
        assertFalse(UrlPolicy.isShareInvite(UrlPolicy.HOME + "?run=abc&token=secret"));
        assertFalse(UrlPolicy.isShareInvite(UrlPolicy.HOME + "privacy"));
    }
}
