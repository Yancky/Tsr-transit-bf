#!/usr/bin/env bash
set -e

echo "=== 1. Preparation of working directory ==="
BUILD_DIR="build-tmp"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/gen" "$BUILD_DIR/bin" "$BUILD_DIR/assets" "$BUILD_DIR/res"

ANDROID_JAR="/usr/share/java/com.android.android-23.jar"
DX="/usr/lib/android-sdk/build-tools/debian/dx"

echo "=== 2. Generating AndroidManifest.xml and Resources ==="
cat << 'EOF' > "$BUILD_DIR/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="bf.tsrtransport.app"
    android:versionCode="1"
    android:versionName="1.0">

    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="34" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

    <application
        android:label="TSR Transport"
        android:icon="@mipmap/ic_launcher"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true">
        
        <activity
            android:name="bf.tsrtransport.app.MainActivity"
            android:label="TSR Transport"
            android:theme="@android:style/Theme.NoTitleBar.Fullscreen"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

# Copy app icons and resources
mkdir -p "$BUILD_DIR/res/mipmap-hdpi"
cp -r android/app/src/main/res/mipmap-hdpi/ic_launcher.png "$BUILD_DIR/res/mipmap-hdpi/"

echo "=== 3. Compiling Android Resources with aapt ==="
aapt package -m -J "$BUILD_DIR/gen" -M "$BUILD_DIR/AndroidManifest.xml" -S "$BUILD_DIR/res" -I "$ANDROID_JAR"

echo "=== 4. Writing Java Activity Source ==="
mkdir -p "$BUILD_DIR/src/bf/tsrtransport/app"
cat << 'EOF' > "$BUILD_DIR/src/bf/tsrtransport/app/MainActivity.java"
package bf.tsrtransport.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                request.grant(request.getResources());
            }
        });

        webView.loadUrl("file:///android_asset/public/index.html");
        setContentView(webView);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
EOF

echo "=== 5. Compiling Java classes with javac ==="
javac -source 8 -target 8 -bootclasspath "$ANDROID_JAR" \
    -d "$BUILD_DIR/bin" \
    "$BUILD_DIR/gen/bf/tsrtransport/app/R.java" \
    "$BUILD_DIR/src/bf/tsrtransport/app/MainActivity.java"

echo "=== 6. Converting classes to Dalvik DEX ==="
"$DX" --dex --output="$BUILD_DIR/bin/classes.dex" "$BUILD_DIR/bin"

echo "=== 7. Copying Web Assets ==="
mkdir -p "$BUILD_DIR/assets"
cp -r android/app/src/main/assets/* "$BUILD_DIR/assets/"

echo "=== 8. Packaging Initial APK with aapt ==="
aapt package -f -M "$BUILD_DIR/AndroidManifest.xml" \
    -S "$BUILD_DIR/res" \
    -A "$BUILD_DIR/assets" \
    -I "$ANDROID_JAR" \
    -F "$BUILD_DIR/unsigned.apk"

echo "=== 9. Adding classes.dex to APK ==="
(cd "$BUILD_DIR" && zip -u "unsigned.apk" -j "bin/classes.dex")

echo "=== 10. Generating Keystore and Signing APK ==="
KEYSTORE="$BUILD_DIR/tsr-release.keystore"
if [ ! -f "$KEYSTORE" ]; then
    keytool -genkey -v -keystore "$KEYSTORE" \
        -alias tsrtransport \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass tsrtransport2026 -keypass tsrtransport2026 \
        -dname "CN=TSR Transport, OU=IT, O=TSR, L=Ouagadougou, ST=Kadiogo, C=BF"
fi

jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
    -keystore "$KEYSTORE" \
    -storepass tsrtransport2026 -keypass tsrtransport2026 \
    "$BUILD_DIR/unsigned.apk" tsrtransport

echo "=== 11. Zipalign APK ==="
mkdir -p public/downloads
zipalign -v -f 4 "$BUILD_DIR/unsigned.apk" public/downloads/tsr-transport-v1.0.apk
cp public/downloads/tsr-transport-v1.0.apk public/downloads/tsr-transport-latest.apk

echo "=== 12. Packaging Full Source Code ZIP ==="
zip -r public/downloads/tsr-transport-android-source.zip \
    android capacitor.config.ts package.json \
    -x "android/.gradle/*" -x "android/app/build/*"

echo "=== SUCCESS! APK generated at public/downloads/tsr-transport-v1.0.apk ==="
ls -lh public/downloads/
