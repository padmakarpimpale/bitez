package com.padmakarpimpale.bitez;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebMessageCompat;

import org.json.JSONException;
import org.json.JSONObject;
import java.util.Collections;

public final class MainActivity extends ComponentActivity {
    private static final int PAPER = Color.rgb(250, 248, 244);
    private static final int INK = Color.rgb(35, 35, 31);
    private FrameLayout content;
    private LinearLayout errorPanel;
    private ProgressBar progress;
    private WebView web;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private boolean backPending;
    private final ActivityResultLauncher<String[]> locationRequest = registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                boolean granted = Boolean.TRUE.equals(result.get(Manifest.permission.ACCESS_COARSE_LOCATION))
                        || Boolean.TRUE.equals(result.get(Manifest.permission.ACCESS_FINE_LOCATION));
                completeLocation(granted);
            });

    // This origin-bound WebMessage bridge supports text/url sharing only.
    // There is deliberately no addJavascriptInterface, arbitrary Intent or file access.
    private static final String SHARE_SCRIPT = """
        (() => {
          if (window.top !== window || !window.bitezAndroid || navigator.share) return;
          const pending = new Map();
          bitezAndroid.onmessage = event => {
            try {
              const response = JSON.parse(event.data), task = pending.get(response.id);
              if (!task) return;
              pending.delete(response.id); clearTimeout(task.timer);
              response.ok ? task.resolve() : task.reject(new Error('Could not open Android sharing.'));
            } catch (_) {}
          };
          Object.defineProperty(navigator, 'share', { configurable: true, value: data => new Promise((resolve, reject) => {
            if (!data || data.files) { reject(new TypeError('Bitez shares text invitations only.')); return; }
            const id = crypto.randomUUID();
            const timer = setTimeout(() => { pending.delete(id); reject(new Error('Sharing timed out. Try again.')); }, 30000);
            pending.set(id, { resolve, reject, timer });
            bitezAndroid.postMessage(JSON.stringify({ id, title: data.title || 'Bitez', text: data.text || '', url: data.url || '' }));
          }) });
        })();
        """;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(true);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(PAPER);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets keyboard = insets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(12), 0, dp(8), 0);
        TextView title = new TextView(this);
        title.setText(R.string.brand); title.setTextColor(INK); title.setTextSize(22);
        title.setGravity(Gravity.CENTER_VERTICAL);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setContentDescription("Bitez home");
        title.setOnClickListener(view -> load(UrlPolicy.HOME));
        toolbar.addView(title, new LinearLayout.LayoutParams(0, dp(48), 1));
        Button menu = new Button(this);
        menu.setText("⋮"); menu.setTextSize(24); menu.setContentDescription("App menu");
        menu.setBackgroundColor(Color.TRANSPARENT);
        menu.setOnClickListener(this::showMenu);
        toolbar.addView(menu, new LinearLayout.LayoutParams(dp(48), dp(48)));
        root.addView(toolbar);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        content = new FrameLayout(this);
        root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        createErrorPanel();
        createWebView();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (web == null || errorPanel.getVisibility() == View.VISIBLE) { finish(); return; }
                if (backPending) return;
                backPending = true;
                // The React app consumes this event for dialogs and its own views.
                WebView current = web;
                current.evaluateJavascript("window.dispatchEvent(new Event('bitez:back', {cancelable:true}))", consumed -> {
                    backPending = false;
                    if ("false".equals(consumed) || isFinishing() || web != current) return;
                    if (web.canGoBack()) web.goBack(); else finish();
                });
            }
        });
        if (web != null) {
            String deepLink = trustedIntent(getIntent());
            if (deepLink != null) load(deepLink);
            else if (state == null || web.restoreState(state) == null) load(UrlPolicy.HOME);
        }
        showFirstUseTerms();
    }

    private void showFirstUseTerms() {
        if (getPreferences(MODE_PRIVATE).getInt("accepted_terms_version", 0) >= 1) return;
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(24), dp(12), dp(24), 0);
        TextView summary = new TextView(this);
        summary.setText("Coordinate food with neighbours at a public pickup point. Hosts arrange the order and final costs. No payments are collected by Bitez.\n\nKeep chats respectful. Do not post private addresses, spam, harassment or misleading orders. Report inappropriate messages or runs in the app. Location is optional.");
        summary.setTextSize(16); summary.setTextColor(INK);
        panel.addView(summary);
        Button terms = new Button(this); terms.setText(R.string.read_terms);
        terms.setOnClickListener(v -> external(UrlPolicy.ORIGIN + "/terms"));
        panel.addView(terms);
        Button privacy = new Button(this); privacy.setText(R.string.privacy_deletion);
        privacy.setOnClickListener(v -> external(UrlPolicy.ORIGIN + "/privacy"));
        panel.addView(privacy);
        CheckBox agreement = new CheckBox(this);
        agreement.setText(R.string.terms_agreement);
        panel.addView(agreement);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(panel);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Welcome to Bitez")
                .setView(scroll).setCancelable(false)
                .setNegativeButton("Not now", (d, which) -> finish())
                .setPositiveButton("Continue", (d, which) ->
                        getPreferences(MODE_PRIVATE).edit().putInt("accepted_terms_version", 1).apply())
                .create();
        dialog.setOnShowListener(d -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
            agreement.setOnCheckedChangeListener((button, checked) ->
                    dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(checked));
        });
        dialog.show();
    }

    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private void createErrorPanel() {
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(24), dp(24), dp(24), dp(24));
        errorPanel.setBackgroundColor(PAPER);
        TextView heading = new TextView(this);
        heading.setText(R.string.reconnect_heading); heading.setTextSize(26); heading.setTextColor(INK);
        TextView body = new TextView(this);
        body.setText(R.string.reconnect_body);
        body.setTextSize(16); body.setGravity(Gravity.CENTER); body.setPadding(0, dp(16), 0, dp(20));
        errorPanel.addView(heading); errorPanel.addView(body);
        Button retry = new Button(this); retry.setText(R.string.retry);
        retry.setOnClickListener(v -> {
            if (web == null) createWebView();
            load(UrlPolicy.HOME);
        });
        Button browser = new Button(this); browser.setText(R.string.open_browser);
        browser.setOnClickListener(v -> external(UrlPolicy.HOME));
        errorPanel.addView(retry); errorPanel.addView(browser);
        errorPanel.setVisibility(View.GONE);
        content.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        try { web = new WebView(this); }
        catch (RuntimeException e) { web = null; showError(); return; }
        web.setBackgroundColor(PAPER);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSafeBrowsingEnabled(true);
        settings.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (UrlPolicy.isTrusted(url)) return false;
                if (request.isForMainFrame() && request.hasGesture()
                        && (UrlPolicy.isExternalWebLink(url) || UrlPolicy.isSafeMailLink(url))) external(url);
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                completeLocation(false);
                if (!UrlPolicy.isTrusted(url)) { view.stopLoading(); showError(); return; }
                progress.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (UrlPolicy.isTrusted(url)) {
                    view.evaluateJavascript(SHARE_SCRIPT, null);
                    CookieManager.getInstance().flush();
                }
                progress.setVisibility(View.INVISIBLE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showError();
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); showError();
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                backPending = false;
                completeLocation(false);
                content.removeView(view);
                view.destroy(); web = null;
                showError();
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!UrlPolicy.isTrusted(origin) || !UrlPolicy.isTrusted(web.getUrl()) || locationCallback != null) {
                    callback.invoke(origin, false, false); return;
                }
                locationCallback = callback; locationOrigin = origin;
                if (hasLocation()) completeLocation(true);
                else locationRequest.launch(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION});
            }
            @Override public void onGeolocationPermissionsHidePrompt() { completeLocation(false); }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "bitezAndroid", Collections.singleton(UrlPolicy.ORIGIN),
                    (view, message, sourceOrigin, mainFrame, reply) -> {
                        if (!mainFrame || message.getType() != WebMessageCompat.TYPE_STRING
                                || !UrlPolicy.isTrusted(sourceOrigin.toString()) || !UrlPolicy.isTrusted(view.getUrl())) return;
                        String value = message.getData();
                        if (value == null || value.length() > 5000) return;
                        String id = "";
                        boolean ok = false;
                        try {
                            JSONObject data = new JSONObject(value);
                            id = data.getString("id");
                            String title = data.getString("title"), text = data.getString("text"), url = data.getString("url");
                            if (id.length() > 64 || title.length() > 200 || text.length() > 2000 || !UrlPolicy.isShareInvite(url)) throw new JSONException("Invalid invitation");
                            Intent share = new Intent(Intent.ACTION_SEND).setType("text/plain");
                            share.putExtra(Intent.EXTRA_SUBJECT, title);
                            share.putExtra(Intent.EXTRA_TEXT, (text.isEmpty() ? "" : text + "\n") + url);
                            startActivity(Intent.createChooser(share, "Share Bitez invitation"));
                            ok = true;
                        } catch (JSONException | ActivityNotFoundException ignored) { /* Never log message payloads. */ }
                        JSONObject response = new JSONObject();
                        try { response.put("id", id); response.put("ok", ok); reply.postMessage(response.toString()); }
                        catch (JSONException ignored) { /* The web caller times out safely. */ }
                    });
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
                WebViewCompat.addDocumentStartJavaScript(web, SHARE_SCRIPT, Collections.singleton(UrlPolicy.ORIGIN));
        }
        content.addView(web, 0, new FrameLayout.LayoutParams(-1, -1));
    }

    private boolean hasLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
    private void completeLocation(boolean allow) {
        if (locationCallback == null) return;
        GeolocationPermissions.Callback callback = locationCallback;
        String origin = locationOrigin;
        locationCallback = null; locationOrigin = null;
        callback.invoke(origin, allow && hasLocation() && web != null && UrlPolicy.isTrusted(web.getUrl()), false);
    }
    private void load(String url) {
        if (web == null || !UrlPolicy.isTrusted(url)) return;
        completeLocation(false);
        errorPanel.setVisibility(View.GONE);
        web.loadUrl(url);
    }
    private void showError() {
        if (progress != null) progress.setVisibility(View.INVISIBLE);
        if (errorPanel != null) { errorPanel.setVisibility(View.VISIBLE); errorPanel.bringToFront(); }
    }
    private void external(String url) {
        if (!UrlPolicy.isExternalWebLink(url) && !UrlPolicy.isSafeMailLink(url)) return;
        try {
            Intent intent = new Intent(UrlPolicy.isSafeMailLink(url) ? Intent.ACTION_SENDTO : Intent.ACTION_VIEW, Uri.parse(url));
            // No explicit package, arbitrary intent scheme or credential-bearing URL.
            Intent chooser = Intent.createChooser(intent, UrlPolicy.isSafeMailLink(url) ? "Contact Bitez" : "Open link");
            // Legal links must remain readable before agreement; do not offer
            // this wrapper as its own external browser and reopen the dialog.
            chooser.putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS,
                    new ComponentName[]{new ComponentName(this, MainActivity.class)});
            startActivity(chooser);
        } catch (ActivityNotFoundException ignored) { Toast.makeText(this, "No app available to open this link.", Toast.LENGTH_SHORT).show(); }
    }
    private void showMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add(0, 1, 0, "Reload Bitez");
        menu.getMenu().add(0, 2, 1, "Share app");
        menu.getMenu().add(0, 3, 2, "Privacy & deletion");
        menu.getMenu().add(0, 4, 3, "Community terms");
        menu.getMenu().add(0, 5, 4, "Open in browser");
        menu.getMenu().add(0, 6, 5, "About Bitez");
        menu.setOnMenuItemClickListener(item -> {
            switch (item.getItemId()) {
                case 1 -> { if (web != null && errorPanel.getVisibility() != View.VISIBLE) web.reload(); else load(UrlPolicy.HOME); }
                case 2 -> {
                    Intent share = new Intent(Intent.ACTION_SEND).setType("text/plain");
                    share.putExtra(Intent.EXTRA_TEXT, "Bitez — Good food. Shared delivery.\n" + UrlPolicy.HOME);
                    try { startActivity(Intent.createChooser(share, "Share Bitez")); }
                    catch (ActivityNotFoundException ignored) { Toast.makeText(this, "Sharing is unavailable.", Toast.LENGTH_SHORT).show(); }
                }
                case 3 -> load(UrlPolicy.ORIGIN + "/privacy");
                case 4 -> load(UrlPolicy.ORIGIN + "/terms");
                case 5 -> external(UrlPolicy.HOME);
                case 6 -> new AlertDialog.Builder(this).setTitle("Bitez " + BuildConfig.VERSION_NAME)
                        .setMessage("Good food. Shared delivery.\n\nA community pilot in Singapore. Hosts arrange orders and public pickup. Bitez does not collect payments or provide delivery.\n\nLocation is optional. No background location, advertising or push notifications.")
                        .setPositiveButton("Close", null).show();
                default -> { return false; }
            }
            return true;
        });
        menu.show();
    }
    private String trustedIntent(Intent intent) {
        if (!Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getData() == null) return null;
        String url = intent.getData().toString();
        return UrlPolicy.isTrusted(url) ? url : null;
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        String url = trustedIntent(intent);
        if (url != null) load(url);
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        if (web != null) web.saveState(state);
        super.onSaveInstanceState(state);
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() {
        completeLocation(false);
        if (web != null) {
            content.removeView(web); web.stopLoading(); web.destroy(); web = null;
        }
        super.onDestroy();
    }
}
