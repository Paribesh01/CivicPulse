/// Bilingual strings for every citizen-facing surface.
///
/// Hindi is written the way people actually speak it rather than in formal
/// Sanskritised officialese — a citizen reporting a broken streetlight should
/// not need to parse government vocabulary. Widely-understood English words
/// ("SLA" is avoided entirely; "ward" is kept because it is what people say)
/// are left as-is instead of being forced into translations nobody uses.

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिंदी",
};

const en = {
  common: {
    appName: "CivicPulse",
    tagline: "Report a problem. Watch it get fixed.",
    signIn: "Sign in",
    signUp: "Create account",
    signOut: "Sign out",
    reportIssue: "Report a problem",
    track: "Track",
    dashboard: "Dashboard",
    myComplaints: "My complaints",
    back: "Back",
    next: "Next",
    submit: "Submit",
    cancel: "Cancel",
    loading: "Please wait…",
    required: "Required",
    optional: "Optional",
    points: "points",
    language: "Language",
  },

  home: {
    heroTitle: "Report a problem in your area",
    heroBody:
      "Take a photo, say what is wrong, and we will send it to the right department with a deadline. You can watch every step.",
    ctaReport: "Report a problem",
    ctaTrack: "Check my complaint",
    officerSignIn: "Staff sign in",
    howItWorks: "How it works",
    step1Title: "Take a photo",
    step1Body: "A picture shows the officer exactly what the problem is.",
    step2Title: "Say what is wrong",
    step2Body: "In Hindi or English. Just normal words, no forms to fill.",
    step3Title: "We send it to the right office",
    step3Body: "The correct department gets it in seconds, with a deadline.",
    step4Title: "You watch the clock",
    step4Body: "If they miss the deadline, their senior is told automatically.",
    liveTitle: "Right now",
    statComplaints: "Complaints",
    statOpen: "Being fixed",
    statOverdue: "Late",
    statOnTime: "Fixed on time",
    statAvg: "Average time to fix",
    trustTitle: "Why your complaint will not disappear",
    trustBody:
      "Every complaint gets a deadline the moment it is assigned. If it is missed, the system tells the officer's senior on its own — nobody has to chase it.",
  },

  auth: {
    loginTitle: "Sign in",
    loginBody: "Sign in to report a problem and follow what happens to it.",
    signupTitle: "Create your account",
    signupBody:
      "We ask who you are so that fake complaints can be stopped. Your name is never shown publicly.",
    name: "Your name",
    email: "Email",
    phone: "Mobile number",
    password: "Password",
    passwordHint: "At least 8 characters",
    noAccount: "New here?",
    haveAccount: "Already have an account?",
    createOne: "Create an account",
    privacyNote:
      "Officers see your name so they can contact you about the repair. It is never shown on public pages.",
    demoTitle: "Demo logins",
    demoBody: "Every demo account uses the password",
  },

  report: {
    title: "Report a problem",
    mustSignIn: "Please sign in first so we know the complaint is genuine.",

    step: "Step",
    of: "of",

    photoTitle: "Take a photo of the problem",
    photoBody:
      "A photo helps the officer see how bad it is, and proves the problem is real.",
    photoButton: "Take photo or choose from gallery",
    photoChange: "Choose a different photo",
    photoUploading: "Uploading photo…",
    photoRequired: "A photo is needed to continue.",
    photoFailed: "Photo could not be uploaded. Please try again.",
    photoOptionalNotice:
      "Photo upload is not switched on yet, so you can continue without one.",

    describeTitle: "What is the problem?",
    describeBody: "Write in Hindi or English, however you would say it out loud.",
    describePlaceholder:
      "The streetlight outside the school has not worked for 5 days",
    describeHint:
      "Helpful: how long it has been like this, and the nearest landmark.",
    describeTooShort: "Please write a little more so we understand the problem.",

    locationTitle: "Where is it?",
    locationBody: "This helps us find the officer for your area.",
    locationPlaceholder: "Street, landmark or area name",
    useMyLocation: "Use my current location",
    locationCaptured: "Location added",
    locationFailed: "Could not get your location. You can type it instead.",

    analysing: "Reading your complaint…",
    analysingBody: "Working out which department should fix this.",

    reviewTitle: "Please check this is right",
    reviewBody: "This is what we understood. Change anything that is wrong.",
    understoodProblem: "Problem",
    understoodDepartment: "Goes to",
    understoodLocation: "Area",
    understoodUrgency: "Urgency",
    understoodDeadline: "Deadline",
    confirmAndSubmit: "Yes, send this complaint",
    somethingWrong: "Something is wrong — let me edit",

    followUpTitle: "One more thing",

    doneTitle: "Complaint registered",
    doneBody: "Keep this number. You can check the status any time.",
    doneAssigned: "It has gone to",
    doneDeadline: "They must fix it by",
    pointsEarned: "You earned",
    trackThis: "Track this complaint",
    reportAnother: "Report another problem",
  },

  urgency: {
    CRITICAL: "Emergency",
    HIGH: "Urgent",
    MEDIUM: "Normal",
    LOW: "Low",
  },

  status: {
    SUBMITTED: "Received",
    TRIAGED: "Waiting for an officer",
    ASSIGNED: "With an officer",
    IN_PROGRESS: "Work started",
    RESOLVED: "Fixed",
    CLOSED: "Closed",
    REJECTED: "Not accepted",
    DUPLICATE: "Same as another complaint",
  },

  track: {
    title: "Track a complaint",
    body: "Enter the complaint number you were given.",
    placeholder: "CP-10432",
    lookUp: "Show me",
    notFound: "We could not find that complaint number.",
    deadline: "Deadline",
    timeLeft: "Time left",
    overdue: "Late by",
    goesTo: "Department",
    area: "Area",
    officer: "Officer",
    whatHappened: "What has happened so far",
    resolution: "What they did",
    stillBroken: "Still not fixed? Sign in and reopen it.",
  },

  rewards: {
    title: "Your points",
    body: "You earn points for reporting real problems and seeing them through.",
    tier: "Level",
    nextTier: "points to",
    history: "How you earned them",
    COMPLAINT_FILED: "Reported a problem",
    COMPLAINT_RESOLVED: "Your report got fixed",
    COMPLAINT_CONFIRMED: "You confirmed the repair",
    COMPLAINT_REJECTED: "Complaint was not genuine",
  },

  tiers: {
    NAGRIK: "Citizen",
    JAGRIK: "Active citizen",
    PRAHARI: "Area watchman",
    CHAMPION: "Civic champion",
  },

  dashboard: {
    citizenTitle: "My complaints",
    citizenEmpty: "You have not reported anything yet.",
    citizenEmptyCta: "Report your first problem",
    open: "Being fixed",
    closed: "Finished",
    filedOn: "Reported on",
  },
};

/// Same shape as `en`, enforced by the type below — a missing key is a
/// compile error rather than a blank space on the page.
const hi: typeof en = {
  common: {
    appName: "सिविकपल्स",
    tagline: "शिकायत दर्ज करें। ठीक होते हुए देखें।",
    signIn: "लॉगिन करें",
    signUp: "खाता बनाएं",
    signOut: "लॉगआउट",
    reportIssue: "शिकायत दर्ज करें",
    track: "स्थिति देखें",
    dashboard: "डैशबोर्ड",
    myComplaints: "मेरी शिकायतें",
    back: "पीछे",
    next: "आगे",
    submit: "भेजें",
    cancel: "रद्द करें",
    loading: "कृपया रुकें…",
    required: "ज़रूरी",
    optional: "वैकल्पिक",
    points: "अंक",
    language: "भाषा",
  },

  home: {
    heroTitle: "अपने इलाके की समस्या बताएं",
    heroBody:
      "फोटो खींचें, समस्या बताएं — हम इसे सही विभाग तक समय-सीमा के साथ भेज देंगे। आप हर कदम देख सकते हैं।",
    ctaReport: "शिकायत दर्ज करें",
    ctaTrack: "मेरी शिकायत देखें",
    officerSignIn: "कर्मचारी लॉगिन",
    howItWorks: "यह कैसे काम करता है",
    step1Title: "फोटो खींचें",
    step1Body: "फोटो से अधिकारी को समस्या साफ़ दिखती है।",
    step2Title: "समस्या बताएं",
    step2Body: "हिंदी या अंग्रेज़ी में। आम बोलचाल में, कोई फॉर्म नहीं।",
    step3Title: "सही दफ़्तर तक पहुंचाते हैं",
    step3Body: "कुछ ही सेकंड में सही विभाग को, समय-सीमा के साथ।",
    step4Title: "आप समय देखते रहें",
    step4Body: "समय-सीमा टूटी तो उनके अफ़सर को अपने आप ख़बर हो जाती है।",
    liveTitle: "अभी की स्थिति",
    statComplaints: "कुल शिकायतें",
    statOpen: "काम चल रहा है",
    statOverdue: "देर हो चुकी",
    statOnTime: "समय पर ठीक हुईं",
    statAvg: "ठीक होने में औसत समय",
    trustTitle: "आपकी शिकायत ग़ायब नहीं होगी",
    trustBody:
      "हर शिकायत को अधिकारी मिलते ही समय-सीमा मिल जाती है। समय निकल गया तो सिस्टम ख़ुद उनके अफ़सर को बता देता है — किसी को पीछे पड़ने की ज़रूरत नहीं।",
  },

  auth: {
    loginTitle: "लॉगिन करें",
    loginBody: "शिकायत दर्ज करने और उसकी स्थिति देखने के लिए लॉगिन करें।",
    signupTitle: "अपना खाता बनाएं",
    signupBody:
      "फ़र्ज़ी शिकायतें रोकने के लिए हम आपकी पहचान पूछते हैं। आपका नाम सार्वजनिक कभी नहीं दिखाया जाता।",
    name: "आपका नाम",
    email: "ईमेल",
    phone: "मोबाइल नंबर",
    password: "पासवर्ड",
    passwordHint: "कम से कम 8 अक्षर",
    noAccount: "नए हैं?",
    haveAccount: "पहले से खाता है?",
    createOne: "खाता बनाएं",
    privacyNote:
      "मरम्मत के बारे में संपर्क करने के लिए अधिकारी आपका नाम देख सकते हैं। सार्वजनिक पेज पर यह कभी नहीं दिखता।",
    demoTitle: "डेमो लॉगिन",
    demoBody: "सभी डेमो खातों का पासवर्ड है",
  },

  report: {
    title: "शिकायत दर्ज करें",
    mustSignIn: "पहले लॉगिन करें ताकि हमें पता रहे कि शिकायत असली है।",

    step: "चरण",
    of: "में से",

    photoTitle: "समस्या की फोटो खींचें",
    photoBody:
      "फोटो से अधिकारी को समस्या की गंभीरता दिखती है और यह भी कि समस्या सच में है।",
    photoButton: "फोटो खींचें या गैलरी से चुनें",
    photoChange: "दूसरी फोटो चुनें",
    photoUploading: "फोटो भेजी जा रही है…",
    photoRequired: "आगे बढ़ने के लिए फोटो ज़रूरी है।",
    photoFailed: "फोटो नहीं भेजी जा सकी। दोबारा कोशिश करें।",
    photoOptionalNotice:
      "फोटो सुविधा अभी चालू नहीं है, इसलिए आप बिना फोटो के आगे बढ़ सकते हैं।",

    describeTitle: "समस्या क्या है?",
    describeBody: "हिंदी या अंग्रेज़ी में लिखें, जैसे आप बोलकर बताते।",
    describePlaceholder: "स्कूल के बाहर वाली स्ट्रीट लाइट 5 दिन से ख़राब है",
    describeHint: "यह बताना अच्छा रहेगा: कितने दिन से है, और पास की कोई पहचान।",
    describeTooShort: "थोड़ा और लिखें ताकि हम समस्या समझ सकें।",

    locationTitle: "यह कहां है?",
    locationBody: "इससे हमें आपके इलाके का अधिकारी ढूंढने में मदद मिलती है।",
    locationPlaceholder: "गली, पहचान या इलाके का नाम",
    useMyLocation: "मेरी अभी की जगह लें",
    locationCaptured: "जगह जुड़ गई",
    locationFailed: "आपकी जगह नहीं मिल सकी। आप ख़ुद लिख सकते हैं।",

    analysing: "आपकी शिकायत पढ़ी जा रही है…",
    analysingBody: "पता लगा रहे हैं कि इसे कौन सा विभाग ठीक करेगा।",

    reviewTitle: "देख लें कि सब सही है",
    reviewBody: "हमने यह समझा है। कुछ ग़लत हो तो बदल लें।",
    understoodProblem: "समस्या",
    understoodDepartment: "जाएगी",
    understoodLocation: "इलाका",
    understoodUrgency: "कितनी ज़रूरी",
    understoodDeadline: "समय-सीमा",
    confirmAndSubmit: "हां, शिकायत भेजें",
    somethingWrong: "कुछ ग़लत है — बदलना है",

    followUpTitle: "एक और बात",

    doneTitle: "शिकायत दर्ज हो गई",
    doneBody: "यह नंबर संभाल कर रखें। आप कभी भी स्थिति देख सकते हैं।",
    doneAssigned: "यह गई है",
    doneDeadline: "इन्हें ठीक करना है",
    pointsEarned: "आपको मिले",
    trackThis: "इस शिकायत की स्थिति देखें",
    reportAnother: "एक और शिकायत दर्ज करें",
  },

  urgency: {
    CRITICAL: "आपातकाल",
    HIGH: "बहुत ज़रूरी",
    MEDIUM: "सामान्य",
    LOW: "कम ज़रूरी",
  },

  status: {
    SUBMITTED: "मिल गई",
    TRIAGED: "अधिकारी का इंतज़ार",
    ASSIGNED: "अधिकारी के पास",
    IN_PROGRESS: "काम शुरू",
    RESOLVED: "ठीक हो गई",
    CLOSED: "बंद",
    REJECTED: "स्वीकार नहीं हुई",
    DUPLICATE: "पहले से दर्ज है",
  },

  track: {
    title: "शिकायत की स्थिति",
    body: "आपको मिला शिकायत नंबर डालें।",
    placeholder: "CP-10432",
    lookUp: "दिखाएं",
    notFound: "यह शिकायत नंबर नहीं मिला।",
    deadline: "समय-सीमा",
    timeLeft: "बचा समय",
    overdue: "देर हो चुकी",
    goesTo: "विभाग",
    area: "इलाका",
    officer: "अधिकारी",
    whatHappened: "अब तक क्या हुआ",
    resolution: "उन्होंने क्या किया",
    stillBroken: "अब भी ठीक नहीं हुआ? लॉगिन करके दोबारा खोलें।",
  },

  rewards: {
    title: "आपके अंक",
    body: "असली समस्याएं बताने और उन्हें अंजाम तक पहुंचाने पर अंक मिलते हैं।",
    tier: "स्तर",
    nextTier: "अंक और चाहिए",
    history: "अंक कैसे मिले",
    COMPLAINT_FILED: "समस्या दर्ज की",
    COMPLAINT_RESOLVED: "आपकी शिकायत ठीक हुई",
    COMPLAINT_CONFIRMED: "आपने मरम्मत की पुष्टि की",
    COMPLAINT_REJECTED: "शिकायत असली नहीं थी",
  },

  tiers: {
    NAGRIK: "नागरिक",
    JAGRIK: "जागरूक नागरिक",
    PRAHARI: "इलाका प्रहरी",
    CHAMPION: "सिविक चैंपियन",
  },

  dashboard: {
    citizenTitle: "मेरी शिकायतें",
    citizenEmpty: "आपने अभी तक कोई शिकायत दर्ज नहीं की।",
    citizenEmptyCta: "अपनी पहली शिकायत दर्ज करें",
    open: "काम चल रहा है",
    closed: "पूरी हुईं",
    filedOn: "दर्ज हुई",
  },
};

export const dictionaries = { en, hi } as const;
export type Dictionary = typeof en;
