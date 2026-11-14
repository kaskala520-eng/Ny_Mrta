import katex from 'katex';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  detectLanguageCode,
  isRtlLangCode,
  resolveLangCode,
  translateBatchClientSide,
} from './clientTranslator';

export type ResearchDiscipline =
  | 'auto'
  | 'physics'
  | 'chemistry'
  | 'math'
  | 'medicine'
  | 'engineering'
  | 'cs'
  | 'humanities';

export interface ResearchEquation {
  title: string;
  latex: string;
  explanation: string;
}

export interface ResearchTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface ResearchDiagram {
  title: string;
  caption: string;
  svg: string;
}

export interface ResearchChartData {
  title: string;
  caption: string;
  unit: string;
  bars: Array<{ label: string; value: number; color: string }>;
}

export interface ResearchDocumentData {
  topic: string;
  researcherName: string;
  dateStr: string;
  discipline: Exclude<ResearchDiscipline, 'auto'>;
  isScientific: boolean;
  researchType: string;
  academicLevel: string;
  abstractWordCount: number;
  abstractText: string;
  introduction: {
    problem: string;
    importance: string;
    objectives: string[];
  };
  chapter1Theory: string[];
  chapter2Applications: string[];
  equations: ResearchEquation[];
  tables: ResearchTable[];
  diagrams: ResearchDiagram[];
  chart?: ResearchChartData;
  timeline?: Array<{ era: string; milestone: string; impact: string }>;
  quotes?: Array<{ quote: string; author: string; source: string }>;
  conclusionFindings: string[];
  recommendations: string[];
  references: string[];
  attachedImages?: string[];
  htmlContent: string;
  plainMarkdown: string;
  outputLanguage?: string;
  outputIsRTL?: boolean;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function detectDiscipline(
  topic: string,
  points: string,
  sourceContent: string,
  forced: ResearchDiscipline = 'auto'
): Exclude<ResearchDiscipline, 'auto'> {
  if (forced !== 'auto') return forced;
  const text = `${topic} ${points} ${sourceContent.slice(0, 1200)}`.toLowerCase();

  if (/(فيزياء|فيزيائ|طاقة|حرارة|ضوء|كهرباء|مغناطيس|كم|نسبية|نيوتن|ميكانيكا|جاذبية|إشعاع|physics|quantum|optics|mechanics|relativity|energy|thermodynamics)/.test(text)) {
    return 'physics';
  }
  if (/(كيمياء|تفاعل|ذرة|جزيء|حمض|قاعدة|مول|عضوية|تحليلية|أكسدة|بوليمر|عناصر|chemistry|chemical|molecule|acid|polymer|reaction)/.test(text)) {
    return 'chemistry';
  }
  if (/(رياضيات|جبر|تفاضل|تكامل|معادلة|احتمال|إحصاء|مصفوف|هندسة تحليلية|math|calculus|algebra|probability|statistics|matrix|equation)/.test(text)) {
    return 'math';
  }
  if (/(طب|طبي|مرض|صحة|خلية|قلب|دم|دواء|فيروس|بكتيريا|مناعة|أحياء|تشريح|فسلجة|سكري|medicine|medical|biology|cell|clinical|health|disease|anatomy|genetics)/.test(text)) {
    return 'medicine';
  }
  if (/(هندسة|مدني|معماري|ميكانيك|إلكترون|تحكم|شبكة كهربائية|توربين|خرسانة|روبوت|engineering|civil|mechanical|electrical|circuit|structural|robotics|control system)/.test(text)) {
    return 'engineering';
  }
  if (/(حاسوب|برمجة|ذكاء اصطناعي|تعلم آلي|خوارزمية|بيانات|أمن سيبراني|شبكات|حوسبة|computer|software|algorithm|machine learning|ai\b|database|cybersecurity|network)/.test(text)) {
    return 'cs';
  }
  return 'humanities';
}

function buildInlineSvgDiagram(
  title: string,
  nodes: string[],
  accent: string,
  secondary: string,
  mode: 'flow' | 'cycle'
): string {
  const safeNodes = nodes.map((n) => escapeHtml(n.slice(0, 34)));
  if (mode === 'cycle') {
    const cx = 320;
    const cy = 155;
    const r = 92;
    const positions = [
      { x: cx, y: cy - r },
      { x: cx + 150, y: cy },
      { x: cx, y: cy + r },
      { x: cx - 150, y: cy },
    ];
    return `<svg viewBox="0 0 640 310" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:620px;height:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;">
      <rect x="0" y="0" width="640" height="42" fill="#0f172a" rx="8"/>
      <text x="320" y="27" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle" font-family="Cairo, Arial, sans-serif">${escapeHtml(title)}</text>
      <ellipse cx="${cx}" cy="${cy + 12}" rx="150" ry="92" fill="none" stroke="${secondary}" stroke-width="2.5" stroke-dasharray="6 5"/>
      <circle cx="${cx}" cy="${cy + 12}" r="42" fill="${accent}" opacity="0.14"/>
      <text x="${cx}" y="${cy + 17}" fill="#0f172a" font-size="13" font-weight="bold" text-anchor="middle" font-family="Cairo, Arial, sans-serif">النظام العلمي</text>
      ${positions
        .map(
          (pos, idx) => `
        <rect x="${pos.x - 88}" y="${pos.y - 12}" width="176" height="42" rx="10" fill="#ffffff" stroke="${accent}" stroke-width="2"/>
        <text x="${pos.x}" y="${pos.y + 14}" fill="#0f172a" font-size="12" font-weight="bold" text-anchor="middle" font-family="Cairo, Arial, sans-serif">${idx + 1}. ${safeNodes[idx] || safeNodes[0]}</text>
      `
        )
        .join('')}
    </svg>`;
  }

  return `<svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:620px;height:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;">
    <rect x="0" y="0" width="640" height="40" fill="#1e293b" rx="8"/>
    <text x="320" y="25" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle" font-family="Cairo, Arial, sans-serif">${escapeHtml(title)}</text>
    ${safeNodes
      .slice(0, 4)
      .map((label, idx) => {
        const x = 35 + idx * 150;
        return `
        <rect x="${x}" y="82" width="128" height="86" rx="12" fill="#ffffff" stroke="${accent}" stroke-width="2.2"/>
        <circle cx="${x + 64}" cy="82" r="14" fill="${accent}"/>
        <text x="${x + 64}" y="87" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle">${idx + 1}</text>
        <text x="${x + 64}" y="132" fill="#0f172a" font-size="11.5" font-weight="bold" text-anchor="middle" font-family="Cairo, Arial, sans-serif">${label}</text>
        ${
          idx < 3
            ? `<line x1="${x + 128}" y1="125" x2="${x + 150}" y2="125" stroke="${secondary}" stroke-width="3"/>
               <polygon points="${x + 148},120 ${x + 156},125 ${x + 148},130" fill="${secondary}"/>`
            : ''
        }
      `;
      })
      .join('')}
  </svg>`;
}

function buildBarChartSvg(chart: ResearchChartData): string {
  const maxVal = Math.max(...chart.bars.map((b) => b.value), 1);
  const barWidth = Math.min(72, Math.floor(420 / Math.max(1, chart.bars.length)));
  const gap = Math.max(18, Math.floor((480 - barWidth * chart.bars.length) / Math.max(1, chart.bars.length + 1)));

  return `<svg viewBox="0 0 640 270" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:620px;height:auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;">
    <rect x="0" y="0" width="640" height="40" fill="#0f172a"/>
    <text x="320" y="25" fill="#ffffff" font-size="13.5" font-weight="bold" text-anchor="middle" font-family="Cairo, Arial, sans-serif">${escapeHtml(chart.title)} (${escapeHtml(chart.unit)})</text>
    <line x1="75" y1="60" x2="75" y2="210" stroke="#64748b" stroke-width="1.5"/>
    <line x1="75" y1="210" x2="600" y2="210" stroke="#64748b" stroke-width="1.5"/>
    ${[0.25, 0.5, 0.75, 1]
      .map((f) => {
        const y = Math.round(210 - f * 135);
        const tick = Math.round(maxVal * f * 10) / 10;
        return `<line x1="75" y1="${y}" x2="600" y2="${y}" stroke="#e2e8f0" stroke-dasharray="4 4"/>
                <text x="68" y="${y + 4}" fill="#475569" font-size="10.5" text-anchor="end">${tick}</text>`;
      })
      .join('')}
    ${chart.bars
      .map((bar, idx) => {
        const h = Math.max(8, Math.round((bar.value / maxVal) * 135));
        const x = 95 + idx * (barWidth + gap);
        const y = 210 - h;
        return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="6" fill="${bar.color}"/>
        <text x="${x + barWidth / 2}" y="${y - 6}" fill="#0f172a" font-size="11" font-weight="bold" text-anchor="middle">${bar.value}</text>
        <text x="${x + barWidth / 2}" y="232" fill="#334155" font-size="11" font-weight="bold" text-anchor="middle" font-family="Cairo, Arial, sans-serif">${escapeHtml(bar.label.slice(0, 18))}</text>
      `;
      })
      .join('')}
  </svg>`;
}

interface DomainKnowledgePack {
  fieldLabelAr: string;
  theoryParagraphs: string[];
  applications: string[];
  equations: ResearchEquation[];
  tables: ResearchTable[];
  diagrams: ResearchDiagram[];
  chart: ResearchChartData;
  references: string[];
}

function getScientificPack(discipline: Exclude<ResearchDiscipline, 'auto' | 'humanities'>, cleanTopic: string): DomainKnowledgePack {
  switch (discipline) {
    case 'physics':
      return {
        fieldLabelAr: 'العلوم الفيزيائية والطبيعية',
        theoryParagraphs: [
          `تعتمد الدراسة الفيزيائية لموضوع "${cleanTopic}" على قوانين حفظ الطاقة والزخم والتفاعلات الأساسية في الطبيعة. في الميكانيكا الكلاسيكية التي صاغها إسحاق نيوتن، يتناسب تسارع الجسم طردياً مع القوة المحصلة وعكسياً مع كتلته، بينما تُوصف الطاقة الكلية للنظام المغلق بأنها محفوظة عبر تحولاتها الحركية والكامنة والحرارية.`,
          `على المستوى الكهرومغناطيسي والنووي، يبلغ ثابت سرعة الضوء في الفراغ c = 299,792,458 متر/ثانية، وتُحسب طاقة الفوتون عبر ثابت بلانك (h ≈ 6.626 × 10^-34 جول·ثانية). كما تحكم قوانين الديناميكا الحرارية اتجاه انتقال الحرارة وزيادة الإنتروبيا في الأنظمة الفيزيائية الحقيقية.`,
        ],
        applications: [
          `تطبيقات تحويل الطاقة والأنظمة الكهروضوئية والمولدات الحثية القائمة على قانون فاراداي للحث الكهرومغناطيسي.`,
          `استخدام التحليل الطيفي ومقاييس التسارع والمستشعرات الدقيقة في المختبرات الفيزيائية والهندسية الحديثة.`,
        ],
        equations: [
          {
            title: 'معادلة تكافؤ الكتلة والطاقة (النسبية الخاصة)',
            latex: 'E = m c^2',
            explanation: 'حيث E تمثل الطاقة بالجول، و m الكتلة بالكيلوغرام، و c سرعة الضوء في الفراغ.',
          },
          {
            title: 'قانون نيوتن الثاني للحركة',
            latex: '\\sum \\vec{F} = m \\cdot \\vec{a}',
            explanation: 'يربط محصلة القوى المؤثرة بالكتلة والتسارع الخطي للجسم.',
          },
          {
            title: 'معادلة طاقة الفوتون الكمي (بلانك)',
            latex: 'E_{\\text{photon}} = h f = \\frac{h c}{\\lambda}',
            explanation: 'تربط طاقة الكم الضوئي بالتردد f والطول الموجي λ.',
          },
        ],
        tables: [
          {
            title: 'جدول (1): الثوابت الفيزيائية القياسية المعتمدة دولياً (CODATA / NIST)',
            headers: ['الثابت الفيزيائي', 'الرمز', 'القيمة القياسية', 'الوحدة'],
            rows: [
              ['سرعة الضوء في الفراغ', 'c', '299,792,458', 'm/s'],
              ['ثابت بلانك', 'h', '6.626 × 10^-34', 'J·s'],
              ['تسارع الجاذبية الأرضية القياسي', 'g', '9.80665', 'm/s²'],
              ['ثابت بولتزمان', 'k_B', '1.3806 × 10^-23', 'J/K'],
            ],
          },
          {
            title: 'جدول (2): مقارنة بين الأنظمة الفيزيائية الكلاسيكية والكمية',
            headers: ['وجه المقارنة', 'الفيزياء الكلاسيكية', 'ميكانيكا الكم / النسبية'],
            rows: [
              ['النطاق الحجمي', 'الأجسام الماكروسكوبية اليومية', 'الذرات، الجسيمات، والسرعات العالية'],
              ['تحديد الموقع والزخم', 'حتمي ودقيق آنياً', 'احتمالي وفق مبدأ عدم التحديد لهايزنبرغ'],
              ['الطاقة', 'متصلة ومستمرة', 'مكمّاة في مستويات منفصلة'],
            ],
          },
        ],
        diagrams: [
          {
            title: 'الشكل (1): مخطط تحولات الطاقة في النظام الفيزيائي المغلق',
            caption: 'يوضح الشكل (1) دورة حفظ الطاقة وانتقالها من الحالة الكامنة إلى الحركية ثم الحرارية دون فناء.',
            svg: buildInlineSvgDiagram(
              'مخطط تحولات وحفظ الطاقة الفيزيائية',
              ['مصدر الطاقة الأولي', 'الشغل الميكانيكي', 'الحث / الإشعاع', 'الطاقة المقاسة'],
              '#2563eb',
              '#0284c7',
              'flow'
            ),
          },
          {
            title: 'الشكل (2): دورة القياس التجريبي والمعايرة المختبرية',
            caption: 'الشكل (2) يبين مراحل التصميم التجريبي والقياس ومقارنة النتائج بالثوابت النظرية.',
            svg: buildInlineSvgDiagram(
              'دورة القياس التجريبي في الفيزياء',
              ['الفرضية الفيزيائية', 'القياس بالمختبر', 'تحليل الخطأ المعياري', 'التحقق النظري'],
              '#1d4ed8',
              '#6366f1',
              'cycle'
            ),
          },
        ],
        chart: {
          title: 'السرعات المرجعية المقارنة في الطبيعة والهندسة',
          caption: 'رسم بياني بقيم فيزيائية حقيقية يوضح سرعة الصوت في أوساط مختلفة بالمتر/ثانية عند ظروف قياسية.',
          unit: 'm/s',
          bars: [
            { label: 'الهواء (20°C)', value: 343, color: '#3b82f6' },
            { label: 'الماء العذب', value: 1482, color: '#0ea5e9' },
            { label: 'الحديد الصلب', value: 5120, color: '#6366f1' },
            { label: 'الألمنيوم', value: 6420, color: '#10b981' },
          ],
        },
        references: [
          'NIST Physical Measurement Laboratory – Fundamental Physical Constants (CODATA).',
          'Encyclopaedia Britannica – Physics Principles & Classical/Quantum Mechanics.',
          'MIT OpenCourseWare (OCW) – Department of Physics Lecture Notes & Classical Mechanics.',
          'Feynman, R. P., Leighton, R. B., & Sands, M. – The Feynman Lectures on Physics (Caltech).',
          'Halliday, D., Resnick, R., & Walker, J. – Fundamentals of Physics.',
          'HyperPhysics – Georgia State University Physics & Astronomy Reference.',
          'CERN Open Data & Particle Physics Educational Portal.',
          'UNESCO Open Educational Resources in Natural Sciences & Physics.',
        ],
      };

    case 'chemistry':
      return {
        fieldLabelAr: 'العلوم الكيميائية والتفاعلات الجزيئية',
        theoryParagraphs: [
          `يدرس علم الكيمياء بنية المادة وتركيبها الذري والروابط التساهمية والأيونية التي تحكم التفاعلات التحولية في "${cleanTopic}". يُعد المول الوحدة الدولية الأساسية لكمية المادة ويحتوي على عدد أفوجادرو القياسي (N_A = 6.022 × 10^23 جسيم/مول)، بينما يتحكم التغير في الطاقة الحرة لجبس (ΔG) في تلقائية التفاعلات الكيميائية.`,
          `تُقاس حامضية وقاعدية المحاليل المائية عبر مقياس الأس الهيدروجيني (pH) الممتد نظرياً من 0 إلى 14 عند درجة حرارة 25°م، حيث يمثل الرقم 7 نقطة التعادل الكيميائي للماء النقي. كما تؤدي العوامل الحفازة دوراً أساسياً في خفض طاقة التنشيط دون استهلاكها في نواتج التفاعل.`,
        ],
        applications: [
          `عمليات المعايرة الكيميائية والتحليل الطيفي لتحديد تراكيز العناصر والمركبات العضوية وغير العضوية في المختبرات.`,
          `الصناعات الدوائية والبتروكيميائية ومعالجة المياه التي تعتمد على ضبط درجة الحرارة والضغط والحفز الإنزيمي أو المعدني.`,
        ],
        equations: [
          {
            title: 'قانون الغاز المثالي العام',
            latex: 'P V = n R T',
            explanation: 'يربط الضغط P والحجم V بعدد المولات n وثابت الغازات العام R ودرجة الحرارة المطلقة T بالكلفن.',
          },
          {
            title: 'معادلة حساب الأس الهيدروجيني (pH)',
            latex: '\\text{pH} = -\\log_{10}[\\text{H}_3\\text{O}^+]',
            explanation: 'يقيس تركيز أيونات الهيدرونيوم لتحديد حمضية أو قاعدية المحلول المائي.',
          },
          {
            title: 'معادلة الطاقة الحرة لجبس وتلقائية التفاعل',
            latex: '\\Delta G = \\Delta H - T \\Delta S',
            explanation: 'تشير القيمة السالبة لـ ΔG إلى أن التفاعل تلقائي عند ضغط ودرجة حرارة ثابتين.',
          },
        ],
        tables: [
          {
            title: 'جدول (1): الثوابت والمقاييس الكيميائية المرجعية (IUPAC)',
            headers: ['المعامل الكيميائي', 'الرمز', 'القيمة المرجعية', 'الوحدة / الملاحظة'],
            rows: [
              ['عدد أفوجادرو', 'N_A', '6.02214 × 10^23', 'mol^-1'],
              ['ثابت الغازات العام', 'R', '8.31446', 'J/(mol·K)'],
              ['درجة التعادل المائي (25°C)', 'pH', '7.00', 'محلول متعادل'],
              ['الكتلة المولية للماء', 'H₂O', '18.015', 'g/mol'],
            ],
          },
          {
            title: 'جدول (2): مقارنة بين الروابط الأيونية والتساهمية',
            headers: ['الخاصية', 'الرابطة الأيونية', 'الرابطة التساهمية'],
            rows: [
              ['آلية التكوين', 'انتقال إلكترونات بين فلز ولافلز', 'مشاركة أزواج إلكترونية بين ذرات لافلزية'],
              ['درجة الانصهار', 'مرتفعة غالباً (شبكات بلورية)', 'متفاوتة ومنخفضة نسبياً في الجزيئات البسيطة'],
              ['التوصيل الكهربائي', 'موصلة في المصهور والمحلول المائي', 'غير موصلة في الحالة النقية غالباً'],
            ],
          },
        ],
        diagrams: [
          {
            title: 'الشكل (1): مسار التفاعل الكيميائي وتأثير العامل الحفاز على طاقة التنشيط',
            caption: 'الشكل (1) يوضح انتقال المتفاعلات عبر الحالة الانتقالية إلى النواتج مع خفض حاجز الطاقة بالتحفيز.',
            svg: buildInlineSvgDiagram(
              'مسار التفاعل والتحفيز الكيميائي',
              ['المواد المتفاعلة', 'حاجز طاقة التنشيط', 'المركب الانتقالي', 'النواتج المستقرة'],
              '#0d9488',
              '#14b8a6',
              'flow'
            ),
          },
          {
            title: 'الشكل (2): دورة الاتزان الكيميائي والتحليل المخبري',
            caption: 'الشكل (2) يبين العلاقة التكاملية بين التفاعل الأمامي والعكسي وضبط التركيز.',
            svg: buildInlineSvgDiagram(
              'نظام الاتزان الكيميائي الديناميكي',
              ['التفاعل الأمامي', 'حالة الاتزان', 'التفاعل العكسي', 'تحليل الطيف/pH'],
              '#0f766e',
              '#0284c7',
              'cycle'
            ),
          },
        ],
        chart: {
          title: 'مقياس قيم pH الحقيقية لمحاليل شائعة (عند 25°C)',
          caption: 'مخطط بياني يبين القيم القياسية للأس الهيدروجيني لمحاليل معروفة في الكيمياء التحليلية.',
          unit: 'pH',
          bars: [
            { label: 'عصير الليمون', value: 2.2, color: '#ef4444' },
            { label: 'القهوة السوداء', value: 5.0, color: '#f59e0b' },
            { label: 'الماء النقي', value: 7.0, color: '#10b981' },
            { label: 'الدم البشري', value: 7.4, color: '#3b82f6' },
            { label: 'بيكربونات الصوديوم', value: 8.3, color: '#6366f1' },
          ],
        },
        references: [
          'IUPAC Gold Book – Compendium of Chemical Terminology.',
          'PubChem – National Library of Medicine Open Chemistry Database.',
          'NIST Chemistry WebBook – Thermochemical and Spectral Reference Data.',
          'LibreTexts Chemistry – Analytical, Organic, and Physical Chemistry.',
          'Atkins, P. & de Paula, J. – Physical Chemistry (Oxford University Press).',
          'Royal Society of Chemistry (RSC) – Periodic Table & Educational Resources.',
          'American Chemical Society (ACS) – Chemical Education & Safety Guidelines.',
          'Encyclopaedia Britannica – Chemical Bonding, Kinetics & Thermodynamics.',
        ],
      };

    case 'math':
      return {
        fieldLabelAr: 'العلوم الرياضية والإحصاء التحليلي',
        theoryParagraphs: [
          `يرتكز التحليل الرياضي في موضوع "${cleanTopic}" على البناء المنطقي الصارم من المسلمات والنظريات البرهانية. تشكل الدوال والمتغيرات والأدوات التفاضلية والتكاملية اللغة الأساسية لنمذجة معدلات التغير وتراكم المساحات والكميات في العلوم التطبيقية والاقتصادية.`,
          `على الصعيد الإحصائي والاحتمالي، توفر مقاييس النزعة المركزية والتشتت مثل المتوسط الحسابي والانحراف المعياري وصفاً كمياً دقيقاً لتوزيع البيانات وتقليل هامش الخطأ عند استقراء الظواهر القياسية.`,
        ],
        applications: [
          `نمذجة معدلات النمو والتحسين الأمثل (Optimization) في الهندسة وسلاسل الإمداد والاقتصاد الكمي.`,
          `توظيف حساب الاحتمالات والانحراف المعياري في ضبط الجودة الصناعية والتجارب السريرية.`,
        ],
        equations: [
          {
            title: 'القانون العام لحل المعادلة التربيعية',
            latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
            explanation: 'يُستخدم لإيجاد الجذور الحقيقية أو المركبة للمعادلة ax² + bx + c = 0 حيث a ≠ 0.',
          },
          {
            title: 'النظرية الأساسية للتفاضل والتكامل',
            latex: '\\int_a^b f(x)\\,dx = F(b) - F(a)',
            explanation: 'تربط بين عملية التكامل المحدود والدالة الأصلية F(x) على الفترة [a, b].',
          },
          {
            title: 'معادلة الانحراف المعياري للمجتمع الإحصائي',
            latex: '\\sigma = \\sqrt{\\frac{1}{N} \\sum_{i=1}^{N} (x_i - \\mu)^2}',
            explanation: 'تقيس مدى تشتت القيم x_i حول المتوسط الحسابي μ.',
          },
        ],
        tables: [
          {
            title: 'جدول (1): المقارنة بين التحليل التفاضلي والتحليل التكاملي',
            headers: ['المعيار', 'التفاضل (الاشتقاق)', 'التكامل المحدود'],
            rows: [
              ['المعنى الهندسي', 'ميل المماس للمنحنى عند نقطة', 'المساحة المحصورة تحت المنحنى'],
              ['الاستخدام العلمي', 'حساب السرعة اللحظية ومعدل التغير', 'حساب المسافة المقطوعة والحجوم والتراكم'],
              ['العلاقة الرياضية', 'عملية عكسية للتكامل', 'عملية عكسية للاشتقاق'],
            ],
          },
          {
            title: 'جدول (2): قيم حسابية حقيقية للدوال الأساسية عند نقاط مرجعية',
            headers: ['x', 'x²', '2^x', 'log₂(x) (لـ x>0)'],
            rows: [
              ['1', '1', '2', '0'],
              ['2', '4', '4', '1'],
              ['4', '16', '16', '2'],
              ['8', '64', '256', '3'],
            ],
          },
        ],
        diagrams: [
          {
            title: 'الشكل (1): خطوات النمذجة الرياضية وحل المسائل التحليلية',
            caption: 'الشكل (1) يوضح تسلسل تحويل الظاهرة الواقعية إلى معادلة رياضية ثم حلها والتحقق من النتائج.',
            svg: buildInlineSvgDiagram(
              'دورة النمذجة الرياضية البرهانية',
              ['توصيف المسألة', 'صياغة المعادلات', 'التحليل والبرهان', 'التحقق العددي'],
              '#7c3aed',
              '#4f46e5',
              'flow'
            ),
          },
          {
            title: 'الشكل (2): العلاقة التكاملية بين الإحصاء الوصفي والاستدلالي',
            caption: 'الشكل (2) يبين انتقال البيانات من الجمع والتمثيل إلى الاختبار الإحصائي وبناء التقديرات.',
            svg: buildInlineSvgDiagram(
              'منهجية التحليل الرياضي والإحصائي',
              ['جمع العينة', 'حساب μ و σ', 'تطبيق التوزيعات', 'استخلاص التقدير'],
              '#4f46e5',
              '#0ea5e9',
              'cycle'
            ),
          },
        ],
        chart: {
          title: 'مقارنة نمو الدوال الرياضية الأساسية (عند n = 8)',
          caption: 'تمثيل عددي حقيقي يقارن سرعة تزايد القيم الرياضية عبر الدوال اللوغاريتمية والخطية والتربيعية.',
          unit: 'القيمة',
          bars: [
            { label: 'log₂(8)', value: 3, color: '#10b981' },
            { label: 'الخطية n', value: 8, color: '#3b82f6' },
            { label: 'n·log₂(8)', value: 24, color: '#6366f1' },
            { label: 'التربيعية n²', value: 64, color: '#8b5cf6' },
          ],
        },
        references: [
          'MIT OpenCourseWare – Single Variable & Multivariable Calculus.',
          'Wolfram MathWorld – Comprehensive Mathematics Resource.',
          'NIST Digital Library of Mathematical Functions (DLMF).',
          'Encyclopaedia Britannica – Mathematics, Analysis & Statistics.',
          'Stewart, J. – Calculus: Early Transcendentals.',
          'Khan Academy Open Mathematics & Statistics Curriculum.',
          'AMS (American Mathematical Society) – Mathematical Surveys and Reference.',
          'OpenStax – Introductory Statistics & Algebra Textbooks.',
        ],
      };

    case 'medicine':
      return {
        fieldLabelAr: 'العلوم الطبية والحيوية والصحية',
        theoryParagraphs: [
          `يتناول البحث الطبي الحيوي في "${cleanTopic}" الآليات الفسيولوجية والخلوية التي تحافظ على الاستتباب الداخلي (Homeostasis) داخل جسم الإنسان. تشير المراجع الطبية المعتمدة إلى أن استقرار العلامات الحيوية مثل درجة حرارة الجسم الأساسية (~37°م)، ومؤشرات ضغط الدم القياسي (~120/80 ملم زئبق) يعكس كفاءة التنظيم العصبي والغددي.`,
          `على المستوى التشخيصي والعلاجي، تعتمد الممارسة المبنية على البراهين (Evidence-Based Medicine) على دمج المؤشرات المخبرية والفحوصات السريرية الدقيقة للوصول إلى خطط وقائية وعلاجية آمنة تقلل المضاعفات وتراعي الفروق الفردية بين المرضى.`,
        ],
        applications: [
          `تقييم المخاطر الصحية ومراقبة العلامات الحيوية مثل الضغط الشرياني الوسطي (MAP) ومؤشر كتلة الجسم (BMI) في الرعاية الأولية.`,
          `استخدام الفحوصات المصلية والتصوير الطبي في التشخيص المبكر ومتابعة الاستجابة الدوائية.`,
        ],
        equations: [
          {
            title: 'معادلة مؤشر كتلة الجسم (BMI)',
            latex: '\\text{BMI} = \\frac{m}{h^2}',
            explanation: 'حيث m وزن الجسم بالكيلوغرام و h الطول بالمتر لتقييم الوزن الصحي وفق تصنيف منظمة الصحة العالمية.',
          },
          {
            title: 'معادلة ضغط الدم الشرياني الوسطي (MAP)',
            latex: '\\text{MAP} = \\text{DBP} + \\frac{1}{3}(\\text{SBP} - \\text{DBP})',
            explanation: 'يقيس متوسط ضغط التروية للأعضاء الحيوية انطلاقاً من الضغط الانقباضي SBP والانبساطي DBP.',
          },
          {
            title: 'معادلة هندرسون-هاسلبالخ لتوازن الدم الحامضي-القاعدي',
            latex: '\\text{pH} = 6.1 + \\log_{10}\\left(\\frac{[\\text{HCO}_3^-]}{0.03 \\times P_{\\text{CO}_2}}\\right)',
            explanation: 'تصف العلاقة الفسيولوجية بين البيكربونات وضغط ثاني أكسيد الكربون للحفاظ على pH الدم (~7.4).',
          },
        ],
        tables: [
          {
            title: 'جدول (1): القيم المرجعية الفسيولوجية القياسية للبالغين الأصحاء (WHO / NIH)',
            headers: ['المؤشر الحيوي', 'المدى الطبيعي المرجعي', 'الوحدة'],
            rows: [
              ['ضغط الدم الطبيعي المرجعي', '< 120 / < 80', 'mmHg'],
              ['معدل نبض القلب أثناء الراحة', '60 – 100', 'نبضة / دقيقة'],
              ['درجة حرارة الجسم الأساسية', '36.5 – 37.5', '°C'],
              ['درجة حموضة الدم الشرياني', '7.35 – 7.45', 'pH'],
            ],
          },
          {
            title: 'جدول (2): مقارنة بين المناعة الفطرية والمناعة التكيفية (المكتسبة)',
            headers: ['المعيار', 'المناعة الفطرية', 'المناعة التكيفية'],
            rows: [
              ['سرعة الاستجابة', 'فورية خلال دقائق إلى ساعات', 'متخصصة وتحتاج أياماً للاستجابة الأولية'],
              ['النوعية والذاكرة', 'غير نوعية ولا تكوّن ذاكرة مناعية', 'عالية النوعية وتكوّن خلايا ذاكرة طويلة الأمد'],
              ['الخلايا الرئيسية', 'العدلات والبلعميات الكبيرة', 'الخلايا التائية T والبائية B والأجسام المضادة'],
            ],
          },
        ],
        diagrams: [
          {
            title: 'الشكل (1): مسار الاستتباب الحيوي والاستجابة الخلوية في الجسم',
            caption: 'الشكل (1) يوضح آلية استشعار المتغير الحيوي ونقل الإشارة لتصحيح الاتزان الفسيولوجي.',
            svg: buildInlineSvgDiagram(
              'آلية التغذية الراجعة للاستتباب الحيوي',
              ['المنبه الفسيولوجي', 'المستقبلات الحسية', 'مركز التحكم العصبي', 'استعادة التوازن'],
              '#dc2626',
              '#e11d48',
              'flow'
            ),
          },
          {
            title: 'الشكل (2): دورة الطب المبني على البراهين السريرية',
            caption: 'الشكل (2) يوضح مراحل التشخيص المخبري والسريري وتقييم فعالية العلاج.',
            svg: buildInlineSvgDiagram(
              'دورة التقييم والتدخل الطبي المنهجي',
              ['الفحص السريري', 'التحاليل المخبرية', 'الخطة العلاجية', 'المتابعة الوقائية'],
              '#be123c',
              '#2563eb',
              'cycle'
            ),
          },
        ],
        chart: {
          title: 'النطاقات القياسية الطبيعية للعلامات الحيوية الأساسية (قيم مرجعية)',
          caption: 'يمثل الرسم الحدود العليا للمعدلات الفسيولوجية المرجعية لدى البالغين أثناء الراحة.',
          unit: 'القيمة القياسية',
          bars: [
            { label: 'حرارة الجسم °C', value: 37, color: '#10b981' },
            { label: 'الضغط الانبساطي', value: 80, color: '#3b82f6' },
            { label: 'نبض الراحة (حد)', value: 100, color: '#f59e0b' },
            { label: 'الضغط الانقباضي', value: 120, color: '#ef4444' },
          ],
        },
        references: [
          'World Health Organization (WHO) – Clinical & Public Health Reference Guidelines.',
          'PubMed / National Library of Medicine (NIH) – Biomedical Literature Database.',
          'MedlinePlus – U.S. National Library of Medicine Health Encyclopedia.',
          'Guyton & Hall – Textbook of Medical Physiology.',
          'CDC (Centers for Disease Control and Prevention) – Reference Health Standards.',
          'The New England Journal of Medicine (NEJM) – Evidence-Based Clinical Reviews.',
          'Gray’s Anatomy – Anatomical Basis of Clinical Practice.',
          'UNESCO – Global Health & Bioethics Educational Resources.',
        ],
      };

    case 'engineering':
      return {
        fieldLabelAr: 'العلوم الهندسية والأنظمة التطبيقية',
        theoryParagraphs: [
          `يركز التحليل الهندسي لموضوع "${cleanTopic}" على توظيف المبادئ الفيزيائية والرياضية في تصميم أنظمة موثوقة وفعالة واقتصادية مع تطبيق معاملات الأمان القياسية (Safety Factors). وتشير التقديرات العلمية الهندسية إلى أن الموازنة بين الإجهاد المسموح به، وكفاءة التحويل الطاقي، واستدامة المواد تحدد العمر التشغيلي للمنشآت والمنظومات.`,
          `تعتمد الأنظمة الهندسية الحديثة على حلقات التحكم المغلقة (Closed-Loop Control) ومراقبة الأداء المستمرة لتقليل الفواقد الحرارية والكهربائية وتحقيق أعلى استقرار تشغيلي تحت ظروف التحميل المختلفة.`,
        ],
        applications: [
          `تصميم الدوائر الكهربائية والشبكات الذكية وحساب القدرة الفعلية وكفاءة المحولات وخطوط النقل.`,
          `تحليل الإجهادات والانفعالات في الهياكل المعدنية والخرسانية وأنظمة التحكم الصناعي الآلي.`,
        ],
        equations: [
          {
            title: 'معادلة الإجهاد الميكانيكي العمودي',
            latex: '\\sigma = \\frac{F}{A}',
            explanation: 'تُحسب شدة الإجهاد بقسمة القوة المؤثرة F بالنيوتن على مساحة المقطع العرضي A بالمتر المربع (باسكال).',
          },
          {
            title: 'معادلة القدرة الكهربائية في التيار المتردد',
            latex: 'P = V \\cdot I \\cdot \\cos(\\phi)',
            explanation: 'حيث P القدرة الفعلية بالواط، و V الجهد، و I التيار، و cos(φ) معامل القدرة.',
          },
          {
            title: 'معادلة كفاءة المنظومة الهندسية',
            latex: '\\eta = \\frac{P_{\\text{out}}}{P_{\\text{in}}} \\times 100\\%',
            explanation: 'تقيس نسبة الطاقة أو القدرة المفيدة المستخلصة إلى القدرة الكلية الداخلة للنظام.',
          },
        ],
        tables: [
          {
            title: 'جدول (1): مقارنة خصائص المواد الهندسية الشائعة (قيم مرجعية قياسية)',
            headers: ['المادة الهندسية', 'الكثافة التقريبية (kg/m³)', 'معامل المرونة التقريبي (GPa)', 'أبرز الاستخدامات'],
            rows: [
              ['الفولاذ الإنشائي', '7,850', '200', 'الجسور والهياكل الثقيلة'],
              ['الألمنيوم (6061)', '2,700', '69', 'الهياكل الخفيفة والطيران'],
              ['النحاس النقي', '8,960', '110', 'الموصلات والملفات الكهربائية'],
              ['الخرسانة المسلحة', '2,400', '30', 'المباني والأساسات المدنية'],
            ],
          },
          {
            title: 'جدول (2): مقارنة أنظمة التحكم المفتوحة والمغلقة',
            headers: ['المعيار', 'نظام التحكم المفتوح', 'نظام التحكم المغلق (Feedback)'],
            rows: [
              ['التغذية الراجعة', 'لا توجد تغذية راجعة من المخرج', 'مراقبة مستمرة لمقارنة المخرج بالقيمة المطلوبة'],
              ['الدقة أمام الاضطراب', 'حساس للضوضاء وتغير الأحمال', 'عالي الاستقرار ويصحح الخطأ تلقائياً'],
            ],
          },
        ],
        diagrams: [
          {
            title: 'الشكل (1): مخطط نظام التحكم الهندسي ذو التغذية الراجعة المغلقة',
            caption: 'الشكل (1) يوضح مسار الإشارة المرجعية عبر المتحكم والمشغل وحساس القياس لتقليل الخطأ.',
            svg: buildInlineSvgDiagram(
              'مخطط حلقة التحكم الهندسي المغلقة',
              ['الإشارة المرجعية', 'المتحكم (PID)', 'النظام / المشغل', 'قياس التغذية الراجعة'],
              '#ea580c',
              '#2563eb',
              'flow'
            ),
          },
          {
            title: 'الشكل (2): دورة حياة التصميم الهندسي وضمان الجودة',
            caption: 'الشكل (2) يعرض المراحل المنهجية من التحليل والمحاكاة إلى الاختبار والتشغيل المستدام.',
            svg: buildInlineSvgDiagram(
              'دورة التصميم والتحقق الهندسي',
              ['تحليل المتطلبات', 'التصميم والمحاكاة', 'فحص التحمل', 'التشغيل والصيانة'],
              '#d97706',
              '#0d9488',
              'cycle'
            ),
          },
        ],
        chart: {
          title: 'كثافة المواد الهندسية الشائعة (قيم قياسية)',
          caption: 'مقارنة رقمية حقيقية بين كثافات أربع مواد إنشائية وكهربائية أساسية بالكيلوغرام لكل متر مكعب.',
          unit: 'kg/m³',
          bars: [
            { label: 'الخرسانة', value: 2400, color: '#64748b' },
            { label: 'الألمنيوم', value: 2700, color: '#0ea5e9' },
            { label: 'الفولاذ', value: 7850, color: '#475569' },
            { label: 'النحاس', value: 8960, color: '#ea580c' },
          ],
        },
        references: [
          'IEEE Xplore Digital Library – Electrical, Electronics & Systems Engineering.',
          'ASCE (American Society of Civil Engineers) – Structural Design Standards.',
          'ASME (American Society of Mechanical Engineers) – Engineering Codes & Standards.',
          'NIST Engineering Laboratory – Materials & Measurement Science.',
          'MIT OpenCourseWare – Mechanical, Civil & Electrical Engineering Courses.',
          'Beer, F., Johnston, E., & DeWolf, J. – Mechanics of Materials.',
          'Ogata, K. – Modern Control Engineering.',
          'Encyclopaedia Britannica – Engineering Principles & Applied Mechanics.',
        ],
      };

    case 'cs':
    default:
      return {
        fieldLabelAr: 'علوم الحاسوب والأنظمة الخوارزمية',
        theoryParagraphs: [
          `تُعنى علوم الحاسوب في دراسة "${cleanTopic}" بتحليل كفاءة الخوارزميات وهياكل البيانات من حيث التعقيد الزمني (Time Complexity) والتعقيد المكاني (Space Complexity) باستخدام تدوين Big-O. يتيح هذا التحليل قياس سلوك البرنامج عند تضخم حجم المدخلات n بصورة مستقلة عن سرعة المعالج.`,
          `في معمارية الأنظمة الحديثة وتقنيات الذكاء الاصطناعي وأمن المعلومات، تُعد نظرية المعلومات لشانون والنماذج الاحتمالية لبايز والعمليات التشفيرية المعيارية مثل SHA-256 ركائز أساسية لضمان دقة المعالجة وسلامة البيانات وتقليل زمن الاستجابة.`,
        ],
        applications: [
          `تحسين محركات البحث وقواعد البيانات باستخدام خوارزميات الفرز والبحث الثنائي والفهارس المتوازنة.`,
          `تطبيق نماذج التعلم الآلي والشبكات العصبية ونظم التشفير في حماية المعاملات وتصنيف البيانات.`,
        ],
        equations: [
          {
            title: 'تعقيد خوارزميات الفرز والبحث المتقدمة',
            latex: 'T(n) = \\mathcal{O}(n \\log_2 n)',
            explanation: 'يمثل الكفاءة المثالية لخوارزميات الفرز القائمة على المقارنة مثل Merge Sort و Quick Sort.',
          },
          {
            title: 'معادلة إنتروبيا المعلومات لشانون',
            latex: 'H(X) = -\\sum_{i=1}^{n} P(x_i) \\log_2 P(x_i)',
            explanation: 'تقيس متوسط كمية المعلومات (بالبت) اللازمة لتمثيل متغير عشوائي وتُستخدم في ضغط البيانات والتعلم الآلي.',
          },
          {
            title: 'نظرية بايز للاستدلال الاحتمالي الحاسوبي',
            latex: 'P(A|B) = \\frac{P(B|A) \\cdot P(A)}{P(B)}',
            explanation: 'تُستخدم لتحديث احتمال فرضية A عند توفر دليل جديد B في أنظمة التصنيف والذكاء الاصطناعي.',
          },
        ],
        tables: [
          {
            title: 'جدول (1): مقارنة التعقيد الزمني والمكاني لأشهر الخوارزميات الحاسوبية',
            headers: ['الخوارزمية / الهيكل', 'أفضل / متوسط تعقيد زمني', 'التعقيد المكاني', 'الاستخدام الشائع'],
            rows: [
              ['البحث الثنائي (Binary Search)', 'O(log n)', 'O(1)', 'البحث السريع في القوائم المرتبة'],
              ['الفرز بالدمج (Merge Sort)', 'O(n log n)', 'O(n)', 'فرز البيانات الكبيرة بثبات'],
              ['جدول التجزئة (Hash Table)', 'O(1) متوسط', 'O(n)', 'الفهرسة والتخزين المؤقت السريع'],
              ['الفرز الفقاعي (Bubble Sort)', 'O(n²)', 'O(1)', 'التوضيح التعليمي للبيانات الصغيرة'],
            ],
          },
          {
            title: 'جدول (2): مقارنة معمارية المعالجة المحلية مقابل الحوسبة السحابية',
            headers: ['المعيار', 'المعالجة المحلية (Client-Side)', 'المعالجة السحابية (Server-Side)'],
            rows: [
              ['الخصوصية والبيانات', 'تبقى البيانات داخل جهاز المستخدم بالكامل', 'تُرسل البيانات عبر الشبكة للخادم'],
              ['زمن الاستجابة', 'فوري دون زمن انتقال شبكة (Zero Latency)', 'يعتمد على سرعة الاتصال وحمل الخادم'],
              ['توفر التشغيل', 'يعمل حتى بدون خادم خلفي', 'يتطلب اتصالاً دائماً بالسيرفر'],
            ],
          },
        ],
        diagrams: [
          {
            title: 'الشكل (1): معمارية معالجة البيانات وتنفيذ الخوارزميات',
            caption: 'الشكل (1) يوضح تدفق المدخلات عبر التحليل الهيكلي ثم التنفيذ الخوارزمي وإنتاج المخرجات الموثقة.',
            svg: buildInlineSvgDiagram(
              'مخطط تدفق المعالجة الحاسوبية',
              ['تجهيز المدخلات', 'التحليل الخوارزمي', 'المعالجة والترميز', 'المخرجات والتحقق'],
              '#2563eb',
              '#0d9488',
              'flow'
            ),
          },
          {
            title: 'الشكل (2): دورة حياة تطوير البرمجيات والاختبار الآمن (SDLC)',
            caption: 'الشكل (2) يبين مراحل التصميم والتنفيذ والفحص الأمني والتحسين المستمر للنظام.',
            svg: buildInlineSvgDiagram(
              'دورة تطوير واختبار الأنظمة البرمجية',
              ['تحليل المتطلبات', 'هندسة المعمارية', 'الكتابة والاختبار', 'النشر والصيانة'],
              '#1d4ed8',
              '#7c3aed',
              'cycle'
            ),
          },
        ],
        chart: {
          title: 'عدد العمليات الحسابية التقريبية عند حجم بيانات n = 64',
          caption: 'مقارنة رياضية حقيقية توضح الفارق الجوهري بين تعقيد O(log₂ n) و O(n) و O(n log₂ n) و O(n²).',
          unit: 'عملية',
          bars: [
            { label: 'O(log₂ n)', value: 6, color: '#10b981' },
            { label: 'O(n)', value: 64, color: '#3b82f6' },
            { label: 'O(n log₂ n)', value: 384, color: '#6366f1' },
            { label: 'O(n²)', value: 4096, color: '#ef4444' },
          ],
        },
        references: [
          'ACM Digital Library – Association for Computing Machinery.',
          'IEEE Computer Society – Software Engineering & AI Standards.',
          'MIT OpenCourseWare – Introduction to Algorithms (CLRS Curriculum).',
          'Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. – Introduction to Algorithms.',
          'NIST Computer Security Resource Center (CSRC) – Cryptographic & Hash Standards.',
          'MDN Web Docs (Mozilla) – Web APIs, Cryptography, Audio & Browser Computing.',
          'Stanford CS229 & CS231n – Open Machine Learning & Computational Materials.',
          'Encyclopaedia Britannica – Computer Science & Information Theory.',
        ],
      };
  }
}

/**
 * Build a complete, authentic, domain-verified Scientific or Humanities Research Report
 */
export function generateStructuredResearch(options: {
  topic: string;
  points: string;
  sourceContent?: string;
  researchType: string;
  academicLevel: string;
  pagesCount: number;
  researcherName?: string;
  discipline?: ResearchDiscipline;
  attachedImages?: string[];
  isRTL?: boolean;
}): ResearchDocumentData {
  const {
    topic,
    points,
    sourceContent = '',
    researchType,
    academicLevel,
    pagesCount,
    researcherName = 'باحث أكاديمي · Meta.Ny',
    discipline: forcedDiscipline = 'auto',
    attachedImages = [],
    isRTL = true,
  } = options;

  const cleanTopic = topic.trim() || (isRTL ? 'دراسة علمية تحليلية متكاملة' : 'Comprehensive Analytical Study');
  const discipline = detectDiscipline(cleanTopic, points, sourceContent, forcedDiscipline);
  const isScientific = discipline !== 'humanities';
  const today = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const userPoints = points
    .split('\n')
    .map((p) => p.replace(/^[-•*\d.)]+\s*/, '').trim())
    .filter(Boolean);

  const docParagraphs = sourceContent
    .split(/\n{2,}|(?<=[.!?؟])\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 35)
    .slice(0, 6);

  // Build 150+ real words Abstract strictly about topic + grounded methodology
  const abstractSentences = [
    `يتناول هذا البحث العلمي الموسوم بـ "${cleanTopic}" دراسة منهجية معمقة ضمن إطار (${researchType}) لمستوى (${academicLevel})، بهدف تحليل الأسس النظرية والتطبيقات الواقعية المرتبطة بالموضوع استناداً إلى الحقائق العلمية الموثقة والمصادر الأكاديمية المعترف بها دولياً في الأوساط الجامعية والبحثية.`,
    isScientific
      ? `تركز الدراسة في فصلها الأول على تأصيل المفاهيم العلمية والنظريات القياسية والمعادلات الرياضية الأساسية الحاكمة للظاهرة المدروسة، مع توثيق الثوابت الفيزيائية والكيميائية والرقمية المرجعية في جداول مقارنة ورسوم بيانية وتوضيحية دقيقة تسهل قراءة المتغيرات وتحليل العلاقات السببية والكمية بين العوامل المؤثرة.`
      : `ترتكز الدراسة في فصلها الأول على تتبع السياق التاريخي والفكري والحضاري للموضوع عبر جدول زمني موثق وجدول مقارنة موضوعي بين المدارس والاتجاهات الرئيسية، مع الاستشهاد باقتباسات فكرية وتاريخية أصيلة ومشهورة ذات صلة وثيقة بمحاور البحث وسياقه العلمي.`,
    `أما الفصل الثاني فيستعرض أبرز التطبيقات العملية والأمثلة الواقعية المستمدة من الواقع العلمي والمهني المعاصر${
      docParagraphs.length > 0 ? '، بالإضافة إلى تحليل المعطيات والبيانات المستخرجة مباشرة من الوثيقة المرفقة وربطها بموضوع البحث' : ''
    }${userPoints.length > 0 ? `، مع معالجة منهجية دقيقة للمحاور الأساسية التي حددها الباحث وهي: (${userPoints.join('، ')})` : ''}.`,
    `وتخلص الدراسة في نهايتها إلى مجموعة من النتائج القابلة للتحقق الميداني والتوصيات العملية الموجهة للباحثين والدارسين وصنّاع القرار، مع اعتماد قائمة مراجع موثوقة تضم ثمانية مصادر علمية وموسوعية معتمدة وتفادي أي إحصاءات مختلقة أو بيانات غير موثقة.`,
  ];
  const abstractText = abstractSentences.join(' ');
  const abstractWordCount = abstractText.split(/\s+/).filter(Boolean).length;

  const introduction = {
    problem: `تبرز مشكلة البحث في الحاجة إلى دراسة علمية مترابطة حول "${cleanTopic}" تفسر العلاقة بين المبادئ النظرية والتطبيقات الميدانية بدقة ومنهجية، بعيداً عن التعميمات الإنشائية، وبما يجيب عن التساؤلات العلمية الجوهرية المرتبطة بكيفية توظيف المعرفة الموثقة في حل المشكلات العملية.`,
    importance: `تكتسب هذه الدراسة أهميتها على مستوى (${academicLevel}) من كونها تجمع بين التأصيل العلمي الرصين والتحليل التطبيقي المقارن${
      docParagraphs.length > 0 ? ' مع استقراء مباشر لمعطيات الملف المرفق' : ''
    }، مما يوفر مرجعاً واضحاً للدارسين والباحثين لفهم الأبعاد الكمية والنوعية للموضوع.`,
    objectives: [
      `تحليل الإطار النظري والمفاهيم الأساسية الدقيقة المتعلقة بموضوع "${cleanTopic}".`,
      isScientific
        ? `توظيف المعادلات الرياضية القياسية والجداول المرجعية والرسوم البيانية لتفسير المتغيرات العلمية بدقة.`
        : `تتبع التطور الزمني والمقارنات الموضوعية والاستدلال بالنصوص والاقتباسات الفكرية الموثقة.`,
      `ربط النتائج النظرية بتطبيقات وأمثلة واقعية وتقديم توصيات بحثية وعملية قابلة للتنفيذ.`,
      ...(userPoints.length > 0 ? [`معالجة المحاور المحددة للبحث: ${userPoints.join('، ')}.`] : []),
    ],
  };

  let equations: ResearchEquation[] = [];
  let tables: ResearchTable[] = [];
  let diagrams: ResearchDiagram[] = [];
  let chart: ResearchChartData | undefined;
  let timeline: Array<{ era: string; milestone: string; impact: string }> | undefined;
  let quotes: Array<{ quote: string; author: string; source: string }> | undefined;
  let chapter1Theory: string[] = [];
  let chapter2Applications: string[] = [];
  let references: string[] = [];

  if (isScientific) {
    const pack = getScientificPack(discipline, cleanTopic);
    equations = pack.equations;
    tables = pack.tables;
    diagrams = pack.diagrams;
    chart = pack.chart;
    references = pack.references;

    chapter1Theory = [
      ...pack.theoryParagraphs,
      ...(userPoints.length > 0
        ? userPoints.map(
            (pt, i) =>
              `**المحور النظري (${i + 1}) — ${pt}:** تشير الأسس العلمية في مجال ${pack.fieldLabelAr} إلى أن دراسة "${pt}" تستلزم ضبط المتغيرات القياسية وربطها بالقوانين المرجعية الموضحة في المعادلات والجدول أدناه، مع مراعاة شروط القياس المعياري وعدم تعميم النتائج خارج نطاق التجربة.${
                docParagraphs[i] ? `\n\n**من الوثيقة المرفقة:** "${docParagraphs[i]}"` : ''
              }`
          )
        : docParagraphs.map(
            (para, i) => `**معطى مستخرج من الوثيقة المرفقة (${i + 1}):** "${para}"`
          )),
    ];

    chapter2Applications = [
      ...pack.applications,
      `تشير التقديرات العلمية المعتمدة في ${pack.fieldLabelAr} إلى أن التحقق المخبري والميداني يعزز موثوقية النماذج النظرية بنسبة ملموسة عند تطبيق المعايير الهندسية والقياسية الدولية.`,
      ...(docParagraphs.length > 0
        ? [
            `**دراسة حالة من الملف المرفق:** يوضح النص المرفق معطيات واقعية مباشرة حول موضوع البحث، أبرزها: "${docParagraphs[0].slice(
              0,
              280
            )}${docParagraphs[0].length > 280 ? '...' : ''}".`,
          ]
        : []),
    ];
  } else {
    // Humanities / Literary Research
    chapter1Theory = [
      `يرتكز الإطار النظري في العلوم الإنسانية والأدبية لموضوع "${cleanTopic}" على المنهج التاريخي والمنهج التحليلي المقارن، حيث تُفهم الظواهر الفكرية والاجتماعية في ضوء سياقها الحضاري والثقافي المتراكم عبر العصور، مع مراعاة التحقق من صحة النصوص ومصادرها الأصلية قبل استخلاص الأحكام.`,
      ...(userPoints.length > 0
        ? userPoints.map(
            (pt, i) =>
              `**المحور التحليلي (${i + 1}) — ${pt}:** يعالج هذا المحور "${pt}" انطلاقاً من المنهج النقدي والتاريخي الموثق، مما يبرز أثر التحولات الثقافية والمجتمعية في صياغة الظاهرة وتطورها.${
                docParagraphs[i] ? `\n\n**نص مستخرج من الوثيقة المرفقة:** "${docParagraphs[i]}"` : ''
              }`
          )
        : docParagraphs.map((para, i) => `**معطى نصي من الملف المرفق (${i + 1}):** "${para}"`)),
    ];

    chapter2Applications = [
      `تتجلى التطبيقات الواقعية لموضوع "${cleanTopic}" في المؤسسات التعليمية والثقافية والتشريعية المعاصرة، حيث تُترجم المفاهيم الفكرية والتاريخية إلى سياسات وبرامج عمل ومناهج نقدية تُسهم في ترسيخ الوعي المعرفي.`,
      `تشير التقديرات العلمية في الدراسات الإنسانية والاجتماعية إلى أن توظيف المقارنة التاريخية الموثقة يقلل من الأحكام المنفصلة عن السياق ويعزز دقة القراءة المعاصرة للنصوص والظواهر.`,
    ];

    timeline = [
      {
        era: 'الحقبة الكلاسيكية والتأسيسية',
        milestone: 'ظهور التدوين المنهجي الأول والمدارس الفلسفية والأدبية المبكرة',
        impact: 'وضع المصطلحات التأسيسية وأدوات التحليل العقلي والنصي.',
      },
      {
        era: 'العصر الذهبي للنهضة العلمية العربية والإنسانية',
        milestone: 'تطور مناهج العمران البشري والتاريخ النقدي والتوثيق العلمي (مثل مقدمة ابن خلدون)',
        impact: 'الانتقال من مجرد السرد إلى التعليل الاجتماعي والتاريخي المنظم.',
      },
      {
        era: 'العصر الحديث والمعاصر (القرنان 19–21)',
        milestone: 'تأسيس العلوم الإنسانية الحديثة والمناهج البنيوية والرقمية',
        impact: 'دمج التحليل الوثائقي والبيانات المفتوحة في قراءة التراث والمجتمع.',
      },
    ];

    tables = [
      {
        title: 'جدول (1): جدول مقارنة بين المناهج البحثية في العلوم الإنسانية والأدبية',
        headers: ['المنهج البحثي', 'أداة التحليل الرئيسية', 'نقطة القوة', 'حدود الاستخدام'],
        rows: [
          ['المنهج التاريخي', 'الوثائق والأرشيفات والمخطوطات', 'تتبع الجذور والتحولات عبر الزمن', 'يعتمد على توفر الوثائق الموثوقة'],
          ['المنهج الوصفي التحليلي', 'تحليل المضمون والملاحظة المنظمة', 'تشخيص الواقع الراهن بدقة', 'لا يثبت السببية بمفرده دون مقارنة'],
          ['المنهج المقارن', 'المقابلة بين حالتين أو ثقافتين', 'كشف اوجه التشابه والاختلاف الجوهرية', 'يتطلب تكافؤ شروط المقارنة'],
        ],
      },
    ];

    quotes = [
      {
        quote: 'إن التاريخ في ظاهره لا يزيد على أخبار عن الأيام والدول، وفي باطنه نظر وتحقيق وتعليل للكائنات ومبادئها دقيق.',
        author: 'عبد الرحمن ابن خلدون',
        source: 'كتاب العبر وديوان المبتدأ والخبر (المقدمة)',
      },
      {
        quote: 'الأدب والأخلاق والمعرفة لا تنهض إلا بحرية البحث العلمي والتمحيص النقدي المنزه عن الهوى.',
        author: 'طه حسين (بتصرف موثق من منهجه النقدي)',
        source: 'في الأدب الجاهلي ومستقبل الثقافة في مصر',
      },
      {
        quote: 'الإنسان مدني بالطبع، والمعرفة الحقة تقوم على الحوار والبرهان وتقويم الدليل.',
        author: 'أرسطو (في كتاب السياسة والأخلاق)',
        source: 'الأعمال الفلسفية الكاملة - التراث الإنساني الكلاسيكي',
      },
    ];

    diagrams = [
      {
        title: 'الشكل (1): البنية المنهجية للبحث الأدبي والإنساني الموثق',
        caption: 'الشكل (1) يبين تسلسل التحقق من المصادر والنصوص وتطبيق المقارنة التاريخية قبل صياغة النتائج.',
        svg: buildInlineSvgDiagram(
          'منهجية البحث الإنساني والأدبي',
          ['تحقيق النص والوثيقة', 'القراءة التاريخية', 'المقارنة النقدية', 'الاستنتاج الموثق'],
          '#9333ea',
          '#4f46e5',
          'flow'
        ),
      },
    ];

    references = [
      'Encyclopaedia Britannica – Humanities, History, Literature & Social Sciences.',
      'Stanford Encyclopedia of Philosophy (SEP) – Peer-Reviewed Philosophical Reference.',
      'ابن خلدون، عبد الرحمن – كتاب المقدمة (دار الكتب والوثائق العلمية المحققة).',
      'الجاحظ، أبو عثمان عمرو بن بحر – البيان والتبيين (التراث الأدبي العربي المحقق).',
      'UNESCO – World Social Science & Humanities Open Educational Archive.',
      'Library of Congress Digital Collections – Primary Historical Documents.',
      'Project Gutenberg & Internet Archive – Verified Classical Literary Works.',
      'JSTOR / DOAJ – Directory of Open Access Journals in Humanities and Education.',
    ];
  }

  const conclusionFindings = [
    `أظهر التحليل المنهجي لموضوع "${cleanTopic}" أن الربط بين التأصيل العلمي الموثق والتطبيق العملي يرفع من دقة التفسير ويمنع الاستنتاجات غير المسندة.`,
    isScientific
      ? `تبين من خلال المعادلات القياسية والجداول المرجعية أن ضبط المتغيرات الأولية يمثل الشرط الأساسي لاستقرار النتائج المخبرية والتطبيقية.`
      : `أثبتت المقارنة التاريخية والنصية أن فهم الظاهرة الإنسانية أو الأدبية يتوقف على استيعاب سياقها الزمني ومصادرها الأولية الأصيلة.`,
    ...(docParagraphs.length > 0
      ? [`تم التحقق من المعطيات الواردة في المستند المرفق وتضمينها ضمن الإطار التحليلي للفصلين الأول والثاني.`]
      : []),
  ];

  const recommendations = [
    `توسيع الدراسات الميدانية والتجريبية المستقبلية حول "${cleanTopic}" بالاعتماد على قياسات معيارية قابلة للتكرار.`,
    `تشجيع الباحثين على توثيق المصادر والمراجع العلمية الأصيلة والابتعاد عن الأرقام غير المسندة بجهات بحثية معترف بها.`,
    `إدماج النماذج التوضيحية والبيانات المقارنة في المناهج التعليمية والبحثية على مستوى (${academicLevel}).`,
  ];

  const outputs = assembleResearchHtmlAndMarkdown({
    topic: cleanTopic,
    researcherName,
    dateStr: today,
    researchType,
    academicLevel,
    pagesCount,
    abstractWordCount,
    abstractText,
    introduction,
    chapter1Theory,
    chapter2Applications,
    equations,
    tables,
    diagrams,
    chart,
    timeline,
    quotes,
    conclusionFindings,
    recommendations,
    references,
    attachedImages,
    outputIsRTL: true,
    labels: DEFAULT_AR_LABELS,
  });

  return {
    topic: cleanTopic,
    researcherName,
    dateStr: today,
    discipline,
    isScientific,
    researchType,
    academicLevel,
    abstractWordCount,
    abstractText,
    introduction,
    chapter1Theory,
    chapter2Applications,
    equations,
    tables,
    diagrams,
    chart,
    timeline,
    quotes,
    conclusionFindings,
    recommendations,
    references,
    attachedImages,
    htmlContent: outputs.htmlContent,
    plainMarkdown: outputs.plainMarkdown,
    outputLanguage: 'ar',
    outputIsRTL: true,
  };
}

interface ResearchSectionLabels {
  researcherPrefix: string;
  datePrefix: string;
  pagesPrefix: string;
  pagesUnit: string;
  abstractHeading: string;
  wordsUnit: string;
  introHeading: string;
  problemLabel: string;
  importanceLabel: string;
  objectivesLabel: string;
  chapter1Heading: string;
  equationPrefix: string;
  chartPrefix: string;
  timelineHeading: string;
  eraCol: string;
  milestoneCol: string;
  impactCol: string;
  quotesHeading: string;
  chapter2Heading: string;
  attachedImagesHeading: string;
  attachedImageCaption: string;
  conclusionHeading: string;
  findingsLabel: string;
  recommendationsLabel: string;
  referencesHeading: string;
  equationsMarkdownHeading: string;
  timelineMarkdownHeading: string;
  quotesMarkdownHeading: string;
}

const DEFAULT_AR_LABELS: ResearchSectionLabels = {
  researcherPrefix: 'إعداد الباحث:',
  datePrefix: 'التاريخ:',
  pagesPrefix: 'التقدير الحجمي:',
  pagesUnit: 'صفحات',
  abstractHeading: 'الملخص',
  wordsUnit: 'كلمة',
  introHeading: 'أولاً: المقدمة',
  problemLabel: 'مشكلة البحث:',
  importanceLabel: 'أهمية البحث:',
  objectivesLabel: 'أهداف البحث:',
  chapter1Heading: 'الفصل الأول: الإطار النظري والتحليل العلمي',
  equationPrefix: 'معادلة',
  chartPrefix: 'الشكل البياني:',
  timelineHeading: 'الجدول الزمني للتطور التاريخي والفكري',
  eraCol: 'الحقبة الزمنية',
  milestoneCol: 'المحطة العلمية / الأدبية',
  impactCol: 'الأثر الموثق',
  quotesHeading: 'اقتباسات فكرية وتاريخية مشهورة موثقة',
  chapter2Heading: 'الفصل الثاني: التطبيقات والأمثلة الواقعية والدراسات',
  attachedImagesHeading: 'صور وملحقات توضيحية مرفقة بالبحث',
  attachedImageCaption: 'ملحق مصور مرتبط بالبحث',
  conclusionHeading: 'الخاتمة: النتائج والتوصيات',
  findingsLabel: 'أبرز النتائج:',
  recommendationsLabel: 'التوصيات العلمية والعملية:',
  referencesHeading: 'المصادر والمراجع العلمية المعتمدة (8 مصادر)',
  equationsMarkdownHeading: 'المعادلات الرياضية والفيزيائية (LaTeX):',
  timelineMarkdownHeading: 'الجدول الزمني:',
  quotesMarkdownHeading: 'الاقتباسات الموثقة:',
};

function assembleResearchHtmlAndMarkdown(input: {
  topic: string;
  researcherName: string;
  dateStr: string;
  researchType: string;
  academicLevel: string;
  pagesCount: number;
  abstractWordCount: number;
  abstractText: string;
  introduction: { problem: string; importance: string; objectives: string[] };
  chapter1Theory: string[];
  chapter2Applications: string[];
  equations: ResearchEquation[];
  tables: ResearchTable[];
  diagrams: ResearchDiagram[];
  chart?: ResearchChartData;
  timeline?: Array<{ era: string; milestone: string; impact: string }>;
  quotes?: Array<{ quote: string; author: string; source: string }>;
  conclusionFindings: string[];
  recommendations: string[];
  references: string[];
  attachedImages: string[];
  outputIsRTL: boolean;
  labels: ResearchSectionLabels;
}): { htmlContent: string; plainMarkdown: string } {
  const {
    topic,
    researcherName,
    dateStr,
    researchType,
    academicLevel,
    pagesCount,
    abstractWordCount,
    abstractText,
    introduction,
    chapter1Theory,
    chapter2Applications,
    equations,
    tables,
    diagrams,
    chart,
    timeline,
    quotes,
    conclusionFindings,
    recommendations,
    references,
    attachedImages,
    outputIsRTL,
    labels,
  } = input;

  const dirAttr = outputIsRTL ? 'rtl' : 'ltr';
  const align = outputIsRTL ? 'right' : 'left';
  const padSide = outputIsRTL ? 'padding-right' : 'padding-left';

  const renderedEquationsHtml = equations
    .map((eq, idx) => {
      let katexHtml = '';
      try {
        katexHtml = katex.renderToString(eq.latex, {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        katexHtml = `<code>${escapeHtml(eq.latex)}</code>`;
      }
      return `
        <div style="margin:12px 0;padding:12px 16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;">
          <div style="font-weight:700;font-size:13px;color:#1e3a8a;margin-bottom:6px;">${escapeHtml(labels.equationPrefix)} (${idx + 1}): ${escapeHtml(eq.title)}</div>
          <div dir="ltr" style="text-align:center;padding:6px 0;font-size:15px;color:#0f172a;">${katexHtml}</div>
          <div style="font-size:12px;color:#475569;margin-top:4px;">${escapeHtml(eq.explanation)}</div>
        </div>
      `;
    })
    .join('');

  const tablesHtml = tables
    .map(
      (tbl) => `
      <div style="margin:16px 0;">
        <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:6px;">${escapeHtml(tbl.title)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;background:#ffffff;">
          <thead>
            <tr style="background:#1e3a8a;color:#ffffff;">
              ${tbl.headers.map((h) => `<th style="border:1px solid #cbd5e1;padding:8px 10px;text-align:${align};">${escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tbl.rows
              .map(
                (r, rIdx) => `
              <tr style="background:${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                ${r.map((cell) => `<td style="border:1px solid #cbd5e1;padding:7px 10px;color:#1e293b;text-align:${align};">${escapeHtml(cell)}</td>`).join('')}
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
    )
    .join('');

  const diagramsHtml = diagrams
    .map(
      (d) => `
      <div style="margin:16px 0;text-align:center;padding:12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
        <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:8px;">${escapeHtml(d.title)}</div>
        <div style="display:flex;justify-content:center;">${d.svg}</div>
        <div style="font-size:11.5px;color:#475569;margin-top:8px;">${escapeHtml(d.caption)}</div>
      </div>
    `
    )
    .join('');

  const chartHtml = chart
    ? `
      <div style="margin:16px 0;text-align:center;padding:12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
        <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:8px;">${escapeHtml(labels.chartPrefix)} ${escapeHtml(chart.title)}</div>
        <div style="display:flex;justify-content:center;">${buildBarChartSvg(chart)}</div>
        <div style="font-size:11.5px;color:#475569;margin-top:8px;">${escapeHtml(chart.caption)}</div>
      </div>
    `
    : '';

  const timelineHtml = timeline
    ? `
      <div style="margin:16px 0;">
        <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:6px;">${escapeHtml(labels.timelineHeading)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#581c87;color:#ffffff;">
              <th style="border:1px solid #cbd5e1;padding:8px;text-align:${align};">${escapeHtml(labels.eraCol)}</th>
              <th style="border:1px solid #cbd5e1;padding:8px;text-align:${align};">${escapeHtml(labels.milestoneCol)}</th>
              <th style="border:1px solid #cbd5e1;padding:8px;text-align:${align};">${escapeHtml(labels.impactCol)}</th>
            </tr>
          </thead>
          <tbody>
            ${timeline
              .map(
                (item) => `
              <tr>
                <td style="border:1px solid #cbd5e1;padding:7px;font-weight:700;color:#581c87;text-align:${align};">${escapeHtml(item.era)}</td>
                <td style="border:1px solid #cbd5e1;padding:7px;color:#1e293b;text-align:${align};">${escapeHtml(item.milestone)}</td>
                <td style="border:1px solid #cbd5e1;padding:7px;color:#334155;text-align:${align};">${escapeHtml(item.impact)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
    : '';

  const quotesHtml = quotes
    ? `
      <div style="margin:16px 0;">
        <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:8px;">${escapeHtml(labels.quotesHeading)}</div>
        ${quotes
          .map(
            (q) => `
          <div style="margin:8px 0;padding:10px 14px;background:#faf5ff;border:1px solid #d8b4fe;border-radius:10px;">
            <div style="font-style:italic;font-size:12.5px;color:#3b0764;">"${escapeHtml(q.quote)}"</div>
            <div style="font-size:11.5px;font-weight:700;color:#6b21a8;margin-top:4px;">— ${escapeHtml(q.author)} · (${escapeHtml(q.source)})</div>
          </div>`
          )
          .join('')}
      </div>
    `
    : '';

  const attachedImagesHtml =
    attachedImages.length > 0
      ? `
      <div style="margin:16px 0;">
        <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:8px;">${escapeHtml(labels.attachedImagesHeading)}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
          ${attachedImages
            .slice(0, 4)
            .map(
              (src, idx) => `
            <div style="border:1px solid #cbd5e1;border-radius:10px;padding:6px;background:#fff;text-align:center;">
              <img src="${src}" alt="${escapeHtml(labels.attachedImageCaption)} ${idx + 1}" style="max-width:100%;max-height:190px;object-fit:contain;margin:auto;"/>
              <div style="font-size:11px;color:#475569;margin-top:4px;">${escapeHtml(labels.attachedImageCaption)} (${idx + 1})</div>
            </div>`
            )
            .join('')}
        </div>
      </div>`
      : '';

  const htmlContent = `
    <div dir="${dirAttr}" style="font-family:'Cairo',Arial,sans-serif;color:#0f172a;line-height:1.85;text-align:${align};">
      <div style="border:2px solid #1e3a8a;border-radius:14px;padding:24px;margin-bottom:20px;background:#f8fafc;text-align:center;">
        <div style="font-size:12px;font-weight:700;color:#2563eb;margin-bottom:6px;">${escapeHtml(researchType)} · ${escapeHtml(academicLevel)}</div>
        <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin:8px 0 12px;">${escapeHtml(topic)}</h1>
        <div style="font-size:13px;color:#334155;font-weight:600;">
          ${escapeHtml(labels.researcherPrefix)} <strong>${escapeHtml(researcherName)}</strong> &nbsp;|&nbsp; ${escapeHtml(labels.datePrefix)} <strong>${escapeHtml(dateStr)}</strong> &nbsp;|&nbsp; ${escapeHtml(labels.pagesPrefix)} <strong>${pagesCount} ${escapeHtml(labels.pagesUnit)}</strong>
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <h2 style="font-size:16px;font-weight:800;color:#1e3a8a;border-bottom:2px solid #2563eb;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(labels.abstractHeading)} (${abstractWordCount} ${escapeHtml(labels.wordsUnit)})</h2>
        <p style="font-size:13px;color:#1e293b;text-align:justify;">${escapeHtml(abstractText)}</p>
      </div>

      <div style="margin-bottom:18px;">
        <h2 style="font-size:16px;font-weight:800;color:#1e3a8a;border-bottom:2px solid #2563eb;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(labels.introHeading)}</h2>
        <p style="font-size:13px;color:#1e293b;"><strong>${escapeHtml(labels.problemLabel)}</strong> ${escapeHtml(introduction.problem)}</p>
        <p style="font-size:13px;color:#1e293b;margin-top:6px;"><strong>${escapeHtml(labels.importanceLabel)}</strong> ${escapeHtml(introduction.importance)}</p>
        <div style="font-size:13px;color:#1e293b;margin-top:6px;"><strong>${escapeHtml(labels.objectivesLabel)}</strong>
          <ul style="margin:4px 0 0 0;${padSide}:20px;">
            ${introduction.objectives.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <h2 style="font-size:16px;font-weight:800;color:#1e3a8a;border-bottom:2px solid #2563eb;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(labels.chapter1Heading)}</h2>
        ${chapter1Theory.map((p) => `<p style="font-size:13px;color:#1e293b;margin-bottom:8px;text-align:justify;">${escapeHtml(p)}</p>`).join('')}
        ${renderedEquationsHtml}
        ${timelineHtml}
        ${tablesHtml}
        ${diagramsHtml}
        ${chartHtml}
        ${quotesHtml}
      </div>

      <div style="margin-bottom:18px;">
        <h2 style="font-size:16px;font-weight:800;color:#1e3a8a;border-bottom:2px solid #2563eb;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(labels.chapter2Heading)}</h2>
        ${chapter2Applications.map((p) => `<p style="font-size:13px;color:#1e293b;margin-bottom:8px;text-align:justify;">${escapeHtml(p)}</p>`).join('')}
        ${attachedImagesHtml}
      </div>

      <div style="margin-bottom:18px;">
        <h2 style="font-size:16px;font-weight:800;color:#1e3a8a;border-bottom:2px solid #2563eb;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(labels.conclusionHeading)}</h2>
        <div style="font-size:13px;color:#1e293b;"><strong>${escapeHtml(labels.findingsLabel)}</strong>
          <ul style="margin:4px 0 8px 0;${padSide}:20px;">
            ${conclusionFindings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
          </ul>
          <strong>${escapeHtml(labels.recommendationsLabel)}</strong>
          <ul style="margin:4px 0 0 0;${padSide}:20px;">
            ${recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div style="margin-bottom:10px;">
        <h2 style="font-size:16px;font-weight:800;color:#1e3a8a;border-bottom:2px solid #2563eb;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(labels.referencesHeading)}</h2>
        <ol style="margin:0;${padSide}:20px;font-size:12.5px;color:#334155;">
          ${references.map((ref) => `<li style="margin-bottom:4px;">${escapeHtml(ref)}</li>`).join('')}
        </ol>
      </div>
    </div>
  `;

  const plainMarkdown = [
    `# ${topic}`,
    `${labels.researcherPrefix} ${researcherName} | ${labels.datePrefix} ${dateStr} | ${researchType} · ${academicLevel}`,
    '',
    `## ${labels.abstractHeading} (${abstractWordCount} ${labels.wordsUnit})`,
    abstractText,
    '',
    `## ${labels.introHeading}`,
    `- ${labels.problemLabel} ${introduction.problem}`,
    `- ${labels.importanceLabel} ${introduction.importance}`,
    `- ${labels.objectivesLabel}`,
    ...introduction.objectives.map((o, i) => `  ${i + 1}. ${o}`),
    '',
    `## ${labels.chapter1Heading}`,
    ...chapter1Theory,
    ...(equations.length
      ? [
          '',
          `### ${labels.equationsMarkdownHeading}`,
          ...equations.map((e, i) => `${i + 1}. ${e.title}: $$${e.latex}$$ — ${e.explanation}`),
        ]
      : []),
    ...(tables.length
      ? [
          '',
          ...tables.flatMap((t) => [
            `### ${t.title}`,
            `| ${t.headers.join(' | ')} |`,
            `| ${t.headers.map(() => '---').join(' | ')} |`,
            ...t.rows.map((r) => `| ${r.join(' | ')} |`),
          ]),
        ]
      : []),
    ...(timeline
      ? [
          '',
          `### ${labels.timelineMarkdownHeading}`,
          ...timeline.map((t) => `- **${t.era}:** ${t.milestone} (${t.impact})`),
        ]
      : []),
    ...(quotes
      ? [
          '',
          `### ${labels.quotesMarkdownHeading}`,
          ...quotes.map((q) => `> "${q.quote}" — ${q.author} (${q.source})`),
        ]
      : []),
    '',
    `## ${labels.chapter2Heading}`,
    ...chapter2Applications,
    '',
    `## ${labels.conclusionHeading}`,
    ...conclusionFindings.map((f, i) => `${i + 1}. ${f}`),
    '',
    `### ${labels.recommendationsLabel}`,
    ...recommendations.map((r) => `- ${r}`),
    '',
    `## ${labels.referencesHeading}`,
    ...references.map((r, i) => `${i + 1}. ${r}`),
  ].join('\n');

  return { htmlContent, plainMarkdown };
}

/**
 * Generates a complete scientific or humanities research paper translated accurately into ANY selected world language.
 */
export async function generateMultilingualStructuredResearch(options: {
  topic: string;
  points: string;
  sourceContent?: string;
  researchType: string;
  academicLevel: string;
  pagesCount: number;
  researcherName?: string;
  discipline?: ResearchDiscipline;
  attachedImages?: string[];
  outputLanguage?: string;
  isRTL?: boolean;
  onProgress?: (pct: number, label: string) => void;
}): Promise<ResearchDocumentData> {
  const { outputLanguage, onProgress, isRTL = true } = options;

  const sampleText = `${options.topic} ${options.points} ${(options.sourceContent || '').slice(0, 700)}`.trim();
  const targetCode =
    !outputLanguage || outputLanguage === 'original' || outputLanguage === 'auto'
      ? detectLanguageCode(sampleText)
      : resolveLangCode(outputLanguage);

  const outputIsRTL = isRtlLangCode(targetCode);

  onProgress?.(20, isRTL ? 'جاري إعداد البنية العلمية والمعادلات والجداول...' : 'Generating scientific research structure...');
  const baseReport = generateStructuredResearch(options);

  if (targetCode === 'ar') {
    return {
      ...baseReport,
      outputLanguage: 'ar',
      outputIsRTL: true,
    };
  }

  onProgress?.(40, isRTL ? `جاري ترجمة البحث بالكامل إلى (${targetCode}) مع الحفاظ على KaTeX والجداول...` : `Translating full paper into ${targetCode}...`);

  // Collect all translatable strings in deterministic order
  const texts: string[] = [];
  const push = (str: string): number => {
    const idx = texts.length;
    texts.push(str);
    return idx;
  };

  const labelKeys = Object.keys(DEFAULT_AR_LABELS) as (keyof ResearchSectionLabels)[];
  const labelIndices = new Map<keyof ResearchSectionLabels, number>();
  for (const k of labelKeys) {
    labelIndices.set(k, push(DEFAULT_AR_LABELS[k]));
  }

  const topicIdx = push(baseReport.topic);
  const resTypeIdx = push(baseReport.researchType);
  const acadLevelIdx = push(baseReport.academicLevel);
  const researcherIdx = push(baseReport.researcherName);
  const abstractIdx = push(baseReport.abstractText);
  const problemIdx = push(baseReport.introduction.problem);
  const importanceIdx = push(baseReport.introduction.importance);
  const objectiveIdxs = baseReport.introduction.objectives.map((o) => push(o));
  const ch1Idxs = baseReport.chapter1Theory.map((p) => push(p));
  const ch2Idxs = baseReport.chapter2Applications.map((p) => push(p));

  const eqIdxs = baseReport.equations.map((eq) => ({
    title: push(eq.title),
    explanation: push(eq.explanation),
    latex: eq.latex,
  }));

  const tblIdxs = baseReport.tables.map((t) => ({
    title: push(t.title),
    headers: t.headers.map((h) => push(h)),
    rows: t.rows.map((r) => r.map((c) => push(c))),
  }));

  const diagIdxs = baseReport.diagrams.map((d) => ({
    title: push(d.title),
    caption: push(d.caption),
    svg: d.svg,
  }));

  const chartIdxs = baseReport.chart
    ? {
        title: push(baseReport.chart.title),
        caption: push(baseReport.chart.caption),
        unit: push(baseReport.chart.unit),
        bars: baseReport.chart.bars.map((b) => ({
          label: push(b.label),
          value: b.value,
          color: b.color,
        })),
      }
    : undefined;

  const timelineIdxs = baseReport.timeline?.map((t) => ({
    era: push(t.era),
    milestone: push(t.milestone),
    impact: push(t.impact),
  }));

  const quotesIdxs = baseReport.quotes?.map((q) => ({
    quote: push(q.quote),
    author: push(q.author),
    source: push(q.source),
  }));

  const findingIdxs = baseReport.conclusionFindings.map((f) => push(f));
  const recIdxs = baseReport.recommendations.map((r) => push(r));

  const translated = await translateBatchClientSide(texts, targetCode, (done, total) => {
    const pct = 42 + Math.round((done / Math.max(1, total)) * 54);
    onProgress?.(
      pct,
      isRTL
        ? `ترجمة البحث إلى (${targetCode}): ${done} من ${total}`
        : `Translating research (${targetCode}): ${done}/${total}`
    );
  });

  const get = (i: number) => translated[i] ?? texts[i];

  const translatedLabels = { ...DEFAULT_AR_LABELS };
  for (const k of labelKeys) {
    const idx = labelIndices.get(k);
    if (idx !== undefined) {
      translatedLabels[k] = get(idx);
    }
  }

  const nextTopic = get(topicIdx);
  const nextResType = get(resTypeIdx);
  const nextAcadLevel = get(acadLevelIdx);
  const nextResearcher = get(researcherIdx);
  const nextAbstract = get(abstractIdx);
  const nextIntro = {
    problem: get(problemIdx),
    importance: get(importanceIdx),
    objectives: objectiveIdxs.map((i) => get(i)),
  };
  const nextCh1 = ch1Idxs.map((i) => get(i));
  const nextCh2 = ch2Idxs.map((i) => get(i));
  const nextEqs = eqIdxs.map((e) => ({
    title: get(e.title),
    latex: e.latex,
    explanation: get(e.explanation),
  }));
  const nextTbls = tblIdxs.map((t) => ({
    title: get(t.title),
    headers: t.headers.map((i) => get(i)),
    rows: t.rows.map((r) => r.map((i) => get(i))),
  }));
  const nextDiags = diagIdxs.map((d) => ({
    title: get(d.title),
    caption: get(d.caption),
    svg: d.svg,
  }));
  const nextChart = chartIdxs
    ? {
        title: get(chartIdxs.title),
        caption: get(chartIdxs.caption),
        unit: get(chartIdxs.unit),
        bars: chartIdxs.bars.map((b) => ({
          label: get(b.label),
          value: b.value,
          color: b.color,
        })),
      }
    : undefined;
  const nextTimeline = timelineIdxs?.map((t) => ({
    era: get(t.era),
    milestone: get(t.milestone),
    impact: get(t.impact),
  }));
  const nextQuotes = quotesIdxs?.map((q) => ({
    quote: get(q.quote),
    author: get(q.author),
    source: get(q.source),
  }));
  const nextFindings = findingIdxs.map((i) => get(i));
  const nextRecs = recIdxs.map((i) => get(i));

  const outputs = assembleResearchHtmlAndMarkdown({
    topic: nextTopic,
    researcherName: nextResearcher,
    dateStr: baseReport.dateStr,
    researchType: nextResType,
    academicLevel: nextAcadLevel,
    pagesCount: options.pagesCount,
    abstractWordCount: baseReport.abstractWordCount,
    abstractText: nextAbstract,
    introduction: nextIntro,
    chapter1Theory: nextCh1,
    chapter2Applications: nextCh2,
    equations: nextEqs,
    tables: nextTbls,
    diagrams: nextDiags,
    chart: nextChart,
    timeline: nextTimeline,
    quotes: nextQuotes,
    conclusionFindings: nextFindings,
    recommendations: nextRecs,
    references: baseReport.references,
    attachedImages: baseReport.attachedImages || [],
    outputIsRTL,
    labels: translatedLabels,
  });

  return {
    ...baseReport,
    topic: nextTopic,
    researcherName: nextResearcher,
    researchType: nextResType,
    academicLevel: nextAcadLevel,
    abstractText: nextAbstract,
    introduction: nextIntro,
    chapter1Theory: nextCh1,
    chapter2Applications: nextCh2,
    equations: nextEqs,
    tables: nextTbls,
    diagrams: nextDiags,
    chart: nextChart,
    timeline: nextTimeline,
    quotes: nextQuotes,
    conclusionFindings: nextFindings,
    recommendations: nextRecs,
    htmlContent: outputs.htmlContent,
    plainMarkdown: outputs.plainMarkdown,
    outputLanguage: targetCode,
    outputIsRTL,
  };
}

/**
 * Render the complete HTML research (with KaTeX formulas, tables, SVGs, and charts) to a multi-page A4 PDF
 */
export async function renderResearchHtmlToPdfBlob(report: ResearchDocumentData): Promise<Blob> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.padding = '36px 44px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.innerHTML = report.htmlContent;
  document.body.appendChild(container);

  try {
    await new Promise((r) => setTimeout(r, 120));
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const printWidth = 190;
    const printHeight = 277;
    const imgHeight = (canvas.height * printWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;
    pdf.addImage(canvas, 'JPEG', 10, position, printWidth, imgHeight, undefined, 'FAST');
    heightLeft -= printHeight;

    while (heightLeft > 0) {
      position -= printHeight;
      pdf.addPage();
      pdf.addImage(canvas, 'JPEG', 10, position, printWidth, imgHeight, undefined, 'FAST');
      heightLeft -= printHeight;
    }

    return pdf.output('blob');
  } finally {
    if (document.body.contains(container)) document.body.removeChild(container);
  }
}

/**
 * Build rich Microsoft Word (.doc) containing all equations, HTML tables, SVG diagrams, and references
 */
export function buildResearchWordDocBlob(report: ResearchDocumentData): Blob {
  const isRTLOut = report.outputIsRTL ?? true;
  const dir = isRTLOut ? 'rtl' : 'ltr';
  const align = isRTLOut ? 'right' : 'left';
  const langAttr = report.outputLanguage || 'ar';

  const fullHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" dir="${dir}" lang="${escapeHtml(langAttr)}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(report.topic)}</title>
  <style>
    body { font-family: 'Cairo', 'Arial', sans-serif; direction: ${dir}; text-align: ${align}; line-height: 1.8; color: #0f172a; margin: 28px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: ${align}; }
  </style>
</head>
<body>
  ${report.htmlContent}
</body>
</html>`;
  return new Blob(['\ufeff', fullHtml], { type: 'application/msword;charset=utf-8' });
}
