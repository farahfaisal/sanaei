// Applies حِرَفي's native settings to the generated Android / iOS projects.
// Safe to run again after every `npx cap add` or `npx cap sync` — each change
// is applied only once.
//
//   node scripts/patch-native.mjs
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHANNEL_ID = 'sanaei_notifications'; // must match the push function
const BRAND_GREEN = '#2a724d';

const log = (msg) => console.log(`  • ${msg}`);
const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

// ── Android ───────────────────────────────────────────────────────────────
function patchAndroid() {
  const appDir = path.join(root, 'android', 'app');
  if (!exists(appDir)) {
    console.log('Android: no android/ project yet — run `npm run setup:android` first.');
    return;
  }
  console.log('Android:');

  const manifestPath = path.join(appDir, 'src', 'main', 'AndroidManifest.xml');
  let manifest = read(manifestPath);

  const permissions = [
    'android.permission.INTERNET',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.CAMERA',
  ];
  for (const perm of permissions) {
    if (!manifest.includes(`"${perm}"`)) {
      manifest = manifest.replace(/(\s*)<application/, `$1<uses-permission android:name="${perm}" />$1<application`);
      log(`permission ${perm.split('.').pop()}`);
    }
  }

  const metas = [
    ['com.google.firebase.messaging.default_notification_channel_id', `android:value="${CHANNEL_ID}"`],
    ['com.google.firebase.messaging.default_notification_icon', 'android:resource="@drawable/ic_stat_herafi"'],
    ['com.google.firebase.messaging.default_notification_color', 'android:resource="@color/herafi_green"'],
  ];
  for (const [name, value] of metas) {
    if (!manifest.includes(name)) {
      manifest = manifest.replace(
        /(\s*)<\/application>/,
        `\n        <meta-data android:name="${name}" ${value} />$1</application>`
      );
      log(`notification setting ${name.split('.').pop()}`);
    }
  }
  write(manifestPath, manifest);

  // Status-bar notification icon (white silhouette of the logo)
  const resSrc = path.join(root, 'resources', 'android');
  const resDst = path.join(appDir, 'src', 'main', 'res');
  for (const dir of fs.readdirSync(resSrc)) {
    const dst = path.join(resDst, dir);
    fs.mkdirSync(dst, { recursive: true });
    for (const file of fs.readdirSync(path.join(resSrc, dir))) {
      fs.copyFileSync(path.join(resSrc, dir, file), path.join(dst, file));
    }
  }
  log('notification icon ic_stat_herafi');

  const colorsPath = path.join(resDst, 'values', 'herafi_colors.xml');
  fs.mkdirSync(path.dirname(colorsPath), { recursive: true });
  write(
    colorsPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="herafi_green">${BRAND_GREEN}</color>\n</resources>\n`
  );

  const gs = path.join(root, 'google-services.json');
  if (exists(gs)) {
    fs.copyFileSync(gs, path.join(appDir, 'google-services.json'));
    log('google-services.json copied');
  } else if (!exists(path.join(appDir, 'google-services.json'))) {
    console.log('  ! google-services.json is missing — download it from Firebase and put it in the mobile folder, then run this again.');
  }
}

// ── iOS ───────────────────────────────────────────────────────────────────
function patchIOS() {
  const appDir = path.join(root, 'ios', 'App', 'App');
  if (!exists(appDir)) {
    console.log('iOS: no ios/ project yet — run `npm run setup:ios` on a Mac (or in Codemagic) first.');
    return;
  }
  console.log('iOS:');

  const delegatePath = path.join(appDir, 'AppDelegate.swift');
  let delegate = read(delegatePath);
  if (!delegate.includes('FirebaseCore')) {
    delegate = delegate.replace('import Capacitor', 'import Capacitor\nimport FirebaseCore\nimport FirebaseMessaging');
    delegate = delegate.replace(
      /(didFinishLaunchingWithOptions[^{]*\{)/,
      '$1\n        FirebaseApp.configure()'
    );
    const hooks = `
    // Hand the APNs device token to Firebase so pushes reach this iPhone.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
`;
    const last = delegate.lastIndexOf('}');
    delegate = delegate.slice(0, last) + hooks + delegate.slice(last);
    write(delegatePath, delegate);
    log('AppDelegate: Firebase + push token');
  }

  const plistPath = path.join(appDir, 'Info.plist');
  let plist = read(plistPath);
  const entries = [
    ['NSLocationWhenInUseUsageDescription', '<string>يستخدم حِرَفي موقعك لعرض الحرفيين القريبين منك وتحديد عنوان الخدمة.</string>'],
    ['NSCameraUsageDescription', '<string>يستخدم حِرَفي الكاميرا لتصوير المشكلة وإرفاق الصور بطلب الخدمة.</string>'],
    ['NSPhotoLibraryUsageDescription', '<string>يستخدم حِرَفي الصور لإرفاقها بطلب الخدمة أو بصورتك الشخصية.</string>'],
    ['UIBackgroundModes', '<array>\n\t\t<string>remote-notification</string>\n\t</array>'],
  ];
  for (const [key, value] of entries) {
    if (!plist.includes(`<key>${key}</key>`)) {
      plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t${value}\n</dict>\n</plist>\n`);
      log(`Info.plist ${key}`);
    }
  }
  write(plistPath, plist);

  const gsi = path.join(root, 'GoogleService-Info.plist');
  if (exists(gsi)) {
    fs.copyFileSync(gsi, path.join(appDir, 'GoogleService-Info.plist'));
    log('GoogleService-Info.plist copied (also add it to the App target in Xcode once)');
  } else if (!exists(path.join(appDir, 'GoogleService-Info.plist'))) {
    console.log('  ! GoogleService-Info.plist is missing — download it from Firebase and put it in the mobile folder, then run this again.');
  }
}

patchAndroid();
patchIOS();
console.log('Done.');
