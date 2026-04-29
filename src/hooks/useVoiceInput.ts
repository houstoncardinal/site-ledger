import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((e: any) => void) | null;
  start: () => void;
  stop: () => void;
};

function getSR(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  return ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) ?? null;
}

/**
 * Lightweight SpeechRecognition hook.
 * - Works best on Chrome/Edge; iOS Safari support varies.
 * - Always request microphone access from a user gesture.
 */
export function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const supported = !!getSR();

  const start = useCallback(() => {
    const SR = getSR();
    if (!SR) return;

    const r = new SR();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.onresult = (e: any) => {
      const transcript = e?.results?.[0]?.[0]?.transcript;
      if (typeof transcript === "string" && transcript.trim()) {
        onResult(transcript.trim());
      }
    };
    recognitionRef.current = r;
    r.start();
  }, [onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  return { supported, listening, start, stop };
}
