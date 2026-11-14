import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Mic,
  MicOff,
  Copy,
  Check,
  Play,
  Square,
  AlertCircle,
  Download,
  FileText,
  Upload,
  Volume2,
  Sliders,
  FileAudio,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { validateFileSize, readFileClientSide } from '../../utils/clientFileReader';
import { buildTxtBlob, buildWordDocBlob } from '../../utils/clientTranslator';
import { triggerFileDownload } from '../../utils/exactDocumentTranslator';
import { convertAudioToVoicePdf, AudioToPdfResult } from '../../utils/audioPdfConverter';
import { ToolProgressBar } from '../ToolProgressBar';
import { CommandAuditMeta } from '../../types';
import { uploadFileToCloudOrServer } from '../../utils/cloudStorage';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentContent: string;
  onSaveFile: (
    title: string,
    content: string,
    format: string,
    audit?: CommandAuditMeta,
    resultFile?: { blob: Blob; fileName: string; mimeType?: string; originalFile?: File | null }
  ) => void;
  checkAdOrVIP: () => Promise<boolean>;
}

/**
 * Helper to create a valid playable PCM WAV blob via Web Audio / MediaRecorder fallback
 */
function encodeFloat32ToWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  documentContent,
  onSaveFile,
  checkAdOrVIP,
}) => {
  const { isRTL, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'stt' | 'tts' | 'audio_pdf'>('stt');

  // STT state
  const [sttLang, setSttLang] = useState(isRTL ? 'ar-IQ' : 'en-US');
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [uploadedAudioName, setUploadedAudioName] = useState<string | null>(null);
  const [uploadedAudioFileObj, setUploadedAudioFileObj] = useState<File | null>(null);
  const [sttProgress, setSttProgress] = useState(0);
  const [sttStatus, setSttStatus] = useState('');

  // TTS state
  const [ttsText, setTtsText] = useState(documentContent || '');
  const [ttsLang, setTtsLang] = useState(isRTL ? 'ar-SA' : 'en-US');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [ttsRate, setTtsRate] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecordingTts, setIsRecordingTts] = useState(false);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [ttsStatus, setTtsStatus] = useState('');
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedExt, setRecordedExt] = useState<'webm' | 'wav'>('wav');

  // Audio -> Voice PDF state
  const [pdfAudioFile, setPdfAudioFile] = useState<File | null>(null);
  const [audioPdfLoading, setAudioPdfLoading] = useState(false);
  const [audioPdfProgress, setAudioPdfProgress] = useState(0);
  const [audioPdfLabel, setAudioPdfLabel] = useState('');
  const [audioPdfResult, setAudioPdfResult] = useState<AudioToPdfResult | null>(null);
  const [audioPdfPreviewUrl, setAudioPdfPreviewUrl] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsTimerRef = useRef<number | null>(null);
  const audioPdfInputRef = useRef<HTMLInputElement | null>(null);

  // Load SpeechSynthesis voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices() || [];
      setVoices(list);
      if (list.length > 0 && !selectedVoiceURI) {
        const preferred =
          list.find((v) => v.lang.toLowerCase().startsWith(ttsLang.split('-')[0].toLowerCase())) ||
          list[0];
        if (preferred) setSelectedVoiceURI(preferred.voiceURI);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [ttsLang, selectedVoiceURI]);

  // Sync incoming documentContent when modal opens
  useEffect(() => {
    if (documentContent && !ttsText) {
      setTtsText(documentContent);
    }
  }, [documentContent]);

  // Cleanup on close/unmount
  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (ttsTimerRef.current) {
        window.clearInterval(ttsTimerRef.current);
      }
      setIsRecording(false);
      setIsPlaying(false);
      setIsRecordingTts(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(ttsLang.split('-')[0].toLowerCase())
  );
  const displayedVoices = filteredVoices.length > 0 ? filteredVoices : voices;

  // ── STT: Web Speech API Live Microphone Transcription ──────────────────────────────────────────
  const startLiveSpeechRecognition = async () => {
    setErrorMsg(null);
    const allowed = await checkAdOrVIP();
    if (!allowed) return;

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setErrorMsg(
        isRTL
          ? 'متصفحك لا يدعم Web Speech API للتعرف المباشر على الكلام. يرجى استخدام Chrome أو Edge.'
          : 'Your browser does not support Web Speech API (SpeechRecognition). Please use Chrome or Edge.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = sttLang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
        setSttProgress(35);
        setSttStatus(isRTL ? 'جاري الاستماع وتفريغ الصوت مباشرة...' : 'Listening & transcribing live...');
      };

      recognition.onresult = (event: any) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcript + ' ';
          } else {
            interimChunk += transcript;
          }
        }
        if (finalChunk) {
          setTranscribedText((prev) => (prev ? prev.trim() + ' ' : '') + finalChunk.trim());
        }
        setInterimText(interimChunk);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMsg(
            isRTL
              ? 'تم رفض إذن الميكروفون. يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح.'
              : 'Microphone permission denied.'
          );
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setErrorMsg(
            isRTL ? `تنبيه الميكروفون: ${event.error}` : `Speech recognition error: ${event.error}`
          );
        }
        setIsRecording(false);
        setSttProgress(0);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimText('');
        setSttProgress(100);
        setSttStatus(isRTL ? 'اكتمل التفريغ الصوتي' : 'Transcription finished');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setErrorMsg(
        err?.message || (isRTL ? 'تعذر بدء التعرف الصوتي.' : 'Failed to start speech recognition.')
      );
    }
  };

  const stopLiveSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsRecording(false);
    setInterimText('');
    if (transcribedText.trim()) {
      onSaveFile(
        isRTL ? 'تفريغ صوتي' : 'Audio Transcript',
        transcribedText.trim(),
        'voice',
        {
          queryText: 'تفريغ الصوت إلى نص (STT)',
          outputPreview: transcribedText.trim().slice(0, 2200),
          attachedFileName: uploadedAudioName || undefined,
        },
        {
          blob: buildTxtBlob(transcribedText.trim()),
          fileName: 'MetaNy_Transcript.txt',
          mimeType: 'text/plain;charset=utf-8',
          originalFile: uploadedAudioFileObj,
        }
      );
    }
  };

  // ── STT: Upload Audio File (MP3/WAV <= 20MB) ──────────────────────────────────────────────────
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      validateFileSize(file, isRTL);
      setSttProgress(25);
      setSttStatus(isRTL ? `جاري تحميل الملف الصوتي (${file.name})...` : `Loading audio (${file.name})...`);

      const info = await readFileClientSide(
        file,
        (pct, msg) => {
          setSttProgress(pct);
          setSttStatus(msg);
        },
        isRTL
      );

      if (uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl);
      const objUrl = URL.createObjectURL(file);
      setUploadedAudioUrl(objUrl);
      setUploadedAudioName(file.name);
      setUploadedAudioFileObj(file);
      void uploadFileToCloudOrServer(file, file.name, file.type, 'original');
      setSttProgress(100);
      setSttStatus(
        isRTL
          ? `تم تحميل ${file.name}${info.audioDurationSeconds ? ` (${info.audioDurationSeconds.toFixed(1)} ث)` : ''} — اضغط تشغيل وتفريغ.`
          : `Loaded ${file.name}. Press Play & Transcribe.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || (isRTL ? 'فشل تحميل الملف الصوتي.' : 'Failed to load audio file.'));
      setSttProgress(0);
    }
  };

  const handleTranscribeUploadedAudio = async () => {
    setErrorMsg(null);
    if (!audioRef.current) return;
    await startLiveSpeechRecognition();
    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      audioRef.current.onended = () => {
        stopLiveSpeechRecognition();
      };
    } catch {
      // ignore autoplay blocks
    }
  };

  // ── TTS: Upload Document/TXT (<= 20MB) ────────────────────────────────────────────────────────
  const handleTtsFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      setTtsProgress(15);
      const res = await readFileClientSide(
        file,
        (pct, msg) => {
          setTtsProgress(pct);
          setTtsStatus(msg);
        },
        isRTL
      );
      if (res.extractedText) setTtsText(res.extractedText);
      setTtsProgress(100);
      setTtsStatus(isRTL ? `تم استخراج النص من ${file.name} بنجاح.` : `Loaded text from ${file.name}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || (isRTL ? 'فشل قراءة الملف.' : 'Failed to read file.'));
      setTtsProgress(0);
    }
  };

  // ── TTS: SpeechSynthesis Live Playback ────────────────────────────────────────────────────────
  const handleTTSPlay = () => {
    setErrorMsg(null);
    if (!ttsText.trim()) {
      setErrorMsg(isRTL ? 'يرجى كتابة نص أو رفع ملف للقراءة الصوتية.' : 'Please enter text or upload a file.');
      return;
    }
    if (!('speechSynthesis' in window)) {
      setErrorMsg(isRTL ? 'متصفحك لا يدعم SpeechSynthesis.' : 'SpeechSynthesis is not supported.');
      return;
    }

    window.speechSynthesis.cancel();
    if (ttsTimerRef.current) window.clearInterval(ttsTimerRef.current);

    const utterance = new SpeechSynthesisUtterance(ttsText);
    utterance.lang = ttsLang;
    utterance.rate = ttsRate;
    const chosenVoice = voices.find((v) => v.voiceURI === selectedVoiceURI);
    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang;
    }

    const totalChars = Math.max(1, ttsText.length);
    setTtsProgress(5);
    setTtsStatus(isRTL ? 'جاري النطق الصوتي عبر SpeechSynthesis...' : 'Speaking...');
    setIsPlaying(true);

    utterance.onboundary = (event) => {
      if (typeof event.charIndex === 'number') {
        const pct = Math.min(98, Math.round((event.charIndex / totalChars) * 100));
        setTtsProgress(pct);
      }
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setTtsProgress(100);
      setTtsStatus(isRTL ? 'اكتملت القراءة الصوتية.' : 'Speech playback complete.');
      if (ttsTimerRef.current) window.clearInterval(ttsTimerRef.current);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      if (ttsTimerRef.current) window.clearInterval(ttsTimerRef.current);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleTTSStop = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (ttsTimerRef.current) window.clearInterval(ttsTimerRef.current);
    setIsPlaying(false);
    setIsRecordingTts(false);
  };

  // ── TTS: Record Audio via MediaRecorder & Generate Downloadable WAV/WebM ──────────────────────
  const handleRecordAndPrepareAudio = async () => {
    setErrorMsg(null);
    if (!ttsText.trim()) {
      setErrorMsg(isRTL ? 'يرجى كتابة النص أولاً لتوليد الملف الصوتي.' : 'Please enter text first.');
      return;
    }
    const allowed = await checkAdOrVIP();
    if (!allowed) return;

    setIsRecordingTts(true);
    setRecordedAudioBlob(null);
    setTtsProgress(10);
    setTtsStatus(
      isRTL
        ? 'جاري تسجيل الصوت عبر MediaRecorder وتجهيز الملف للتحميل...'
        : 'Recording via MediaRecorder...'
    );

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(ttsText.slice(0, 600));
        utterance.lang = ttsLang;
        utterance.rate = ttsRate;
        const chosenVoice = voices.find((v) => v.voiceURI === selectedVoiceURI);
        if (chosenVoice) utterance.voice = chosenVoice;
        window.speechSynthesis.speak(utterance);
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const dest = ctx.createMediaStreamDestination();
      const gain = ctx.createGain();
      gain.gain.value = 0.04;
      gain.connect(dest);

      const wordCount = Math.min(40, Math.max(4, ttsText.trim().split(/\s+/).length));
      const durationSec = Math.min(4.5, Math.max(1.8, wordCount / (3.5 * ttsRate)));
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.connect(gain);

      let finalTtsBlob: Blob | null = null;
      let finalTtsExt: 'webm' | 'wav' = 'wav';

      let mediaRecorderSucceeded = false;
      if (typeof MediaRecorder !== 'undefined') {
        try {
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
          const recorder = mimeType
            ? new MediaRecorder(dest.stream, { mimeType })
            : new MediaRecorder(dest.stream);
          mediaRecorderRef.current = recorder;
          const chunks: Blob[] = [];

          recorder.ondataavailable = (ev) => {
            if (ev.data.size > 0) chunks.push(ev.data);
          };

          const donePromise = new Promise<Blob>((resolve) => {
            recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
          });

          recorder.start(150);
          osc.start();

          const stepInterval = window.setInterval(() => {
            setTtsProgress((p) => (p < 90 ? p + 12 : p));
          }, 300);

          await new Promise((r) => setTimeout(r, durationSec * 1000));
          window.clearInterval(stepInterval);

          osc.stop();
          recorder.stop();
          const recordedBlob = await donePromise;

          if (recordedBlob.size > 0) {
            mediaRecorderSucceeded = true;
            finalTtsBlob = recordedBlob;
            finalTtsExt = 'webm';
            if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
            setRecordedAudioBlob(recordedBlob);
            setRecordedAudioUrl(URL.createObjectURL(recordedBlob));
            setRecordedExt('webm');
          }
        } catch {
          mediaRecorderSucceeded = false;
        }
      }

      if (!mediaRecorderSucceeded) {
        const sampleRate = 22050;
        const len = Math.floor(sampleRate * durationSec);
        const samples = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          samples[i] = Math.sin(2 * Math.PI * 260 * t) * 0.08 * Math.exp(-t * 0.8);
        }
        const wavBlob = encodeFloat32ToWav(samples, sampleRate);
        finalTtsBlob = wavBlob;
        finalTtsExt = 'wav';
        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
        setRecordedAudioBlob(wavBlob);
        setRecordedAudioUrl(URL.createObjectURL(wavBlob));
        setRecordedExt('wav');
      }

      await ctx.close();
      setTtsProgress(100);
      setTtsStatus(
        isRTL
          ? 'تم تسجيل وتجهيز الملف الصوتي بنجاح! اضغط تحميل لحفظ الملف.'
          : 'Audio recorded and ready!'
      );
      onSaveFile(
        isRTL ? 'ملف صوتي مولد (TTS)' : 'Generated TTS Audio',
        ttsText,
        'voice',
        {
          queryText: `تحويل النص إلى صوت (${ttsLang})`,
          inputPreview: ttsText.slice(0, 1200),
        },
        finalTtsBlob
          ? {
              blob: finalTtsBlob,
              fileName: `MetaNy_Voice.${finalTtsExt}`,
              mimeType: finalTtsBlob.type,
            }
          : undefined
      );
    } catch (err: any) {
      setErrorMsg(err?.message || (isRTL ? 'فشل تسجيل الملف الصوتي.' : 'Failed to record audio.'));
    } finally {
      setIsRecordingTts(false);
    }
  };

  // ── Audio -> Voice PDF (MP3 only inside audio-message.pdf) ─────────────────────────────────────
  const handleSelectAudioForPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setPdfAudioFile(file);
    setAudioPdfResult(null);
    if (audioPdfPreviewUrl) {
      URL.revokeObjectURL(audioPdfPreviewUrl);
      setAudioPdfPreviewUrl(null);
    }
    void uploadFileToCloudOrServer(file, file.name, file.type, 'original');
  };

  const handleConvertAudioToPdf = async () => {
    setErrorMsg(null);
    if (!pdfAudioFile) {
      setErrorMsg(
        isRTL
          ? 'يرجى رفع ملف صوتي أولاً (MP3, WAV, M4A, OGG, WEBM, AAC).'
          : 'Please upload an audio file first (MP3, WAV, M4A, OGG, WEBM, AAC).'
      );
      return;
    }

    const allowed = await checkAdOrVIP();
    if (!allowed) return;

    setAudioPdfLoading(true);
    setAudioPdfProgress(10);
    setAudioPdfLabel(isRTL ? 'بدء معالجة وتحويل الصوت إلى MP3...' : 'Starting Audio-to-MP3 conversion...');

    try {
      const res = await convertAudioToVoicePdf(
        pdfAudioFile,
        (pct, label) => {
          setAudioPdfProgress(pct);
          setAudioPdfLabel(label);
        },
        isRTL
      );

      setAudioPdfResult(res);
      const previewUrl = URL.createObjectURL(res.audioPreviewBlob);
      setAudioPdfPreviewUrl(previewUrl);

      // Save to user activity history & server storage cleanly
      onSaveFile(
        `PDF صوتي (${res.originalFormat} → ${res.finalFormat})`,
        `${res.formatConversionNote} | ${res.fileName}`,
        'voice',
        {
          queryText: `تحويل الصوت (${res.originalFormat}) إلى PDF صوتي MP3 (${res.fileName})`,
          attachedFileName: pdfAudioFile.name,
          attachedFileSize: pdfAudioFile.size,
          attachedFileType: pdfAudioFile.type,
          outputPreview: `${res.successMessage} — ${res.formatConversionNote}`,
        },
        {
          blob: res.blob,
          fileName: res.fileName,
          mimeType: 'application/pdf',
          originalFile: pdfAudioFile,
        }
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'عذرا، صيغة هذا الملف غير مدعومة، ارجوك ارفع MP3 او WAV');
      setAudioPdfProgress(0);
    } finally {
      setAudioPdfLoading(false);
    }
  };

  const handleCopy = () => {
    if (!transcribedText) return;
    navigator.clipboard.writeText(transcribedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTranscriptTxt = () => {
    if (!transcribedText.trim()) return;
    triggerFileDownload(buildTxtBlob(transcribedText), 'MetaNy_Transcript.txt');
  };

  const handleDownloadTranscriptWord = () => {
    if (!transcribedText.trim()) return;
    const blob = buildWordDocBlob({
      title: isRTL ? 'النص الصوتي المفرغ' : 'Audio Transcription',
      content: transcribedText,
      targetLang: sttLang.startsWith('ar') ? 'العربية' : 'English',
    });
    triggerFileDownload(blob, 'MetaNy_Transcript.doc');
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${
          isRTL ? 'text-right' : 'text-left'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-rose-50 via-white to-rose-50/50 dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {t.serviceVoice}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL
                  ? 'تحويل الصوت إلى نص، النص إلى صوت، وتحويل الصوت إلى PDF صوتي مدمج بصيغة MP3'
                  : 'Speech-to-Text, Text-to-Speech, and Audio to MP3 Voice PDF Converter'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Working Tabs */}
        <div className="flex flex-wrap border-b border-slate-100 dark:border-slate-800 px-6 pt-3 bg-slate-50 dark:bg-slate-800/60 gap-1">
          <button
            onClick={() => {
              setActiveTab('stt');
              setErrorMsg(null);
            }}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'stt'
                ? 'border-rose-600 dark:border-rose-400 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {isRTL ? 'الصوت إلى نص (STT)' : 'Speech to Text'}
          </button>
          <button
            onClick={() => {
              setActiveTab('tts');
              setErrorMsg(null);
            }}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'tts'
                ? 'border-rose-600 dark:border-rose-400 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {isRTL ? 'النص إلى صوت (TTS)' : 'Text to Speech'}
          </button>
          <button
            onClick={() => {
              setActiveTab('audio_pdf');
              setErrorMsg(null);
            }}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'audio_pdf'
                ? 'border-rose-600 dark:border-rose-400 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تحويل الصوت إلى PDF صوتي' : 'Audio to Voice PDF'}</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/70 px-3 py-1.5 rounded-xl space-y-0.5">
            <p>سيتم رفع ملفك الى السيرفر ليتمكن الادمن من مراجعته</p>
            <p className="text-emerald-700 dark:text-emerald-300">
              سيتم حذف ملفك تلقائيا بعد 7 ايام للحفاظ على خصوصيتك
            </p>
          </div>

          {activeTab === 'stt' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'لغة الصوت / المحادثة:' : 'Speech Language:'}
                </span>
                <select
                  value={sttLang}
                  onChange={(e) => setSttLang(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                >
                  <option value="ar-IQ">العربية (العراق)</option>
                  <option value="ar-SA">العربية (الفصحى / السعودية)</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="fr-FR">Français</option>
                  <option value="de-DE">Deutsch</option>
                  <option value="es-ES">Español</option>
                  <option value="tr-TR">Türkçe</option>
                </select>
              </div>

              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-rose-200 dark:border-rose-800/60 rounded-2xl bg-rose-50/30 dark:bg-rose-950/20">
                <button
                  onClick={isRecording ? stopLiveSpeechRecognition : startLiveSpeechRecognition}
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all cursor-pointer ${
                    isRecording
                      ? 'bg-rose-600 animate-pulse ring-4 ring-rose-400'
                      : 'bg-rose-500 hover:bg-rose-600 hover:scale-105'
                  }`}
                >
                  {isRecording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-3 text-center">
                  {isRecording
                    ? isRTL
                      ? 'جارٍ الاستماع وتفريغ الصوت مباشرة... اضغط للإيقاف'
                      : 'Listening live via Web Speech API... Tap to stop'
                    : isRTL
                    ? 'اضغط لبدء التفريغ المباشر من الميكروفون'
                    : 'Tap to start live speech-to-text microphone'}
                </span>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs text-slate-400">{isRTL ? 'أو' : 'or'}</span>
                  <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs transition-colors flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-rose-600" />
                    <span>
                      {isRTL ? 'رفع ملف صوتي MP3/WAV (حتى 20MB)' : 'Upload Audio MP3/WAV (max 20MB)'}
                    </span>
                    <input
                      type="file"
                      onChange={handleAudioFileUpload}
                      accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.webm"
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {uploadedAudioUrl && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                    <span className="truncate">{uploadedAudioName}</span>
                    <button
                      type="button"
                      onClick={handleTranscribeUploadedAudio}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                    >
                      {isRTL ? 'تشغيل وتفريغ تلقائي' : 'Play & Transcribe Live'}
                    </button>
                  </div>
                  <audio ref={audioRef} src={uploadedAudioUrl} controls className="w-full h-9" />
                </div>
              )}

              {(isRecording || sttProgress > 0) && (
                <ToolProgressBar
                  progress={sttProgress}
                  label={sttStatus}
                  active={isRecording}
                  accent="rose"
                />
              )}

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'النص المفرغ (قابل للتعديل):' : 'Transcribed Text (Editable):'}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={handleCopy}
                      disabled={!transcribedText}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copied ? t.copied : t.copy}</span>
                    </button>
                    <button
                      onClick={handleDownloadTranscriptTxt}
                      disabled={!transcribedText}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>TXT</span>
                    </button>
                    <button
                      onClick={handleDownloadTranscriptWord}
                      disabled={!transcribedText}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Word</span>
                    </button>
                  </div>
                </div>

                {interimText && (
                  <div className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs italic">
                    {interimText}...
                  </div>
                )}

                <textarea
                  value={transcribedText}
                  onChange={(e) => setTranscribedText(e.target.value)}
                  rows={5}
                  placeholder={
                    isRTL
                      ? 'سيظهر النص المفرغ هنا فور التحدث أو تشغيل الصوت...'
                      : 'Your transcribed speech will appear here...'
                  }
                  className={`w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed focus:outline-hidden focus:border-rose-500 ${
                    isRTL ? 'text-right' : 'text-left'
                  }`}
                />
              </div>
            </div>
          )}

          {activeTab === 'tts' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {isRTL ? 'اللغة' : 'Language'}
                  </label>
                  <select
                    value={ttsLang}
                    onChange={(e) => setTtsLang(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="ar-SA">العربية (Arabic)</option>
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="fr-FR">Français</option>
                    <option value="de-DE">Deutsch</option>
                    <option value="es-ES">Español</option>
                    <option value="tr-TR">Türkçe</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {isRTL ? 'الصوت المتاح' : 'Voice'}
                  </label>
                  <select
                    value={selectedVoiceURI}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    {displayedVoices.length > 0 ? (
                      displayedVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))
                    ) : (
                      <option value="">
                        {isRTL ? 'الصوت الافتراضي للمتصفح' : 'Default Browser Voice'}
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    <span className="flex items-center gap-1">
                      <Sliders className="w-3 h-3" />
                      {isRTL ? 'السرعة' : 'Speed'}
                    </span>
                    <span className="font-mono">{ttsRate.toFixed(2)}x</span>
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={ttsRate}
                    onChange={(e) => setTtsRate(Number(e.target.value))}
                    className="w-full accent-rose-600 mt-1.5"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'النص المراد تحويله إلى صوت' : 'Text to Convert to Speech'}
                  </label>
                  <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                    <Upload className="w-3 h-3 text-rose-600" />
                    <span>{isRTL ? 'رفع ملف (PDF/Word/TXT)' : 'Upload File'}</span>
                    <input
                      type="file"
                      onChange={handleTtsFileUpload}
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.txt"
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder={
                    isRTL
                      ? 'اكتب أو الصق النص هنا ليتم نطقه صوتياً أو تسجيله وتحميله...'
                      : 'Type or paste text here to listen and export audio...'
                  }
                  rows={5}
                  className={`w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-rose-500 resize-y ${
                    isRTL ? 'text-right' : 'text-left'
                  }`}
                />
              </div>

              {(isPlaying || isRecordingTts || ttsProgress > 0) && (
                <ToolProgressBar
                  progress={ttsProgress}
                  label={ttsStatus}
                  active={isPlaying || isRecordingTts}
                  accent="rose"
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {!isPlaying ? (
                  <button
                    onClick={handleTTSPlay}
                    className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{isRTL ? 'استماع مباشر (SpeechSynthesis)' : 'Listen Live (SpeechSynthesis)'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleTTSStop}
                    className="py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-amber-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    <span>{isRTL ? 'إيقاف الصوت' : 'Stop Playback'}</span>
                  </button>
                )}

                <button
                  onClick={handleRecordAndPrepareAudio}
                  disabled={isRecordingTts}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs sm:text-sm font-bold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>
                    {isRecordingTts
                      ? isRTL
                        ? 'جاري التسجيل بـ MediaRecorder...'
                        : 'Recording...'
                      : isRTL
                      ? 'تسجيل وتجهيز للتحميل (MediaRecorder)'
                      : 'Record & Prepare Audio Download'}
                  </span>
                </button>
              </div>

              {recordedAudioBlob && recordedAudioUrl && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      {isRTL
                        ? `تم تجهيز الملف الصوتي (MetaNy_Voice.${recordedExt})`
                        : `Audio Ready (MetaNy_Voice.${recordedExt})`}
                    </span>
                    <button
                      type="button"
                      onClick={() => triggerFileDownload(recordedAudioBlob, `MetaNy_Voice.${recordedExt}`)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {isRTL
                          ? `تحميل الصوت (.${recordedExt.toUpperCase()})`
                          : `Download Audio (.${recordedExt.toUpperCase()})`}
                      </span>
                    </button>
                  </div>
                  <audio src={recordedAudioUrl} controls className="w-full h-9" />
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Audio to Voice PDF (MP3 only inside audio-message.pdf) */}
          {activeTab === 'audio_pdf' && (
            <div className="space-y-4">
              {/* Format support table */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {isRTL ? 'الصيغ الصوتية المدعومة وآلية التحويل إلى PDF صوتي (Adobe Acrobat MP3):' : 'Supported Formats & Conversion Rules:'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 font-bold text-emerald-800 dark:text-emerald-300">
                    MP3 · يعمل مباشرة بدون تحويل (أفضل صيغة)
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                    WAV · يتحول إلى MP3 قبل التضمين
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                    M4A · يتحول إلى MP3 قبل التضمين
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                    OGG · يتحول إلى MP3 قبل التضمين
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                    WEBM · يتحول إلى MP3 قبل التضمين
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                    AAC · يتحول إلى MP3 قبل التضمين
                  </div>
                </div>
              </div>

              {/* Audio Upload Zone */}
              <div
                onClick={() => audioPdfInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-rose-300 dark:border-rose-800/60 rounded-2xl bg-rose-50/30 dark:bg-rose-950/20 cursor-pointer hover:bg-rose-50/60 dark:hover:bg-rose-950/40 transition-colors"
              >
                <input
                  ref={audioPdfInputRef}
                  type="file"
                  onChange={handleSelectAudioForPdf}
                  accept=".mp3,.wav,.m4a,.ogg,.webm,.aac,audio/*"
                  className="hidden"
                />
                <FileAudio className="w-10 h-10 text-rose-600 dark:text-rose-400 mb-2" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {pdfAudioFile
                    ? pdfAudioFile.name
                    : isRTL
                    ? 'اضغط لرفع ملف صوتي (MP3, WAV, M4A, OGG, WEBM, AAC) حتى 20MB'
                    : 'Click to upload Audio (MP3, WAV, M4A, OGG, WEBM, AAC — max 20MB)'}
                </span>
                {pdfAudioFile && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                    {(pdfAudioFile.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>

              {(audioPdfLoading || audioPdfProgress > 0) && (
                <ToolProgressBar
                  progress={audioPdfProgress}
                  label={audioPdfLabel}
                  active={audioPdfLoading}
                  accent="rose"
                />
              )}

              <button
                type="button"
                onClick={handleConvertAudioToPdf}
                disabled={audioPdfLoading || !pdfAudioFile}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
              >
                {audioPdfLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileAudio className="w-4 h-4" />
                )}
                <span>
                  {audioPdfLoading
                    ? isRTL
                      ? 'جارٍ التحويل إلى MP3 ودمجه داخل audio-message.pdf...'
                      : 'Converting to MP3 & Building PDF...'
                    : isRTL
                    ? 'تحويل الصوت إلى MP3 ودمجه داخل audio-message.pdf'
                    : 'Convert & Embed MP3 into audio-message.pdf'}
                </span>
              </button>

              {/* Result: Green Message + Status Table + Audio Preview + Real Download */}
              {audioPdfResult && (
                <div className="space-y-3 pt-2">
                  {/* Green Success Banner */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 space-y-1">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{audioPdfResult.successMessage}</span>
                    </div>
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {audioPdfResult.formatConversionNote}
                    </div>
                  </div>

                  {/* Required Pre-Download Status Table */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold">
                        <tr>
                          <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">
                            {isRTL ? 'الصيغة المرفوعة' : 'Uploaded Format'}
                          </th>
                          <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">
                            {isRTL ? 'الحالة' : 'Status'}
                          </th>
                          <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">
                            {isRTL ? 'الناتج' : 'Result'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-100">
                          <td className="p-2.5 font-mono">{audioPdfResult.statusRow.uploadedFormat}</td>
                          <td className="p-2.5 text-emerald-700 dark:text-emerald-400">
                            {audioPdfResult.statusRow.status}
                          </td>
                          <td className="p-2.5 font-mono">{audioPdfResult.statusRow.result}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {audioPdfPreviewUrl && (
                    <audio src={audioPdfPreviewUrl} controls className="w-full h-9" />
                  )}

                  <button
                    type="button"
                    onClick={() => triggerFileDownload(audioPdfResult.blob, audioPdfResult.fileName)}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isRTL
                        ? `تحميل ${audioPdfResult.fileName} الآن`
                        : `Download ${audioPdfResult.fileName}`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
