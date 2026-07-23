// Browser-native voice using the Web Speech API. Text to speech for the persona
// and speech to text for the user. Fully feature-detected: when the APIs are
// missing (some browsers), the controls stay hidden and text still works.

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function recognitionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

export function speak(text: string): void {
  if (!speechSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export interface Recognizer {
  start: () => void;
  stop: () => void;
}

export function createRecognizer(handlers: {
  onTranscript: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
}): Recognizer | null {
  const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onresult = (event: any) => {
    let text = '';
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }
    handlers.onTranscript(text.trim(), isFinal);
  };
  recognition.onend = () => handlers.onEnd();
  recognition.onerror = () => handlers.onEnd();

  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        // start() throws if already running; ignore.
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    },
  };
}
