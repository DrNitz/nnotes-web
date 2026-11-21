/** Browser voice capture with optional live transcription via the Web Speech API. */

interface SpeechLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechCtor = new () => SpeechLike;

function speechCtor(): SpeechCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private speech: SpeechLike | null = null;
  transcript = '';

  get recording() { return this.recorder?.state === 'recording'; }
  get canTranscribe() { return !!speechCtor(); }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.transcript = '';
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime });
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.recorder.start();

    const Ctor = speechCtor();
    if (Ctor) {
      this.speech = new Ctor();
      this.speech.lang = navigator.language || 'en-US';
      this.speech.continuous = true;
      this.speech.interimResults = false;
      this.speech.onresult = (e) => {
        for (let i = 0; i < e.results.length; i++) {
          this.transcript += `${e.results[i][0].transcript} `;
        }
      };
      try { this.speech.start(); } catch { this.speech = null; }
    }
  }

  async stop(): Promise<{ blob: Blob; transcript: string }> {
    const blob = await new Promise<Blob>((resolve) => {
      const r = this.recorder!;
      r.onstop = () => resolve(new Blob(this.chunks, { type: r.mimeType || 'audio/webm' }));
      r.stop();
    });
    this.speech?.stop();
    this.speech = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    return { blob, transcript: this.transcript.trim() };
  }

  cancel() {
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.speech?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.speech = null;
  }
}
