'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';

interface Section {
  title: string;
  content: string;
}

const sections: Section[] = [
  {
    title: 'مقدمة',
    content:
      'نحن في تطبيق حِرَفي نلتزم بحماية خصوصيتك وأمان بياناتك الشخصية. تصف سياسة الخصوصية هذه كيفية جمع معلوماتك واستخدامها وحمايتها عند استخدامك لتطبيقنا وخدماتنا.',
  },
  {
    title: 'المعلومات التي نجمعها',
    content:
      'نجمع المعلومات التي تقدمها مباشرةً عند التسجيل، مثل: رقم الهاتف، الاسم، الموقع الجغرافي، وصور الملف الشخصي. كما نجمع بيانات الاستخدام تلقائياً مثل سجلات الطلبات والمحادثات وتقييمات الخدمات.',
  },
  {
    title: 'كيف نستخدم معلوماتك',
    content:
      'نستخدم بياناتك لتقديم خدماتنا وتحسينها، وربطك بالحرفيين المناسبين، وإرسال الإشعارات المتعلقة بطلباتك، وضمان أمان الحساب، والامتثال للمتطلبات القانونية.',
  },
  {
    title: 'مشاركة المعلومات',
    content:
      'لا نبيع بياناتك الشخصية لأطراف ثالثة. نشارك المعلومات الضرورية فقط مع الحرفيين لإتمام الطلبات، ومع مزودي الخدمات التقنية الموثوقين الذين يساعدوننا في تشغيل التطبيق، وذلك وفق اتفاقيات سرية صارمة.',
  },
  {
    title: 'الموقع الجغرافي',
    content:
      'يستخدم التطبيق موقعك الجغرافي لعرض الحرفيين القريبين منك وتسهيل وصولهم إليك. يمكنك التحكم في أذونات الموقع من إعدادات جهازك في أي وقت.',
  },
  {
    title: 'أمان البيانات',
    content:
      'نطبق معايير أمان عالية لحماية بياناتك، بما في ذلك التشفير أثناء النقل والتخزين، والمصادقة الثنائية، ومراقبة الوصول غير المصرح به. مع ذلك، لا يوجد نظام آمن بالكامل ونشجعك على استخدام كلمات مرور قوية.',
  },
  {
    title: 'حقوقك',
    content:
      'يحق لك في أي وقت: الاطلاع على بياناتك الشخصية، تصحيحها أو تحديثها، طلب حذفها، سحب موافقتك على معالجتها. للتواصل معنا بشأن أي من هذه الحقوق، يرجى مراسلتنا عبر البريد الإلكتروني.',
  },
  {
    title: 'الاحتفاظ بالبيانات',
    content:
      'نحتفظ ببياناتك طالما حسابك نشط أو حسب الحاجة لتقديم الخدمات. عند حذف حسابك، نحذف بياناتك الشخصية خلال 30 يوماً، مع الاحتفاظ بما يلزم قانونياً.',
  },
  {
    title: 'التعديلات على السياسة',
    content:
      'قد نحدّث سياسة الخصوصية هذه من وقت لآخر. سنخطرك بأي تغييرات جوهرية عبر إشعار داخل التطبيق أو رسالة نصية. استمرارك في استخدام التطبيق بعد التحديث يعني موافقتك على السياسة الجديدة.',
  },
  {
    title: 'التواصل معنا',
    content:
      'إذا كان لديك أي استفسار حول سياسة الخصوصية أو طريقة تعاملنا مع بياناتك، يمكنك التواصل معنا عبر: privacy@herafi.app',
  },
];

export default function PrivacyPolicyClient() {
  const router = useRouter();

  return (
    <div className="screen-container flex flex-col min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-4 sticky top-0 z-10"
        style={{ background: '#2a724d' }}
      >
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"
          aria-label="رجوع"
        >
          <Icon name="ChevronRightIcon" size={20} className="text-white" />
        </button>
        <h1 className="text-lg font-bold text-white flex-1">سياسة الخصوصية</h1>
      </div>

      {/* Intro banner */}
      <div className="mx-4 mt-4 mb-2 rounded-2xl p-4" style={{ background: '#e8f5ee' }}>
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: '#2a724d' }}
          >
            <Icon name="ShieldCheckIcon" size={22} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 mb-0.5">خصوصيتك تهمنا</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              آخر تحديث: أكتوبر ٢٠٢٦ — نلتزم بحماية بياناتك الشخصية وفق أعلى معايير الأمان.
            </p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3 px-4 pb-8 mt-2">
        {sections.map((section, index) => (
          <div key={index} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                style={{ background: '#2a724d' }}
              >
                {index + 1}
              </div>
              <h2 className="text-sm font-bold text-gray-900">{section.title}</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed pr-8">{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
