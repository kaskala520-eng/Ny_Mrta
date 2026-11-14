import React from 'react';
import { 
  Languages, 
  ListChecks, 
  ArrowLeftRight, 
  Mic, 
  Image as ImageIcon, 
  GraduationCap 
} from 'lucide-react';
import { ServiceType } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface ServiceCardsProps {
  onSelectService: (service: ServiceType) => void;
  activeService?: ServiceType | null;
}

export const ServiceCards: React.FC<ServiceCardsProps> = ({
  onSelectService,
  activeService,
}) => {
  const { t } = useLanguage();

  const services = [
    {
      id: 'translate' as ServiceType,
      title: t.serviceTranslate,
      icon: Languages,
      iconBg: 'bg-teal-500/10 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/20 dark:border-teal-500/30',
      hoverBorder: 'hover:border-teal-400 dark:hover:border-teal-500/70 hover:shadow-teal-500/10',
    },
    {
      id: 'questions' as ServiceType,
      title: t.serviceQuestions,
      icon: ListChecks,
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30',
      hoverBorder: 'hover:border-amber-400 dark:hover:border-amber-500/70 hover:shadow-amber-500/10',
    },
    {
      id: 'convert' as ServiceType,
      title: t.serviceConvert,
      icon: ArrowLeftRight,
      iconBg: 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30',
      hoverBorder: 'hover:border-blue-400 dark:hover:border-blue-500/70 hover:shadow-blue-500/10',
    },
    {
      id: 'voice' as ServiceType,
      title: t.serviceVoice,
      icon: Mic,
      iconBg: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/30',
      hoverBorder: 'hover:border-rose-400 dark:hover:border-rose-500/70 hover:shadow-rose-500/10',
    },
    {
      id: 'image' as ServiceType,
      title: t.serviceImage,
      icon: ImageIcon,
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30',
      hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-500/70 hover:shadow-emerald-500/10',
    },
    {
      id: 'research' as ServiceType,
      title: t.serviceResearch,
      icon: GraduationCap,
      iconBg: 'bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 dark:border-purple-500/30',
      hoverBorder: 'hover:border-purple-400 dark:hover:border-purple-500/70 hover:shadow-purple-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 my-6">
      {services.map((srv) => {
        const Icon = srv.icon;
        const isSelected = activeService === srv.id;

        return (
          <button
            key={srv.id}
            onClick={() => onSelectService(srv.id)}
            className={`flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border text-center transition-all duration-200 group shadow-xs cursor-pointer ${
              isSelected
                ? 'border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20 dark:ring-blue-500/30 shadow-md'
                : `border-slate-200/90 dark:border-slate-800 ${srv.hoverBorder} hover:shadow-md dark:hover:bg-slate-800/70 hover:-translate-y-0.5`
            }`}
          >
            {/* Round / Soft-square colored icon */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${srv.iconBg}`}>
              <Icon className="w-6 h-6" />
            </div>

            {/* Label */}
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {srv.title}
            </span>
          </button>
        );
      })}
    </div>
  );
};
