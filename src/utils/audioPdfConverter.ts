import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { Mp3Encoder } from '@breezystack/lamejs';
import JSZip from 'jszip';
import { validateFileSize } from './clientFileReader';

export type SupportedAudioExt = 'mp3' | 'wav' | 'm4a' | 'ogg' | 'webm' | 'aac';

export interface AudioPdfStatusRow {
  uploadedFormat: string;
  status: string;
  result: string;
}

export interface AudioToPdfResult {
  mode: 'mp3_embedded_pdf' | 'fallback_attachment_pdf' | 'fallback_zip';
  blob: Blob;
  fileName: string;
  originalFormat: string;
  finalFormat: string;
  successMessage: string;
  formatConversionNote: string;
  durationSeconds: number;
  audioPreviewBlob: Blob;
  statusRow: AudioPdfStatusRow;
}

const SUPPORTED_EXTS = new Set<string>(['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac']);

function detectAudioFormat(file: File): string {
  const ext = (file.name.split('.').pop() || '').toLowerCase().trim();
  if (SUPPORTED_EXTS.has(ext)) return ext.toUpperCase();

  const mime = (file.type || '').toLowerCase();
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'MP3';
  if (mime.includes('wav')) return 'WAV';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'M4A';
  if (mime.includes('ogg')) return 'OGG';
  if (mime.includes('webm')) return 'WEBM';
  if (mime.includes('aac')) return 'AAC';
  return ext ? ext.toUpperCase() : 'UNKNOWN';
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return output;
}

/**
 * Decode any browser-playable audio buffer via Web Audio API + encode PCM directly into genuine MP3 (audio/mpeg)
 */
async function decodeAndEncodeToMp3(
  arrayBuffer: ArrayBuffer,
  onProgress?: (pct: number, msg: string) => void,
  isRTL: boolean = true
): Promise<{ mp3Bytes: Uint8Array; duration: number; waveform: number[] }> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API unavailable');
  }

  onProgress?.(25, isRTL ? 'فك ترميز الصوت عبر Web Audio API...' : 'Decoding audio via Web Audio API...');
  const ctx = new AudioCtx();
  let audioBuffer: AudioBuffer;

  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await ctx.close().catch(() => {});
  }

  const numChannels = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
  const sampleRate = audioBuffer.sampleRate || 44100;
  const duration = audioBuffer.duration || 0;

  const leftFloat = audioBuffer.getChannelData(0);
  const rightFloat = numChannels > 1 ? audioBuffer.getChannelData(1) : leftFloat;

  // Build normalized waveform bars for the PDF cover card
  const barCount = 48;
  const blockSize = Math.max(1, Math.floor(leftFloat.length / barCount));
  const waveform: number[] = [];
  for (let b = 0; b < barCount; b++) {
    let peak = 0;
    const start = b * blockSize;
    const end = Math.min(leftFloat.length, start + blockSize);
    for (let j = start; j < end; j += Math.max(1, Math.floor((end - start) / 40))) {
      const v = Math.abs(leftFloat[j]);
      if (v > peak) peak = v;
    }
    waveform.push(Math.max(0.12, Math.min(1, peak * 1.4)));
  }

  onProgress?.(45, isRTL ? 'تحويل البيانات الصوتية إلى MP3 حقيقي...' : 'Encoding PCM audio into MP3...');

  const leftPcm = floatTo16BitPCM(leftFloat);
  const rightPcm = numChannels > 1 ? floatTo16BitPCM(rightFloat) : undefined;

  const encoder = new Mp3Encoder(numChannels, sampleRate, 128);
  const mp3Chunks: Uint8Array[] = [];
  const sampleBlockSize = 1152;
  const totalSamples = leftPcm.length;

  for (let i = 0; i < totalSamples; i += sampleBlockSize) {
    const leftChunk = leftPcm.subarray(i, i + sampleBlockSize);
    const rightChunk = rightPcm ? rightPcm.subarray(i, i + sampleBlockSize) : undefined;
    const encoded = rightChunk
      ? encoder.encodeBuffer(leftChunk, rightChunk)
      : encoder.encodeBuffer(leftChunk);
    if (encoded && encoded.length > 0) {
      mp3Chunks.push(new Uint8Array(encoded));
    }
    if (i % (sampleBlockSize * 120) === 0) {
      const pct = 45 + Math.round((i / Math.max(1, totalSamples)) * 30);
      onProgress?.(pct, isRTL ? 'جارٍ ضغط الصوت بصيغة MP3...' : 'Compressing MP3 frames...');
    }
  }

  const flushed = encoder.flush();
  if (flushed && flushed.length > 0) {
    mp3Chunks.push(new Uint8Array(flushed));
  }

  const totalBytes = mp3Chunks.reduce((sum, c) => sum + c.length, 0);
  if (totalBytes === 0) {
    throw new Error('Empty MP3 encoder output');
  }

  const mp3Bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of mp3Chunks) {
    mp3Bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return { mp3Bytes, duration, waveform };
}

/**
 * Fallback capture via MediaRecorder if AudioContext.decodeAudioData cannot decode a rare container directly
 */
async function fallbackMediaRecorderInspect(file: File): Promise<number> {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(url);
      resolve(dur);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    audio.src = url;
  });
}

/**
 * Draw crisp RTL/LTR visual PDF card onto an HTML5 Canvas and return PNG bytes
 */
async function renderVoicePdfCardPng(options: {
  fileName: string;
  originalFormat: string;
  finalFormat: string;
  durationSeconds: number;
  audioBytesLength: number;
  waveform: number[];
  isFallbackAttachment?: boolean;
}): Promise<Uint8Array> {
  const {
    fileName,
    originalFormat,
    finalFormat,
    durationSeconds,
    audioBytesLength,
    waveform,
    isFallbackAttachment = false,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = 1190;
  canvas.height = 1684; // A4 high-DPI proportion
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  // Crisp light background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header band
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, 220);

  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, 212, canvas.width, 8);

  // Brand title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px "Cairo", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Meta.Ny · رسالة صوتية مدمجة داخل PDF', canvas.width - 70, 95);

  ctx.fillStyle = '#93c5fd';
  ctx.font = '600 26px "Cairo", Arial, sans-serif';
  ctx.fillText('Embedded Audio PDF Document (Adobe Acrobat Compatible)', canvas.width - 70, 155);

  // Card box
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(70, 290, canvas.width - 140, 760, 28);
  ctx.fill();
  ctx.stroke();

  // Audio player hero strip inside card
  ctx.fillStyle = '#eff6ff';
  ctx.beginPath();
  ctx.roundRect(110, 340, canvas.width - 220, 220, 20);
  ctx.fill();

  // Play circle icon
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(210, 450, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(195, 424);
  ctx.lineTo(195, 476);
  ctx.lineTo(240, 450);
  ctx.closePath();
  ctx.fill();

  // Waveform bars
  const bars = waveform.length > 0 ? waveform : Array.from({ length: 42 }, (_, i) => 0.25 + ((i * 7) % 10) * 0.06);
  const startX = 310;
  const maxWidth = canvas.width - 450;
  const step = maxWidth / bars.length;
  bars.forEach((amp, idx) => {
    const h = Math.max(18, Math.round(amp * 130));
    const x = startX + idx * step;
    const y = 450 - h / 2;
    ctx.fillStyle = idx % 3 === 0 ? '#1d4ed8' : '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(6, step - 5), h, 4);
    ctx.fill();
  });

  // Metadata rows
  const durStr =
    durationSeconds > 0
      ? `${Math.floor(durationSeconds / 60)}:${String(Math.floor(durationSeconds % 60)).padStart(2, '0')}`
      : '--:--';
  const sizeKb = (audioBytesLength / 1024).toFixed(1);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px "Cairo", Arial, sans-serif';
  ctx.fillText(`اسم الملف الأصلي: ${fileName}`, canvas.width - 120, 640);

  ctx.fillStyle = '#334155';
  ctx.font = '600 28px "Cairo", Arial, sans-serif';
  ctx.fillText(`الصيغة المرفوعة: ${originalFormat}   ←   الصيغة النهائية المدمجة: ${finalFormat}`, canvas.width - 120, 710);
  ctx.fillText(`المدة الزمنية: ${durStr}   |   الحجم المدمج: ${sizeKb} KB`, canvas.width - 120, 770);

  // Instruction banner
  ctx.fillStyle = isFallbackAttachment ? '#fffbeb' : '#ecfdf5';
  ctx.strokeStyle = isFallbackAttachment ? '#f59e0b' : '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(110, 830, canvas.width - 220, 160, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isFallbackAttachment ? '#92400e' : '#065f46';
  ctx.font = 'bold 28px "Cairo", Arial, sans-serif';
  ctx.fillText(
    isFallbackAttachment
      ? 'تم إرفاق الملف الصوتي الأصلي كمرفق PDF FileAttachment بنجاح'
      : 'تم تحويل الصوت إلى MP3 وتضمينه داخل هذا المستند لتشغيله في Adobe Acrobat',
    canvas.width - 140,
    895
  );
  ctx.font = '600 23px "Cairo", Arial, sans-serif';
  ctx.fillText(
    'ملاحظة التشغيل: افتح لوحة المرفقات (Attachments) في Adobe Acrobat لتشغيل المقطع المدمج.',
    canvas.width - 140,
    950
  );

  // Footer
  ctx.fillStyle = '#64748b';
  ctx.font = '500 22px "Cairo", Arial, sans-serif';
  ctx.fillText(`تم الإنشاء محلياً داخل المتصفح · ${new Date().toLocaleDateString('ar-EG')}`, canvas.width - 70, 1590);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed canvas PNG'))), 'image/png', 0.92);
  });
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Create real PDF with embedded audio bytes (MP3 primary or original FileAttachment fallback)
 */
async function buildPdfWithEmbeddedAudio(options: {
  audioBytes: Uint8Array;
  embeddedFileName: string;
  mimeType: string;
  originalFileName: string;
  originalFormat: string;
  finalFormat: string;
  durationSeconds: number;
  waveform: number[];
  isFallbackAttachment?: boolean;
}): Promise<Blob> {
  const {
    audioBytes,
    embeddedFileName,
    mimeType,
    originalFileName,
    originalFormat,
    finalFormat,
    durationSeconds,
    waveform,
    isFallbackAttachment = false,
  } = options;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('Meta.Ny Audio Message PDF');
  pdfDoc.setCreator('Meta.Ny Client-Side Audio PDF Engine');

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 points
  const pngBytes = await renderVoicePdfCardPng({
    fileName: originalFileName,
    originalFormat,
    finalFormat,
    durationSeconds,
    audioBytesLength: audioBytes.length,
    waveform,
    isFallbackAttachment,
  });

  const embeddedPng = await pdfDoc.embedPng(pngBytes);
  page.drawImage(embeddedPng, {
    x: 0,
    y: 0,
    width: 595.28,
    height: 841.89,
  });

  // Attach genuine audio file inside the PDF catalog (/EmbeddedFiles)
  await pdfDoc.attach(audioBytes, embeddedFileName, {
    mimeType,
    description: `Embedded ${finalFormat} audio generated from ${originalFormat} (${originalFileName})`,
    creationDate: new Date(),
    modificationDate: new Date(),
  });

  // Also add an explicit FileAttachment annotation over the Play card box for Adobe Acrobat access
  try {
    const efNames = pdfDoc.catalog.lookup(PDFName.of('Names'));
    if (efNames) {
      const ctx = pdfDoc.context;
      const embeddedFileStream = ctx.flateStream(audioBytes, {
        Type: PDFName.of('EmbeddedFile'),
        Subtype: PDFName.of(mimeType.replace('/', '#2F')),
      });
      const efStreamRef = ctx.register(embeddedFileStream);

      const fileSpecDict = ctx.obj({
        Type: PDFName.of('Filespec'),
        F: PDFString.of(embeddedFileName),
        UF: PDFString.of(embeddedFileName),
        EF: ctx.obj({ F: efStreamRef, UF: efStreamRef }),
        Desc: PDFString.of(`Playable ${finalFormat} Audio Message`),
      });
      const fileSpecRef = ctx.register(fileSpecDict);

      const annotDict = ctx.obj({
        Type: PDFName.of('Annot'),
        Subtype: PDFName.of('FileAttachment'),
        Rect: [55, 560, 540, 670],
        FS: fileSpecRef,
        Name: PDFName.of('Speaker'),
        Contents: PDFString.of(`Audio Message (${finalFormat}) - Double-click to play/open in Adobe Acrobat`),
      });
      const annotRef = ctx.register(annotDict);
      page.node.addAnnot(annotRef);
    }
  } catch {
    // Catalog pdfDoc.attach remains intact as standard embedded audio file
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes).buffer], { type: 'application/pdf' });
}

/**
 * Main Audio -> MP3 -> Voice PDF pipeline with exact format rules and 3-tier fallback chain
 */
export async function convertAudioToVoicePdf(
  file: File,
  onProgress?: (percent: number, label: string) => void,
  isRTL: boolean = true
): Promise<AudioToPdfResult> {
  validateFileSize(file, isRTL);

  const detectedFormat = detectAudioFormat(file);
  if (!SUPPORTED_EXTS.has(detectedFormat.toLowerCase())) {
    throw new Error('عذرا، صيغة هذا الملف غير مدعومة، ارجوك ارفع MP3 او WAV');
  }

  onProgress?.(10, isRTL ? `تم استلام ملف ${detectedFormat}. جاري الفحص...` : `Inspecting ${detectedFormat} audio...`);
  const rawBuffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(rawBuffer);

  // Case A: Already MP3 -> embed directly without conversion
  if (detectedFormat === 'MP3') {
    onProgress?.(45, isRTL ? 'ملف MP3 جاهز — جاري استخراج الموجة الصوتية...' : 'MP3 ready — inspecting waveform...');
    let duration = 0;
    let waveform: number[] = [];
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const decoded = await ctx.decodeAudioData(rawBuffer.slice(0));
        duration = decoded.duration || 0;
        const ch = decoded.getChannelData(0);
        const step = Math.max(1, Math.floor(ch.length / 48));
        for (let b = 0; b < 48; b++) {
          waveform.push(Math.max(0.15, Math.min(1, Math.abs(ch[Math.min(ch.length - 1, b * step)]) * 1.5)));
        }
        await ctx.close().catch(() => {});
      }
    } catch {
      duration = await fallbackMediaRecorderInspect(file);
    }

    onProgress?.(75, isRTL ? 'جاري دمج MP3 داخل audio-message.pdf...' : 'Embedding MP3 into audio-message.pdf...');
    const pdfBlob = await buildPdfWithEmbeddedAudio({
      audioBytes: rawBytes,
      embeddedFileName: 'audio-message.mp3',
      mimeType: 'audio/mpeg',
      originalFileName: file.name,
      originalFormat: 'MP3',
      finalFormat: 'MP3',
      durationSeconds: duration,
      waveform,
    });

    onProgress?.(100, 'تم تحويل الصوت الى MP3 ودمجه داخل PDF بنجاح');
    return {
      mode: 'mp3_embedded_pdf',
      blob: pdfBlob,
      fileName: 'audio-message.pdf',
      originalFormat: 'MP3',
      finalFormat: 'MP3',
      successMessage: 'تم تحويل الصوت الى MP3 ودمجه داخل PDF بنجاح',
      formatConversionNote: 'تم الرفع بصيغة MP3، وتم دمجه مباشرة بصيغة MP3 بدون الحاجة لتحويل',
      durationSeconds: duration,
      audioPreviewBlob: file,
      statusRow: {
        uploadedFormat: 'MP3',
        status: 'يعمل مباشرة بدون تحويل',
        result: 'audio-message.pdf (صوت MP3 مدمج)',
      },
    };
  }

  // Case B: WAV, M4A, OGG, WEBM, AAC -> Decode via Web Audio API and encode to MP3
  try {
    const { mp3Bytes, duration, waveform } = await decodeAndEncodeToMp3(rawBuffer, onProgress, isRTL);
    onProgress?.(82, isRTL ? 'جاري دمج MP3 المحول داخل audio-message.pdf...' : 'Embedding MP3 into audio-message.pdf...');

    const pdfBlob = await buildPdfWithEmbeddedAudio({
      audioBytes: mp3Bytes,
      embeddedFileName: 'audio-message.mp3',
      mimeType: 'audio/mpeg',
      originalFileName: file.name,
      originalFormat: detectedFormat,
      finalFormat: 'MP3',
      durationSeconds: duration,
      waveform,
    });

    const mp3PreviewBlob = new Blob([new Uint8Array(mp3Bytes).buffer], { type: 'audio/mpeg' });
    onProgress?.(100, 'تم تحويل الصوت الى MP3 ودمجه داخل PDF بنجاح');

    return {
      mode: 'mp3_embedded_pdf',
      blob: pdfBlob,
      fileName: 'audio-message.pdf',
      originalFormat: detectedFormat,
      finalFormat: 'MP3',
      successMessage: 'تم تحويل الصوت الى MP3 ودمجه داخل PDF بنجاح',
      formatConversionNote: `تم الرفع بصيغة ${detectedFormat}، وتم التحويل الى MP3`,
      durationSeconds: duration,
      audioPreviewBlob: mp3PreviewBlob,
      statusRow: {
        uploadedFormat: detectedFormat,
        status: 'تم التحويل إلى MP3 بنجاح',
        result: 'audio-message.pdf (صوت MP3 مدمج)',
      },
    };
  } catch (mp3Err) {
    console.warn('Browser MP3 decode/encode failed, trying Fallback 1 (FileAttachment):', mp3Err);
  }

  // Fallback 1: Embed original audio as PDF FileAttachment directly
  try {
    onProgress?.(65, 'الانتقال للبديل الأول: تضمين الملف الأصلي كمرفق PDF...');
    const duration = await fallbackMediaRecorderInspect(file);
    const pdfBlob = await buildPdfWithEmbeddedAudio({
      audioBytes: rawBytes,
      embeddedFileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      originalFileName: file.name,
      originalFormat: detectedFormat,
      finalFormat: `${detectedFormat} (FileAttachment)`,
      durationSeconds: duration,
      waveform: [],
      isFallbackAttachment: true,
    });

    onProgress?.(100, 'تم إرفاق الملف الصوتي داخل PDF بنجاح (البديل الأول)');
    return {
      mode: 'fallback_attachment_pdf',
      blob: pdfBlob,
      fileName: 'audio-message.pdf',
      originalFormat: detectedFormat,
      finalFormat: `${detectedFormat} (FileAttachment)`,
      successMessage: 'تم دمج الملف الصوتي داخل PDF بنجاح (البديل الأول: FileAttachment)',
      formatConversionNote: `تم الرفع بصيغة ${detectedFormat}، وتم تضمين الملف الأصلي داخل PDF كمرفق FileAttachment`,
      durationSeconds: duration,
      audioPreviewBlob: file,
      statusRow: {
        uploadedFormat: detectedFormat,
        status: 'البديل الأول (FileAttachment)',
        result: 'audio-message.pdf (مرفق أصلي)',
      },
    };
  } catch (fb1Err) {
    console.warn('Fallback 1 failed, trying Fallback 2 (ZIP bundle):', fb1Err);
  }

  // Fallback 2: ZIP bundle containing summary PDF + original audio file
  try {
    onProgress?.(80, 'الانتقال للبديل الثاني: إنشاء حزمة ZIP (PDF + الصوت)...');
    const zip = new JSZip();
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const cardPng = await renderVoicePdfCardPng({
      fileName: file.name,
      originalFormat: detectedFormat,
      finalFormat: detectedFormat,
      durationSeconds: 0,
      audioBytesLength: rawBytes.length,
      waveform: [],
      isFallbackAttachment: true,
    });
    const pngImg = await pdfDoc.embedPng(cardPng);
    page.drawImage(pngImg, { x: 0, y: 0, width: 595.28, height: 841.89 });
    const summaryPdfBytes = await pdfDoc.save();

    zip.file('audio-message.pdf', summaryPdfBytes);
    zip.file(file.name, rawBytes);
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    onProgress?.(100, 'تم إنشاء حزمة ZIP (PDF + الصوت)');
    return {
      mode: 'fallback_zip',
      blob: zipBlob,
      fileName: 'audio-message-bundle.zip',
      originalFormat: detectedFormat,
      finalFormat: `ZIP (${detectedFormat} + PDF)`,
      successMessage: 'تم إنشاء أرشيف ZIP يحتوي على ملف PDF والملف الصوتي بنجاح (البديل الثاني)',
      formatConversionNote: `تم الرفع بصيغة ${detectedFormat}، وتم تجهيز أرشيف ZIP يحتوي على PDF + الملف الصوتي`,
      durationSeconds: 0,
      audioPreviewBlob: file,
      statusRow: {
        uploadedFormat: detectedFormat,
        status: 'البديل الثاني (أرشيف ZIP)',
        result: 'audio-message-bundle.zip',
      },
    };
  } catch {
    // Fallback 3: Exact error message required
    throw new Error('عذرا، صيغة هذا الملف غير مدعومة، ارجوك ارفع MP3 او WAV');
  }
}
