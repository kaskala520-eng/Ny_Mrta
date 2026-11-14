import React from 'react';
import { Terminal, CheckCircle2, AlertCircle, Clock, Copy, Check, Trash2 } from 'lucide-react';

export interface DiagnosticEvent {
  text: string;
  time: string;
  type: 'info' | 'success' | 'error' | 'pending';
  details?: string;
}

interface DiagnosticLoggerProps {
  events: DiagnosticEvent[];
  onClear?: () => void;
  title?: string;
  placeholderText?: string;
}

export const DiagnosticLogger: React.FC<DiagnosticLoggerProps> = ({
  events,
  onClear,
  title = 'سجل تشخيص Gemini API (Diagnostic Logger)',
  placeholderText = 'سجل الاتصال جاهز. عند الضغط على زر الإجراء، سيتم تسجيل أحداث الاتصال في الوقت الفعلي خطوة بخطوة.',
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyLogs = () => {
    if (events.length === 0) return;
    const logContent = events
      .map((e) => `[${e.time}] [${e.type.toUpperCase()}] ${e.text}${e.details ? `\nDetails: ${e.details}` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(logContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasErrors = events.some((e) => e.type === 'error');

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#070d1e] text-slate-200 p-3.5 sm:p-4 font-mono text-xs shadow-xl transition-all">
      {/* Logger Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-100 text-xs tracking-tight">
            {title}
          </span>
          {hasErrors && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
              خطأ في الاتصال
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {events.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleCopyLogs}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] transition-colors cursor-pointer"
                title="نسخ السجل"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>

              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-[10px] transition-colors cursor-pointer"
                  title="مسح السجل"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </>
          )}

          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 font-sans">
            {events.length} {events.length === 1 ? 'حدث' : 'أحداث'}
          </span>
        </div>
      </div>

      {/* Events Stream */}
      {events.length === 0 ? (
        <div className="text-slate-400 text-[11px] py-2 text-right leading-relaxed flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>{placeholderText}</span>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-52 overflow-y-auto text-right pr-1 select-text">
          {events.map((log, idx) => {
            const isErr = log.type === 'error';
            const isSucc = log.type === 'success';
            const isPend = log.type === 'pending';

            return (
              <div
                key={idx}
                className={`p-2 rounded-xl text-[11px] flex flex-col gap-1 border transition-all ${
                  isErr
                    ? 'bg-rose-950/70 border-rose-800/80 text-rose-200'
                    : isSucc
                    ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
                    : isPend
                    ? 'bg-amber-950/60 border-amber-800/80 text-amber-200'
                    : 'bg-slate-900/90 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5">
                    {isErr && <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />}
                    {isSucc && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />}
                    {isPend && <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0 animate-pulse" />}
                    {!isErr && !isSucc && !isPend && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    )}
                    <span className="font-medium break-words leading-relaxed">{log.text}</span>
                  </div>

                  <span className="text-[9px] text-slate-400 shrink-0 font-sans opacity-80 pt-0.5">
                    {log.time}
                  </span>
                </div>

                {log.details && (
                  <pre className="mt-1 p-2 rounded-lg bg-black/40 border border-white/5 text-[10px] text-slate-300 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                    {log.details}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
