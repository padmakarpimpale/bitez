# Bitez for Android

Native Android WebView shell for https://bitez-sg.vercel.app/. This uses the same live web application and Supabase accounts as the browser. Web updates are available without reinstalling the wrapper; native changes require a new Play release.

| Setting | Value |
| --- | --- |
| Application ID | `com.padmakarpimpale.bitez` |
| First release | `1.0.0` / versionCode `1` |
| Minimum Android | Android 8.0 / API 26 |
| Target / compile API | 36 |
| Java | 17 |
| Gradle / Android plugin | 8.13 / 8.13.2 |

The shell includes a first-use community agreement, adaptive Bitez icon, foreground optional location permission, native text sharing, React-aware Android back navigation, keyboard/system-bar insets, reconnect screen, and privacy/deletion links. External HTTPS links open separately. The site must be reachable for ordering and chat. This version has no native push notifications, offline ordering, camera, storage or background location.

## Build

Install Android Studio or the Android SDK command-line tools, Java 17, `platforms;android-36`, and `build-tools;35.0.0`. Point `ANDROID_HOME` at the SDK or create an ignored `local.properties` containing `sdk.dir=/absolute/sdk/path`.

```sh
cd android
./gradlew testDebugUnitTest lintRelease assembleDebug
```

Debug APK: `app/build/outputs/apk/debug/app-debug.apk`. Debug builds use the `.debug` package suffix. Do not upload debug APKs or unsigned CI bundles to Play.

For a signed release, restore your **private upload key backup** and set these four environment variables locally. Never commit the key or passwords:

```sh
export BITEZ_KEYSTORE_PATH=/absolute/private/path/bitez-upload.jks
export BITEZ_KEY_ALIAS=bitez-upload
read -rsp 'Upload keystore password: ' BITEZ_KEYSTORE_PASSWORD; echo
export BITEZ_KEYSTORE_PASSWORD
export BITEZ_KEY_PASSWORD="$BITEZ_KEYSTORE_PASSWORD"
./gradlew playBundle assembleRelease
unset BITEZ_KEYSTORE_PASSWORD BITEZ_KEY_PASSWORD
```

`playBundle` fails if signing configuration is missing. Upload `app/build/outputs/bundle/release/app-release.aab` to Play Console. The release APK in `app/build/outputs/apk/release/` is for direct phone testing. Increase `versionCode` for every subsequent Play upload and update `versionName` when publishing a new release. The package name is permanent after the first Play upload.

Use Google Play App Signing with Google's generated app-signing key. Keep our upload key as a separate private backup. A Play-installed APK and our locally signed test APK may have different signing certificates; uninstall the direct APK before installing from Play if Android refuses to update it.

## Security and links

Navigation, location requests and the WebMessage sharing bridge trust exactly `https://bitez-sg.vercel.app`. The bridge is restricted to the main frame and text invitations; it cannot read files or issue arbitrary native intents. Release WebView debugging, cleartext HTTP, file/content access, mixed content, backups, camera/microphone permission and third-party cookies are disabled. TLS errors stop navigation. Backend access control continues to be enforced by the existing Supabase policies; a wrapper is not a replacement for server authorization.

The manifest can accept Bitez HTTPS links when Android/user settings route them to the app. Links are **not yet verified App Links**: on newer Android versions they usually open in the browser. Verify email/reset passwords in the browser and then sign in inside the app. For automatic opening, publish `/.well-known/assetlinks.json` on the Bitez domain with this application ID and the **Play app-signing certificate** SHA-256 from Play Console, then add `android:autoVerify="true"` to the HTTPS intent filter and ship a native update. Do not use the upload-key fingerprint for Play-distributed app links. Updating the domain requires changing `UrlPolicy`, the manifest, allowed origin rules and the published association file together.

Merge and deploy the accompanying `src/main.tsx` back-event handler before testing this wrapper. Without it, the site uses `replaceState` navigation and Android back cannot close React views correctly.

See [Android release guide](../docs/ANDROID_RELEASE.md) for Play Console steps, device QA, store listing and declarations.
