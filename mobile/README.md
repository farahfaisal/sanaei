# تطبيق حِرَفي — أندرويد وآيفون (Capacitor)

التطبيق يفتح موقع حِرَفي المنشور، ويضيف ما لا يستطيعه الموقع وحده:

- **إشعارات حقيقية من الهاتف** (Firebase) تظهر حتى والتطبيق مغلق، ويفتح الضغط عليها الشاشة الصحيحة (المحادثة، الطلب، طلبات السوق…).
- أيقونة وشاشة بداية بشعار حِرَفي، وأيقونة إشعار بيضاء في شريط الحالة.
- زر الرجوع في أندرويد، وصلاحيات الموقع والكاميرا.
- صفحة «لا يوجد اتصال» عند انقطاع الإنترنت.

أي تعديل تنشره من Rocket يظهر في التطبيق فوراً. تحتاج لبناء نسخة جديدة ورفعها للمتجر فقط عند تغيير شيء في هذا المجلد.

---

## 1) Firebase (مرة واحدة)

مشروع Firebase الحالي: **erafi-98dd0**.

1. افتح [Firebase Console](https://console.firebase.google.com) ← المشروع ← ⚙️ Project settings ← **Add app**.
2. **Android**: اسم الحزمة `com.herafi.app` ← حمّل `google-services.json` وضعه في هذا المجلد (`mobile/`).
3. **iOS** (لاحقاً): Bundle ID `com.herafi.app` ← حمّل `GoogleService-Info.plist` وضعه في هذا المجلد.
4. في Supabase ← Edge Functions ← Secrets تأكد من وجود:
   - `FCM_PROJECT_ID` = `erafi-98dd0`
   - `FCM_SERVICE_ACCOUNT_JSON` = محتوى ملف حساب الخدمة (Service account) كاملاً.

> لتغيير `com.herafi.app` عدّل `appId` في `capacitor.config.ts` **قبل** أول رفع للمتجر؛ بعدها لا يمكن تغييره.

## 2) أندرويد على Windows

المتطلبات: Node.js 20 أو أحدث، و Android Studio (مع JDK 21 المرفق معه).

```bash
cd mobile
npm install
npm run setup:android      # ينشئ مجلد android ويضيف الأيقونات والإعدادات
npm run open:android       # يفتح المشروع في Android Studio
```

في Android Studio:
- للتجربة: وصّل هاتفك بكابل USB (مع تفعيل USB debugging) واضغط ▶ Run.
- للنشر: **Build ← Generate Signed App Bundle** ← أنشئ مفتاح توقيع جديد واحفظه في مكان آمن (بدونه لا يمكنك تحديث التطبيق مستقبلاً) ← ارفع ملف `.aab` إلى Google Play Console.

بعد أي تعديل في هذا المجلد:

```bash
npm run sync && npm run patch
```

## 3) آيفون

يحتاج **Mac** عليه Xcode، أو خدمة بناء سحابية مثل Codemagic إن لم يكن لديك Mac.

```bash
cd mobile
npm install
npm run setup:ios
npm run open:ios
```

في Xcode (مرة واحدة):
1. اسحب `GoogleService-Info.plist` إلى مجلد **App** داخل Xcode (فعّل *Copy items if needed* واختر هدف App).
2. **Signing & Capabilities** ← اختر فريقك (Apple Developer) ← أضف **Push Notifications** و **Background Modes ← Remote notifications**.
3. في [Apple Developer](https://developer.apple.com/account/resources/authkeys/list) أنشئ **APNs Key** (.p8) ← ارفعه في Firebase ← Project settings ← Cloud Messaging ← Apple app configuration.
4. **Product ← Archive** ← ارفعه إلى App Store Connect.

## تجربة الإشعارات

1. ثبّت التطبيق وسجّل الدخول ← اقبل طلب السماح بالإشعارات.
2. أغلق التطبيق تماماً.
3. من حساب آخر: أرسل رسالة أو طلباً ← يجب أن يصل الإشعار ويفتح الضغط عليه الشاشة الصحيحة.

إن لم يصل: تأكد أن الهاتف ظهر في جدول `fcm_tokens` في Supabase، وأن أسرار FCM موجودة (الخطوة 1-4).

## تغيير رابط الموقع

إذا انتقلت إلى نطاق خاص (مثل herafi.app): غيّر `SERVER_URL` في `capacitor.config.ts` والرابط في `www/error.html`، ثم `npm run sync`، وابنِ نسخة جديدة.
