export type SupportedLanguage = 'ar' | 'en' | 'ku' | 'fr' | 'es' | 'tr' | 'de' | 'fa';

export interface Translations {
  dir: 'rtl' | 'ltr';
  langName: string;
  countryName: string;
  flag: string;
  // TopBar
  language: string;
  adminRole: string;
  userRole: string;
  streakBadge: string;
  adminSupport: string;
  notificationsTitle: string;
  newBadge: string;
  notif1Title: string;
  notif1Text: string;
  notif2Title: string;
  notif2Text: string;
  installApp: string;
  darkMode: string;
  lightMode: string;

  // Sidebar
  home: string;
  profile: string;
  adminManagement: string;
  adminBadge: string;
  myFiles: string;
  users: string;
  subscriptions: string;
  settings: string;
  logout: string;
  vipUser: string;
  vipPerks: string;

  // Hero Banner
  welcomeTitle: string;
  welcomeSubtitle: string;
  vipStatus: string;
  activeUntil: string;

  // 6 Services
  serviceTranslate: string;
  serviceQuestions: string;
  serviceConvert: string;
  serviceVoice: string;
  serviceImage: string;
  serviceResearch: string;

  // Upload Box
  uploadTitle: string;
  uploadSubtitle: string;
  largeFilesBadge: string;
  chooseFiles: string;
  uploadingDoc: string;
  readyForProcessing: string;
  pagesCountLabel: string;
  clearFile: string;
  quickResearch: string;
  quickSolve: string;
  quickQuestions: string;
  quickTranslate: string;
  featureAcademicTitle: string;
  featureAcademicDesc: string;
  startNow: string;

  // Translation Box
  translationOptionsTitle: string;
  singleLanguage: string;
  dualLanguage: string;
  extractedLangLabel: string;
  typeOrPastePlaceholder: string;
  translateBtn: string;
  translatingBtn: string;

  // Bottom Notice
  bottomNoticeText: string;
  viewPlansBtn: string;

  // Offline Banner
  offlineBannerText: string;
  offlineSavedFilesBtn: string;

  // Common buttons & labels
  copy: string;
  copied: string;
  download: string;
  close: string;
  cancel: string;
  save: string;
  loading: string;
  error: string;

  // Extended UI & dynamic labels
  charsCountLabel: string;
  adminDisplayName: string;
  vipBadge: string;
  memberBadge: string;
  adBannerTop: string;
  removeAdsVipBtn: string;
  adBannerFooter: string;
  trialSimBtnActive: string;
  trialSimBtnInactive: string;
  trialBarTitle: string;
  trialUsagePrefix: string;
  trialFirstFree: string;
  trialAdRequired: string;
  trialResetFreeBtn: string;
  trialTestAdBtn: string;
  trialStreakBtn: string;
  trialVipScreenBtn: string;
  trialExitBtn: string;
  toggleLangTooltip: string;
  sidebarMenuLabel: string;
  notificationsAria: string;
  supportChatTooltip: string;

  // TranslationBox extended
  textToTranslateLabel: string;
  translatedResultTitle: string;
  exactDocReady: string;
  exactDocPreserved: string;
  downloadFileBtn: string;
  exportPdfBtn: string;
  preparingPdfBtn: string;
  downloadFileNameHint: string;
  diagnosticLogTitle: string;
  diagnosticSteps: string;
  diagnosticReady: string;
  diagnosticIdleHint: string;

  // PWA Install Button
  installAppTitle: string;
  installPwaSidebar: string;
  installGuideTitle: string;
  installGuideDesc: string;
  installStep1: string;
  installStep2: string;
  installStep3: string;
  gotItBtn: string;

  // Profile / Settings Modal
  profileModalTitle: string;
  profileModalSubtitle: string;
  accountStatusLabel: string;
  vipMemberLabel: string;
  freeMemberLabel: string;
  streakDaysLabel: string;
  dayStreakSuffix: string;
  appThemeLabel: string;
  appLanguageLabel: string;
  emailLabel: string;
  fullNameLabel: string;
  changePasswordLabel: string;
  keepPasswordPlaceholder: string;
  profileSavedMsg: string;
  saveChangesBtn: string;
  savingBtn: string;

  // Auth Modal
  authLoginTitle: string;
  authRegisterTitle: string;
  authPasswordLabel: string;
  authForgotBtn: string;
  authForgotSent: string;
  authLoginBtn: string;
  authRegisterBtn: string;
  authProcessingBtn: string;
  authSwitchToLogin: string;
  authSwitchToRegister: string;

  // Subscriptions Modal
  subModalTitle: string;
  subModalSubtitle: string;
  subMonthlyTitle: string;
  subMonthlyDesc: string;
  subPerMonth: string;
  subYearlyTitle: string;
  subYearlyDesc: string;
  subPerYear: string;
  subBestValue: string;
  subActivateBtn: string;
  subActivatingBtn: string;
}

const extraEnDefaults = {
  charsCountLabel: 'chars',
  adminDisplayName: 'Admin',
  vipBadge: 'VIP 👑',
  memberBadge: 'Member',
  adBannerTop: 'Sponsored Partner Space · Ad Placement',
  removeAdsVipBtn: 'Remove Ads with VIP',
  adBannerFooter: 'Sponsored Footer Space · Partner Network',
  trialSimBtnActive: 'Trial Mode Active',
  trialSimBtnInactive: 'Preview as User',
  trialBarTitle: 'User Trial Preview Mode:',
  trialUsagePrefix: 'Usage',
  trialFirstFree: '(1st use is completely free with no ads)',
  trialAdRequired: '(Ad required next)',
  trialResetFreeBtn: 'Reset (0 Free)',
  trialTestAdBtn: 'Test Ad',
  trialStreakBtn: '30-Day Reward',
  trialVipScreenBtn: 'VIP Screen',
  trialExitBtn: 'Exit to Admin',
  toggleLangTooltip: 'Switch language between Arabic and English',
  sidebarMenuLabel: 'Navigation menu',
  notificationsAria: 'Notifications',
  supportChatTooltip: 'Contact Us',

  textToTranslateLabel: 'Text to translate (or use uploaded file)',
  translatedResultTitle: 'Translated Result',
  exactDocReady: 'Translated original file ready:',
  exactDocPreserved: 'Formatting preserved directly in browser.',
  downloadFileBtn: 'Download File',
  exportPdfBtn: 'Export as PDF',
  preparingPdfBtn: 'Preparing PDF...',
  downloadFileNameHint: 'Download filename:',
  diagnosticLogTitle: 'Live Processing Status',
  diagnosticSteps: 'steps',
  diagnosticReady: 'Ready',
  diagnosticIdleHint: 'Click Translate or Export to track local client-side processing progress.',

  installAppTitle: 'Install app on home screen for offline use',
  installPwaSidebar: 'Install as PWA',
  installGuideTitle: 'Install Meta.Ny on Home Screen',
  installGuideDesc: 'Launch Meta.Ny faster and work offline by installing it on your device:',
  installStep1: 'Tap the Share button in your browser bar.',
  installStep2: 'Scroll down and select Add to Home Screen.',
  installStep3: 'Tap Add to run Meta.Ny offline like a native app!',
  gotItBtn: 'Got it',

  profileModalTitle: 'My Profile & Settings',
  profileModalSubtitle: 'Account info, theme, language & subscription',
  accountStatusLabel: 'Account Status',
  vipMemberLabel: 'VIP Member',
  freeMemberLabel: 'Free User',
  streakDaysLabel: 'Consecutive Streak',
  dayStreakSuffix: 'days',
  appThemeLabel: 'App Theme',
  appLanguageLabel: 'Interface Language',
  emailLabel: 'Email Address',
  fullNameLabel: 'Full Name',
  changePasswordLabel: 'Change Password',
  keepPasswordPlaceholder: 'Leave empty to keep current password',
  profileSavedMsg: 'Account details updated successfully',
  saveChangesBtn: 'Save Changes',
  savingBtn: 'Saving...',

  authLoginTitle: 'Sign in to Meta.Ny',
  authRegisterTitle: 'Create a Meta.Ny Account',
  authPasswordLabel: 'Password',
  authForgotBtn: 'Forgot password?',
  authForgotSent: 'Password reset link has been sent to your email',
  authLoginBtn: 'Sign In',
  authRegisterBtn: 'Create Account',
  authProcessingBtn: 'Processing...',
  authSwitchToLogin: 'Already have an account? Sign in',
  authSwitchToRegister: "Don't have an account? Create one for free",

  subModalTitle: 'Premium VIP Plans & Subscriptions',
  subModalSubtitle: 'Enjoy all Meta.Ny AI services with zero ads and priority speed',
  subMonthlyTitle: 'Monthly VIP',
  subMonthlyDesc: 'Ideal for students & researchers during semesters',
  subPerMonth: '/ month',
  subYearlyTitle: 'Annual Pro VIP',
  subYearlyDesc: 'Full-year unlimited access for theses and research',
  subPerYear: '/ year',
  subBestValue: 'Best Value (Save 40%)',
  subActivateBtn: 'Activate VIP Now & Skip All Ads',
  subActivatingBtn: 'Activating VIP subscription...',
};

export const translations: Record<SupportedLanguage, Translations> = {
  ar: {
    dir: 'rtl',
    langName: 'العربية',
    countryName: 'العالم العربي (Arab World)',
    flag: '🇮🇶',
    language: 'العربية',
    adminRole: 'مدير (Admin)',

    userRole: 'مستخدم عادي',
    streakBadge: 'سلسلة الولاء',
    adminSupport: 'تواصل معنا',
    notificationsTitle: 'التنبيهات والإشعارات',
    newBadge: '2 جديدة',
    notif1Title: 'تفعيل مجاني كامل',
    notif1Text: 'يمكنك الآن استخدام التطبيق مجاناً لأول مرة بدون قيود، أو مشاهدة 3 إعلانات لكل استخدام تالٍ.',
    notif2Title: 'مكافأة الـ 30 يوماً',
    notif2Text: 'استخدم التطبيق يومياً لمدة شهر واحصل تلقائياً على 7 أيام VIP مجانية بدون إعلانات!',
    installApp: 'تثبيت التطبيق',
    darkMode: 'الوضع الداكن',
    lightMode: 'الوضع الفاتح',

    home: 'الرئيسية',
    profile: 'ملفي الشخصي',
    adminManagement: 'إدارة التطبيق',
    adminBadge: 'أدمن',
    myFiles: 'ملفاتي والمستندات',
    users: 'المستخدمون',
    subscriptions: 'الاشتراكات',
    settings: 'الإعدادات',
    logout: 'تسجيل الخروج',
    vipUser: 'مستخدم VIP',
    vipPerks: 'استمتع بجميع المميزات بدون قيود',

    welcomeTitle: 'مرحبًا بك في Meta.Ny',
    welcomeSubtitle: 'مساحتك الذكية للمستندات والترجمة والأسئلة والصوت والبحوث.',
    vipStatus: 'اشتراك VIP',
    activeUntil: 'نشط حتى: 2026/12/31',

    serviceTranslate: 'الترجمة متعددة اللغات',
    serviceQuestions: 'توليد الأسئلة والأجوبة',
    serviceConvert: 'تحويل الملفات والمستندات',
    serviceVoice: 'تحويل الصوت إلى نص أو صوت',
    serviceImage: 'التعديل على الصور',
    serviceResearch: 'كتابة البحوث والتقارير',

    uploadTitle: 'ارفع ملفاتك أو مستنداتك هنا',
    uploadSubtitle: 'يدعم المعالجة الفورية داخل المتصفح حتى 20MB للملف (PDF, Word, Excel, PPTX, TXT, صور, صوت)',
    largeFilesBadge: 'معالجة فورية بالمتصفح حتى 20MB',
    chooseFiles: 'اختيار الملفات',
    uploadingDoc: 'جارٍ قراءة واستخراج نصوص المستند مباشرة داخل المتصفح...',
    readyForProcessing: 'جاهز للمعالجة الأكاديمية والذكية',
    pagesCountLabel: 'صفحة',
    clearFile: 'إلغاء الملف',
    quickResearch: 'كتابة بحث',
    quickSolve: 'حل المستند',
    quickQuestions: 'توليد أسئلة',
    quickTranslate: 'ترجمة فورية',
    featureAcademicTitle: 'كتابة التقارير والأبحاث بطريقة محترفة',
    featureAcademicDesc: 'إنشاء بحوث جامعية ومدرسية وتقارير عمل كاملة مع الفهرس والمراجع الأكاديمية',
    startNow: 'ابدأ الآن',


    translationOptionsTitle: 'خيارات الترجمة',
    singleLanguage: 'لغة واحدة',
    dualLanguage: 'لغتين مزدوجتين',
    extractedLangLabel: 'اللغة المستخرجة',
    typeOrPastePlaceholder: 'اكتب أو الصق النص هنا، أو ارفع ملفاً في المربع المقابل...',
    translateBtn: 'ترجمة النص',
    translatingBtn: 'جارٍ الترجمة...',

    bottomNoticeText: 'يمكنك الآن استخدام التطبيق مجاناً مرّة واحدة، وبعد ذلك يمكنك مشاهدة 3 إعلانات أو الاشتراك في أحد الباقات.',
    viewPlansBtn: 'عرض الباقات',

    offlineBannerText: 'أنت في وضع عدم الاتصال - يمكنك استخدام الملفات المحفوظة (أوفلاين)',
    offlineSavedFilesBtn: 'ملفاتي المحفوظة',

    copy: 'نسخ',
    copied: 'تم النسخ!',
    download: 'تنزيل',
    close: 'إغلاق',
    cancel: 'إلغاء',
    save: 'حفظ',
    loading: 'جارٍ التحميل...',
    error: 'حدث خطأ',

    charsCountLabel: 'حرف',
    adminDisplayName: 'المدير',
    vipBadge: 'VIP 👑',
    memberBadge: 'عضو',
    adBannerTop: 'مساحة إعلانية ممولة · Partner Space',
    removeAdsVipBtn: 'إزالة الإعلانات بالترقية لـ VIP',
    adBannerFooter: 'مساحة رعاية معتمدة · Partner Footer Space',
    trialSimBtnActive: 'وضع التجربة نشط',
    trialSimBtnInactive: 'تجربة الموقع كـ مستخدم',
    trialBarTitle: 'وضع تجربة المستخدم (فترة التجربة):',
    trialUsagePrefix: 'الاستخدام',
    trialFirstFree: '(الاستخدام الأول مجاني بالكامل بدون إعلانات)',
    trialAdRequired: '(سيتطلب إعلاناً)',
    trialResetFreeBtn: 'إعادة تعيين (0 مجاني)',
    trialTestAdBtn: 'اختبار الإعلان',
    trialStreakBtn: 'مكافأة 30 يوماً',
    trialVipScreenBtn: 'شاشة VIP',
    trialExitBtn: 'خروج والعودة للأدمن',
    toggleLangTooltip: 'تبديل اللغة بين العربية والإنجليزية',
    sidebarMenuLabel: 'القائمة الجانبية',
    notificationsAria: 'الإشعارات',
    supportChatTooltip: 'تواصل معنا',

    textToTranslateLabel: 'النص المراد ترجمته (أو استخدام الملف المرفوع)',
    translatedResultTitle: 'الترجمة الناتجة',
    exactDocReady: 'الملف الأصلي المترجم جاهز:',
    exactDocPreserved: 'تم الحفاظ على التنسيق وبنية الملف بالكامل داخل المتصفح.',
    downloadFileBtn: 'تحميل الملف',
    exportPdfBtn: 'تحميل كـ PDF (Export as PDF)',
    preparingPdfBtn: 'جاري تجهيز PDF...',
    downloadFileNameHint: 'اسم الملف عند التحميل:',
    diagnosticLogTitle: 'حالة المعالجة الفورية (Client-Side Log)',
    diagnosticSteps: 'خطوات',
    diagnosticReady: 'جاهز',
    diagnosticIdleHint: 'تتم المعالجة والترجمة مباشرة داخل متصفحك عبر LibreTranslate و MyMemory بدون خادم.',

    installAppTitle: 'تثبيت التطبيق على الشاشة الرئيسية للعمل بدون إنترنت',
    installPwaSidebar: 'تثبيت التطبيق كـ PWA',
    installGuideTitle: 'تثبيت Meta.Ny على الشاشة الرئيسية',
    installGuideDesc: 'يمكنك تشغيل التطبيق بسرعة وبدون اتصال بالإنترنت عند تثبيته على شاشة هاتفك:',
    installStep1: 'اضغط على زر المشاركة في شريط المتصفح.',
    installStep2: 'مرر للأسفل واختر إضافة إلى الشاشة الرئيسية (Add to Home Screen).',
    installStep3: 'اضغط على إضافة (Add) وسيعمل كبرنامج أصلي بدون إنترنت!',
    gotItBtn: 'فهمت، حسناً',

    profileModalTitle: 'ملفي الشخصي والإعدادات',
    profileModalSubtitle: 'بيانات الحساب والمظهر واللغة والاشتراك',
    accountStatusLabel: 'حالة الحساب',
    vipMemberLabel: 'مستخدم VIP',
    freeMemberLabel: 'مستخدم مجاني',
    streakDaysLabel: 'سلسلة الأيام المتواصلة',
    dayStreakSuffix: 'يوم متواصل',
    appThemeLabel: 'مظهر التطبيق (Theme)',
    appLanguageLabel: 'لغة الواجهة (Language)',
    emailLabel: 'البريد الإلكتروني',
    fullNameLabel: 'الاسم الكامل',
    changePasswordLabel: 'تغيير كلمة المرور',
    keepPasswordPlaceholder: 'اتركه فارغاً إن كنت لا ترغب بالتغيير',
    profileSavedMsg: 'تم تحديث بيانات الحساب بنجاح',
    saveChangesBtn: 'حفظ التعديلات',
    savingBtn: 'جارٍ الحفظ...',

    authLoginTitle: 'تسجيل الدخول إلى Meta.Ny',
    authRegisterTitle: 'إنشاء حساب جديد في Meta.Ny',
    authPasswordLabel: 'كلمة المرور',
    authForgotBtn: 'نسيت كلمة المرور؟',
    authForgotSent: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك',
    authLoginBtn: 'تسجيل الدخول',
    authRegisterBtn: 'إنشاء الحساب فوراً',
    authProcessingBtn: 'جارٍ المعالجة...',
    authSwitchToLogin: 'لديك حساب بالفعل؟ تسجيل الدخول',
    authSwitchToRegister: 'ليس لديك حساب؟ إنشاء حساب جديد مجاناً',

    subModalTitle: 'باقات واشتراكات VIP المميزة',
    subModalSubtitle: 'استمتع بجميع خدمات Meta.Ny الذكية بدون أي إعلانات وبسرعة قصوى',
    subMonthlyTitle: 'VIP الشهري',
    subMonthlyDesc: 'للطلاب والباحثين أثناء الفصول الدراسية',
    subPerMonth: '/ شهرياً',
    subYearlyTitle: 'VIP السنوي الشامل',
    subYearlyDesc: 'وصول دائم طوال العام لمشاريع التخرج والبحوث',
    subPerYear: '/ سنوياً',
    subBestValue: 'الأكثر توفيراً (وفر 40%)',
    subActivateBtn: 'تفعيل باقة VIP الآن وتخطي الإعلانات فوراً',
    subActivatingBtn: 'جارٍ تفعيل اشتراك VIP...',
  },

  en: {
    dir: 'ltr',
    langName: 'English',
    countryName: 'United States / Global',
    flag: '🌐',
    language: 'English',
    adminRole: 'Admin Mode',
    userRole: 'Regular User',
    streakBadge: 'Loyalty Streak',
    adminSupport: 'Contact Us',
    notificationsTitle: 'Notifications & Alerts',
    newBadge: '2 New',
    notif1Title: '100% Client-Side Engine',
    notif1Text: 'All document translation, voice, conversion, Q&A, and research tools run directly in your browser.',
    notif2Title: '30-Day Reward',
    notif2Text: 'Use the app daily for a month and receive 7 days of free VIP without any ads!',
    installApp: 'Install App',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',

    home: 'Home',
    profile: 'My Profile',
    adminManagement: 'App Management',
    adminBadge: 'Admin',
    myFiles: 'My Files & Docs',
    users: 'Users',
    subscriptions: 'Subscriptions',
    settings: 'Settings',
    logout: 'Log Out',
    vipUser: 'VIP User',
    vipPerks: 'Enjoy all premium features without limits',

    welcomeTitle: 'Welcome to Meta.Ny',
    welcomeSubtitle: 'Your smart workspace for documents, translation, questions, voice, and research.',
    vipStatus: 'VIP Subscription',
    activeUntil: 'Active until: 2026/12/31',

    serviceTranslate: 'Multilingual Translation',
    serviceQuestions: 'Questions & Answers Gen',
    serviceConvert: 'File & Document Converter',
    serviceVoice: 'Voice to Text / Text to Voice',
    serviceImage: 'Image Editing & OCR',
    serviceResearch: 'Academic Research & Reports',

    uploadTitle: 'Upload your files or documents here',
    uploadSubtitle: 'Instant client-side browser processing up to 20MB per file (PDF, Word, Excel, PPTX, TXT, Images, Audio)',
    largeFilesBadge: 'Client-side processing up to 20MB',
    chooseFiles: 'Choose Files',
    uploadingDoc: 'Extracting document text and structure directly in your browser...',
    readyForProcessing: 'Ready for smart academic processing',
    pagesCountLabel: 'pages',
    clearFile: 'Clear File',
    quickResearch: 'Write Research',
    quickSolve: 'Solve Document',
    quickQuestions: 'Generate Quiz',
    quickTranslate: 'Instant Translate',
    featureAcademicTitle: 'Professional Research & Reports Writing',
    featureAcademicDesc: 'Create full university and school research papers with citations, index, and bibliography',
    startNow: 'Start Now',

    translationOptionsTitle: 'Translation Options',
    singleLanguage: 'Single Language',
    dualLanguage: 'Dual Bilingual',
    extractedLangLabel: 'Target Language',
    typeOrPastePlaceholder: 'Type or paste text here, or upload a file in the box beside...',
    translateBtn: 'Translate Text',
    translatingBtn: 'Translating...',

    bottomNoticeText: 'You can now use the app once for free, and afterward you can watch 3 ads or subscribe to VIP.',
    viewPlansBtn: 'View Plans',

    offlineBannerText: 'You are offline — You can access your locally saved files (Offline Mode)',
    offlineSavedFilesBtn: 'Saved Files',

    copy: 'Copy',
    copied: 'Copied!',
    download: 'Download',
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    loading: 'Loading...',
    error: 'An error occurred',
    ...extraEnDefaults,
  },

  ku: {
    dir: 'rtl',
    langName: 'کوردی (Kurdî)',
    countryName: 'کوردستان (Kurdistan)',
    flag: '☀️',
    language: 'کوردی',
    adminRole: 'بەڕێوەبەر (Admin)',
    userRole: 'بەکارهێنەری ئاسایی',

    streakBadge: 'ڕۆژانی بەردەوامی',
    adminSupport: 'پەیوەندیمان پێوە بکە',
    notificationsTitle: 'ئاگاداری و پەیامەکان',
    newBadge: '2 نوێ',
    notif1Title: 'چالاککردنی بەخۆڕایی تەواو',
    notif1Text: 'دەتوانیت یەکەم جار بەبێ سنوور بەکاری بهێنیت، دواتر سەیری 3 ڕیکلام بکە یان VIP بکڕە.',
    notif2Title: 'خەڵاتی 30 ڕۆژە',
    notif2Text: 'هەموو ڕۆژێک بۆ ماوەی مانگێک بەرنامەکە بەکاربهێنە و 7 ڕۆژ VIP بێ ڕیکلام بەدەستبهێنە!',
    installApp: 'دابەزاندنی بەرنامە',
    darkMode: 'دۆخی تاریک',
    lightMode: 'دۆخی ڕووناک',

    home: 'سەرەکی',
    profile: 'پرۆفایلی من',
    adminManagement: 'بەڕێوەبردنی بەرنامە',
    adminBadge: 'بەڕێوەبەر',
    myFiles: 'دۆسیە و بەڵگەنامەکانم',
    users: 'بەکارهێنەران',
    subscriptions: 'بەشداریکردنەکان',
    settings: 'ڕێکخستنەکان',
    logout: 'چوونەدەرەوە',
    vipUser: 'بەکارهێنەری VIP',
    vipPerks: 'چێژ لە هەموو تایبەتمەندییەکان وەربگرە بەبێ سنوور',

    welcomeTitle: 'بەخێربێن بۆ Meta.Ny',
    welcomeSubtitle: 'شوێنی زیرەکت بۆ بەڵگەنامەکان، وەرگێڕان، پرسیارەکان، دەنگ و توێژینەوە.',
    vipStatus: 'بەشداری VIP',
    activeUntil: 'چالاکە تا: 2026/12/31',

    serviceTranslate: 'وەرگێڕانی فرەزمان',
    serviceQuestions: 'دروستکردنی پرسیار و وەڵام',
    serviceConvert: 'گۆڕینی دۆسیە و بەڵگەنامەکان',
    serviceVoice: 'گۆڕینی دەنگ بۆ دەق یان دەنگ',
    serviceImage: 'دەستکاریکردنی وێنە و OCR',
    serviceResearch: 'نووسینی توێژینەوە و ڕاپۆرت',

    uploadTitle: 'دۆسیە یان بەڵگەنامەکانت لێرە باربکە',
    uploadSubtitle: 'پشتیوانی لە پەڕتووک و دۆسیەی گەورە تا زیاتر لە 200 لاپەڕە (PDF, Word, Excel, PPTX, TXT, وێنە, دەنگ)',
    largeFilesBadge: 'پشتیوانی لە پەڕتووکی گەورە +200 لاپەڕە',
    chooseFiles: 'هەڵبژاردنی دۆسیەکان',
    uploadingDoc: 'زیرەکی دەستکرد خەریکی خوێندنەوەی بەڵگەنامە و لاپەڕەکانە...',
    readyForProcessing: 'ئامادەیە بۆ پرۆسێسکردنی زیرەک و ئەکادیمی',
    pagesCountLabel: 'لاپەڕە',
    clearFile: 'سڕینەوەی دۆسیە',
    quickResearch: 'نووسینی توێژینەوە',
    quickSolve: 'شیکاری پرسیارەکان',
    quickQuestions: 'دروستکردنی پرسیار',
    quickTranslate: 'وەرگێڕانی خێرا',
    featureAcademicTitle: 'نووسینی توێژینەوە و ڕاپۆرت بە شێوەیەکی پرۆفیشناڵ',
    featureAcademicDesc: 'دروستکردنی توێژینەوەی زانکۆ و قوتابخانە و ڕاپۆرتی کار بە سەرچاوە و پێڕستەوە',
    startNow: 'ئێستا دەستپێبکە',


    translationOptionsTitle: 'هەڵبژاردنەکانی وەرگێڕان',
    singleLanguage: 'یەک زمان',
    dualLanguage: 'دوو زمان (هاوتەریب)',
    extractedLangLabel: 'زمانی مەبەست',
    typeOrPastePlaceholder: 'دەق لێرە بنووسە یان بیلکێنە، یان دۆسیەیەک لە بۆکسەکەی تر باربکە...',
    translateBtn: 'وەرگێڕانی دەق',
    translatingBtn: 'وەرگێڕان لە پرۆسەدایە...',

    bottomNoticeText: 'دەتوانیت ئێستا بەرنامەکە بەخۆڕایی یەکجار بەکاربهێنیت، پاشان سەیری 3 ڕیکلام بکە یان بەشداری VIP بکە.',
    viewPlansBtn: 'بینینی بەستەکان',

    offlineBannerText: 'تۆ لە دۆخی دابڕاو لە ئینتەرنێتیت - دەتوانیت دۆسیە پارێزراوەکانت بەکاربهێنیت',
    offlineSavedFilesBtn: 'دۆسیە پارێزراوەکانم',

    copy: 'کۆپیکردن',
    copied: 'کۆپیکرا!',
    download: 'دابەزاندن',
    close: 'داخستن',
    cancel: 'پاشگەزبوونەوە',
    save: 'پاشەکەوتکردن',
    loading: 'بارکردن...',
    error: 'هەڵەیەک ڕوویدا',
    ...extraEnDefaults,
  },

  fr: {
    dir: 'ltr',
    langName: 'Français',
    countryName: 'France / Francophonie',
    flag: '🇫🇷',
    language: 'Français',
    adminRole: 'Mode Admin',
    userRole: 'Utilisateur standard',
    streakBadge: 'Série de fidélité',
    adminSupport: 'Nous contacter',
    notificationsTitle: 'Notifications et alertes',
    newBadge: '2 nouveaux',
    notif1Title: 'Accès gratuit complet',
    notif1Text: 'Vous pouvez utiliser l’application une fois gratuitement, puis regarder 3 publicités ou passer à VIP.',
    notif2Title: 'Récompense 30 jours',
    notif2Text: 'Utilisez l’application quotidiennement pendant un mois et recevez 7 jours de VIP gratuit sans aucune publicité !',
    installApp: 'Installer l’application',
    darkMode: 'Mode sombre',
    lightMode: 'Mode clair',

    home: 'Accueil',
    profile: 'Mon profil',
    adminManagement: 'Gestion de l’application',
    adminBadge: 'Admin',
    myFiles: 'Mes fichiers et documents',
    users: 'Utilisateurs',
    subscriptions: 'Abonnements',
    settings: 'Paramètres',
    logout: 'Déconnexion',
    vipUser: 'Utilisateur VIP',
    vipPerks: 'Profitez de toutes les fonctionnalités sans limites',

    welcomeTitle: 'Bienvenue sur Meta.Ny',
    welcomeSubtitle: 'Votre espace intelligent pour les documents, la traduction, les questions, la voix et la recherche.',
    vipStatus: 'Abonnement VIP',
    activeUntil: 'Actif jusqu’au : 2026/12/31',

    serviceTranslate: 'Traduction multilingue',
    serviceQuestions: 'Génération Questions & Réponses',
    serviceConvert: 'Convertisseur de fichiers',
    serviceVoice: 'Voix vers texte / Texte vers voix',
    serviceImage: 'Édition d’images & OCR',
    serviceResearch: 'Recherche académique & Rapports',

    uploadTitle: 'Téléversez vos fichiers ou documents ici',
    uploadSubtitle: 'Prend en charge les fichiers et livres volumineux jusqu’à plus de 200 pages (PDF, Word, Excel, PPTX, TXT, Images, Audio)',
    largeFilesBadge: 'Supporte les livres +200 pages',
    chooseFiles: 'Choisir des fichiers',
    uploadingDoc: 'L’IA extrait le texte et le contenu du document...',
    readyForProcessing: 'Prêt pour le traitement intelligent',
    pagesCountLabel: 'pages',
    clearFile: 'Effacer le fichier',
    quickResearch: 'Rédiger une recherche',
    quickSolve: 'Résoudre le document',
    quickQuestions: 'Générer un quiz',
    quickTranslate: 'Traduction instantanée',
    featureAcademicTitle: 'Rédaction académique & rapports professionnels',
    featureAcademicDesc: 'Créez des mémoires et thèses universitaires complets avec bibliographie et index',
    startNow: 'Commencer maintenant',

    translationOptionsTitle: 'Options de traduction',
    singleLanguage: 'Langue unique',
    dualLanguage: 'Bilingue côte à côte',
    extractedLangLabel: 'Langue cible',
    typeOrPastePlaceholder: 'Tapez ou collez du texte ici, ou déposez un fichier à côté...',
    translateBtn: 'Traduire le texte',
    translatingBtn: 'Traduction en cours...',

    bottomNoticeText: 'Vous pouvez utiliser l’application gratuitement une fois, puis regarder 3 publicités ou vous abonner à VIP.',
    viewPlansBtn: 'Voir les forfaits',

    offlineBannerText: 'Vous êtes hors ligne — Accédez à vos fichiers enregistrés localement',
    offlineSavedFilesBtn: 'Fichiers enregistrés',

    copy: 'Copier',
    copied: 'Copié !',
    download: 'Télécharger',
    close: 'Fermer',
    cancel: 'Annuler',
    save: 'Enregistrer',
    loading: 'Chargement...',
    error: 'Une erreur s’est produite',
    ...extraEnDefaults,
  },

  es: {
    dir: 'ltr',
    langName: 'Español',
    countryName: 'España / Latinoamérica',
    flag: '🇪🇸',
    language: 'Español',
    adminRole: 'Modo Admin',
    userRole: 'Usuario estándar',
    streakBadge: 'Racha de fidelidad',
    adminSupport: 'Contáctanos',
    notificationsTitle: 'Notificaciones y avisos',
    newBadge: '2 nuevos',
    notif1Title: 'Acceso gratuito total',
    notif1Text: 'Puedes usar la app una vez gratis sin límites, luego mira 3 anuncios o suscríbete a VIP.',
    notif2Title: 'Recompensa 30 días',
    notif2Text: '¡Usa la aplicación a diario durante un mes y recibe 7 días de VIP gratis sin anuncios!',
    installApp: 'Instalar aplicación',
    darkMode: 'Modo oscuro',
    lightMode: 'Modo claro',

    home: 'Inicio',
    profile: 'Mi perfil',
    adminManagement: 'Gestión de la app',
    adminBadge: 'Admin',
    myFiles: 'Mis archivos y documentos',
    users: 'Usuarios',
    subscriptions: 'Suscripciones',
    settings: 'Ajustes',
    logout: 'Cerrar sesión',
    vipUser: 'Usuario VIP',
    vipPerks: 'Disfruta de todas las funciones premium sin límites',

    welcomeTitle: 'Bienvenido a Meta.Ny',
    welcomeSubtitle: 'Tu espacio inteligente para documentos, traducción, preguntas, voz e investigación.',
    vipStatus: 'Suscripción VIP',
    activeUntil: 'Activo hasta: 2026/12/31',

    serviceTranslate: 'Traducción multilingüe',
    serviceQuestions: 'Generador de preguntas y respuestas',
    serviceConvert: 'Conversor de archivos',
    serviceVoice: 'Voz a texto / Texto a voz',
    serviceImage: 'Edición de imágenes y OCR',
    serviceResearch: 'Investigación académica y reportes',

    uploadTitle: 'Sube tus archivos o documentos aquí',
    uploadSubtitle: 'Soporta libros y documentos grandes de más de 200 páginas (PDF, Word, Excel, PPTX, TXT, Imágenes, Audio)',
    largeFilesBadge: 'Soporta libros +200 páginas',
    chooseFiles: 'Elegir archivos',
    uploadingDoc: 'La IA está extrayendo el contenido del documento...',
    readyForProcessing: 'Listo para procesamiento inteligente',
    pagesCountLabel: 'páginas',
    clearFile: 'Quitar archivo',
    quickResearch: 'Escribir tesis',
    quickSolve: 'Resolver documento',
    quickQuestions: 'Crear cuestionario',
    quickTranslate: 'Traducción instantánea',
    featureAcademicTitle: 'Redacción académica y reportes profesionales',
    featureAcademicDesc: 'Crea investigaciones universitarias completas con citas bibliográficas e índice',
    startNow: 'Empezar ahora',

    translationOptionsTitle: 'Opciones de traducción',
    singleLanguage: 'Idioma único',
    dualLanguage: 'Bilingüe dual',
    extractedLangLabel: 'Idioma destino',
    typeOrPastePlaceholder: 'Escribe o pega texto aquí, o sube un archivo...',
    translateBtn: 'Traducir texto',
    translatingBtn: 'Traduciendo...',

    bottomNoticeText: 'Puedes usar la app gratis una vez, y después ver 3 anuncios o suscribirte a VIP.',
    viewPlansBtn: 'Ver planes',

    offlineBannerText: 'Estás sin conexión — Puedes acceder a tus archivos guardados',
    offlineSavedFilesBtn: 'Mis archivos guardados',

    copy: 'Copiar',
    copied: '¡Copiado!',
    download: 'Descargar',
    close: 'Cerrar',
    cancel: 'Cancelar',
    save: 'Guardar',
    loading: 'Cargando...',
    error: 'Ocurrió un error',
    ...extraEnDefaults,
  },

  tr: {
    dir: 'ltr',
    langName: 'Türkçe',
    countryName: 'Türkiye',
    flag: '🇹🇷',
    language: 'Türkçe',
    adminRole: 'Yönetici Modu',
    userRole: 'Standart Kullanıcı',
    streakBadge: 'Sadakat Serisi',
    adminSupport: 'Bize Ulaşın',
    notificationsTitle: 'Bildirimler',
    newBadge: '2 yeni',
    notif1Title: 'Tam Ücretsiz Erişim',
    notif1Text: 'Uygulamayı ilk seferde ücretsiz kullanabilir, ardından 3 reklam izleyebilir veya VIP alabilirsiniz.',
    notif2Title: '30 Gün Ödülü',
    notif2Text: 'Uygulamayı bir ay boyunca her gün kullanın ve 7 gün reklamsız ücretsiz VIP kazanın!',
    installApp: 'Uygulamayı Yükle',
    darkMode: 'Karanlık Mod',
    lightMode: 'Aydınlık Mod',

    home: 'Ana Sayfa',
    profile: 'Profilim',
    adminManagement: 'Uygulama Yönetimi',
    adminBadge: 'Yönetici',
    myFiles: 'Dosyalarım ve Belgelerim',
    users: 'Kullanıcılar',
    subscriptions: 'Abonelikler',
    settings: 'Ayarlar',
    logout: 'Çıkış Yap',
    vipUser: 'VIP Kullanıcı',
    vipPerks: 'Tüm premium özelliklerin tadını sınırsız çıkarın',

    welcomeTitle: "Meta.Ny'ye Hoş Geldiniz",
    welcomeSubtitle: 'Belgeler, çeviri, sorular, ses ve akademik araştırma için akıllı çalışma alanınız.',
    vipStatus: 'VIP Abonelik',
    activeUntil: 'Bitiş tarihi: 2026/12/31',

    serviceTranslate: 'Çok Dilli Çeviri',
    serviceQuestions: 'Soru & Cevap Üretici',
    serviceConvert: 'Dosya ve Belge Dönüştürücü',
    serviceVoice: 'Sesten Metne / Metinden Sese',
    serviceImage: 'Görsel Düzenleme & OCR',
    serviceResearch: 'Akademik Araştırma & Raporlar',

    uploadTitle: 'Dosyalarınızı veya belgelerinizi buraya yükleyin',
    uploadSubtitle: '200+ sayfaya kadar büyük kitapları ve dosyaları destekler (PDF, Word, Excel, PPTX, TXT, Görsel, Ses)',
    largeFilesBadge: '200+ sayfa kitap desteği',
    chooseFiles: 'Dosya Seç',
    uploadingDoc: 'Yapay zeka belge metnini ve sayfaları çıkarıyor...',
    readyForProcessing: 'Akıllı işleme hazır',
    pagesCountLabel: 'sayfa',
    clearFile: 'Dosyayı Temizle',
    quickResearch: 'Araştırma Yaz',
    quickSolve: 'Belgeyi Çöz',
    quickQuestions: 'Test Oluştur',
    quickTranslate: 'Anında Çevir',
    featureAcademicTitle: 'Profesyonel Araştırma ve Rapor Yazımı',
    featureAcademicDesc: 'Kaynakça ve fihrist ile eksiksiz üniversite ve okul araştırmaları hazırlayın',
    startNow: 'Şimdi Başla',

    translationOptionsTitle: 'Çeviri Seçenekleri',
    singleLanguage: 'Tek Dil',
    dualLanguage: 'Çift Dilli Yan Yana',
    extractedLangLabel: 'Hedef Dil',
    typeOrPastePlaceholder: 'Buraya metin yazın veya yapıştırın, ya da yandaki kutuya dosya yükleyin...',
    translateBtn: 'Metni Çevir',
    translatingBtn: 'Çevriliyor...',

    bottomNoticeText: 'Uygulamayı bir kez ücretsiz kullanabilir, ardından 3 reklam izleyebilir veya VIP olabilirsiniz.',
    viewPlansBtn: 'Planları Gör',

    offlineBannerText: 'Çevrimdışısınız — Kaydedilmiş yerel dosyalarınıza erişebilirsiniz',
    offlineSavedFilesBtn: 'Kayıtlı Dosyalarım',

    copy: 'Kopyala',
    copied: 'Kopyalandı!',
    download: 'İndir',
    close: 'Kapat',
    cancel: 'İptal',
    save: 'Kaydet',
    loading: 'Yükleniyor...',
    error: 'Bir hata oluştu',
    ...extraEnDefaults,
  },

  de: {
    dir: 'ltr',
    langName: 'Deutsch',
    countryName: 'Deutschland / Österreich / Schweiz',
    flag: '🇩🇪',
    language: 'Deutsch',
    adminRole: 'Admin-Modus',
    userRole: 'Standard-Benutzer',
    streakBadge: 'Treuesträhne',
    adminSupport: 'Kontakt',
    notificationsTitle: 'Benachrichtigungen',
    newBadge: '2 Neu',
    notif1Title: 'Vollständiger kostenloser Zugang',
    notif1Text: 'Sie können die App einmal kostenlos ohne Limits nutzen, danach 3 Werbungen ansehen oder auf VIP upgraden.',
    notif2Title: '30-Tage-Belohnung',
    notif2Text: 'Nutzen Sie die App täglich einen Monat lang und erhalten Sie 7 Tage kostenloses VIP ohne Werbung!',
    installApp: 'App installieren',
    darkMode: 'Dunkelmodus',
    lightMode: 'Hellmodus',

    home: 'Startseite',
    profile: 'Mein Profil',
    adminManagement: 'App-Verwaltung',
    adminBadge: 'Admin',
    myFiles: 'Meine Dateien & Dokumente',
    users: 'Benutzer',
    subscriptions: 'Abonnements',
    settings: 'Einstellungen',
    logout: 'Abmelden',
    vipUser: 'VIP-Benutzer',
    vipPerks: 'Genießen Sie alle Premium-Funktionen ohne Einschränkungen',

    welcomeTitle: 'Willkommen bei Meta.Ny',
    welcomeSubtitle: 'Ihr smarter Arbeitsbereich für Dokumente, Übersetzung, Fragen, Audio und Forschung.',
    vipStatus: 'VIP-Abonnement',
    activeUntil: 'Aktiv bis: 2026/12/31',

    serviceTranslate: 'Mehrsprachige Übersetzung',
    serviceQuestions: 'Fragen & Antworten Generator',
    serviceConvert: 'Datei- & Dokumenten-Konverter',
    serviceVoice: 'Sprache zu Text / Text zu Sprache',
    serviceImage: 'Bildbearbeitung & OCR',
    serviceResearch: 'Akademische Forschung & Berichte',

    uploadTitle: 'Laden Sie Ihre Dateien oder Dokumente hier hoch',
    uploadSubtitle: 'Unterstützt große Dateien und Bücher über 200 Seiten (PDF, Word, Excel, PPTX, TXT, Bilder, Audio)',
    largeFilesBadge: 'Unterstützt 200+ Seiten Bücher',
    chooseFiles: 'Dateien auswählen',
    uploadingDoc: 'KI extrahiert Dokumententext und Seiten...',
    readyForProcessing: 'Bereit für intelligente Verarbeitung',
    pagesCountLabel: 'Seiten',
    clearFile: 'Datei löschen',
    quickResearch: 'Forschung verfassen',
    quickSolve: 'Dokument lösen',
    quickQuestions: 'Quiz generieren',
    quickTranslate: 'Sofort übersetzen',
    featureAcademicTitle: 'Professionelles Verfassen von Berichten & Forschung',
    featureAcademicDesc: 'Erstellen Sie komplette wissenschaftliche Arbeiten mit Literaturverzeichnis und Index',
    startNow: 'Jetzt starten',

    translationOptionsTitle: 'Übersetzungsoptionen',
    singleLanguage: 'Einzelsprache',
    dualLanguage: 'Zweisprachig nebeneinander',
    extractedLangLabel: 'Zielsprache',
    typeOrPastePlaceholder: 'Text hier eingeben oder einfügen, oder eine Datei daneben hochladen...',
    translateBtn: 'Text übersetzen',
    translatingBtn: 'Übersetzung läuft...',

    bottomNoticeText: 'Sie können die App einmal kostenlos nutzen, danach 3 Werbungen ansehen oder VIP abonnieren.',
    viewPlansBtn: 'Pläne ansehen',

    offlineBannerText: 'Sie sind offline — Zugriff auf lokal gespeicherte Dateien möglich',
    offlineSavedFilesBtn: 'Gespeicherte Dateien',

    copy: 'Kopieren',
    copied: 'Kopiert!',
    download: 'Herunterladen',
    close: 'Schließen',
    cancel: 'Abbrechen',
    save: 'Speichern',
    loading: 'Lädt...',
    error: 'Ein Fehler ist aufgetreten',
    ...extraEnDefaults,
  },

  fa: {
    dir: 'rtl',
    langName: 'فارسی (Persian)',
    countryName: 'ایران / افغانستان',
    flag: '🇮🇷',
    language: 'فارسی',
    adminRole: 'حالت مدیر',
    userRole: 'کاربر عادی',
    streakBadge: 'روزهای وفاداری',
    adminSupport: 'تماس با ما',
    notificationsTitle: 'اعلان‌ها و پیام‌ها',
    newBadge: '۲ جدید',
    notif1Title: 'دسترسی کاملاً رایگان',
    notif1Text: 'می‌توانید یک بار به صورت رایگان و نامحدود استفاده کنید، سپس ۳ تبلیغ ببینید یا VIP تهیه کنید.',
    notif2Title: 'پاداش ۳۰ روزه',
    notif2Text: 'یک ماه هر روز از برنامه استفاده کنید و ۷ روز VIP رایگان و بدون تبلیغات هدیه بگیرید!',
    installApp: 'نصب برنامه',
    darkMode: 'حالت تاریک',
    lightMode: 'حالت روشن',

    home: 'صفحه اصلی',
    profile: 'پروفایل من',
    adminManagement: 'مدیریت برنامه',
    adminBadge: 'مدیر',
    myFiles: 'فایل‌ها و اسناد من',
    users: 'کاربران',
    subscriptions: 'اشتراک‌ها',
    settings: 'تنظیمات',
    logout: 'خروج از حساب',
    vipUser: 'کاربر VIP',
    vipPerks: 'لذت بردن از تمامی امکانات بدون هیچ‌گونه محدودیت',

    welcomeTitle: 'به Meta.Ny خوش آمدید',
    welcomeSubtitle: 'فضای هوشمند شما برای اسناد، ترجمه، سوالات، صوت و پژوهش‌های علمی.',
    vipStatus: 'اشتراک VIP',
    activeUntil: 'فعال تا: ۲۰۲۶/۱۲/۳۱',

    serviceTranslate: 'ترجمه چندزبانه',
    serviceQuestions: 'تولید سوال و پاسخ',
    serviceConvert: 'تبدیل اسناد و فایل‌ها',
    serviceVoice: 'تبدیل صوت به متن / متن به صوت',
    serviceImage: 'ویرایش تصویر و OCR',
    serviceResearch: 'نگارش مقالات و گزارش‌های علمی',

    uploadTitle: 'فایل‌ها یا اسناد خود را اینجا بارگذاری کنید',
    uploadSubtitle: 'پشتیبانی از کتاب‌ها و فایل‌های حجیم بیش از ۲۰۰ صفحه (PDF، Word، Excel، PPTX، TXT، عکس، صوت)',
    largeFilesBadge: 'پشتیبانی از کتاب‌های ۲۰۰+ صفحه',
    chooseFiles: 'انتخاب فایل‌ها',
    uploadingDoc: 'هوش مصنوعی در حال استخراج متن و صفحات سند است...',
    readyForProcessing: 'آماده پردازش هوشمند و علمی',
    pagesCountLabel: 'صفحه',
    clearFile: 'حذف فایل',
    quickResearch: 'نگارش پژوهش',
    quickSolve: 'حل سوالات سند',
    quickQuestions: 'تولید آزمون',
    quickTranslate: 'ترجمه فوری',
    featureAcademicTitle: 'نگارش گزارش‌ها و پژوهش‌ها به صورت حرفه‌ای',
    featureAcademicDesc: 'ایجاد مقالات کامل دانشگاهی و مدرسه‌ای همراه با فهرست و مراجع علمی معتبر',
    startNow: 'شروع کنید',

    translationOptionsTitle: 'گزینه‌های ترجمه',
    singleLanguage: 'یک زبانه',
    dualLanguage: 'دوزبانه موازی',
    extractedLangLabel: 'زبان مقصد',
    typeOrPastePlaceholder: 'متن را اینجا بنویسید یا الصاق کنید، یا فایلی در کادر مقابل بارگذاری نمایید...',
    translateBtn: 'ترجمه متن',
    translatingBtn: 'در حال ترجمه...',

    bottomNoticeText: 'اکنون می‌توانید یک بار رایگان از برنامه استفاده کنید، سپس ۳ تبلیغ تماشا کنید یا VIP شوید.',
    viewPlansBtn: 'مشاهده پلن‌ها',

    offlineBannerText: 'شما در حالت آفلاین هستید — به فایل‌های ذخیره شده محلی دسترسی دارید',
    offlineSavedFilesBtn: 'فایل‌های ذخیره شده من',

    copy: 'کپی',
    copied: 'کپی شد!',
    download: 'دانلود',
    close: 'بستن',
    cancel: 'انصراف',
    save: 'ذخیره',
    loading: 'در حال بارگذاری...',
    error: 'خطایی رخ داد',
    ...extraEnDefaults,
  },
};

