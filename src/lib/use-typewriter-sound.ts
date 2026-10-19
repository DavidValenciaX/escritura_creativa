"use client";

import { useEffect, useRef, useState } from "react";
import { TypewriterAudio } from "./typewriter-audio";

const STORAGE_KEY = "ec:typewriter-sound:v1";
const typingInputs = new Set([
  "insertText",
  "insertParagraph",
  "insertLineBreak",
  "deleteContentBackward",
  "deleteContentForward",
]);

export function useTypewriterSound(active: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const audio = useRef<TypewriterAudio | null>(null);
  const enabledRef = useRef(true);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const update = (value: boolean) => {
      enabledRef.current = value;
      setEnabled(value);
      audio.current?.setEnabled(value);
    };
    try {
      update(localStorage.getItem(STORAGE_KEY) !== "false");
    } catch {
      // Keep the default if storage is unavailable.
    }
    const storage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null)
        update(event.newValue !== "false");
    };
    const dispose = () => {
      audio.current?.dispose();
      audio.current = null;
    };
    window.addEventListener("storage", storage);
    window.addEventListener("pagehide", dispose);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("pagehide", dispose);
      dispose();
    };
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!active || !element) return;
    let composing = false;
    let handledKey = false;
    let committedComposition: string | null = null;
    let compositionTimer: ReturnType<typeof setTimeout> | undefined;
    const isWriting = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.matches(".letter-title textarea:not(:disabled)") ||
        !!target.closest('.tiptap[contenteditable="true"]'));
    const getAudio = () => {
      if (!enabledRef.current) return null;
      try {
        audio.current ??= new TypewriterAudio();
        return audio.current;
      } catch {
        return null;
      }
    };
    const unlock = (event: Event) => {
      if (isWriting(event.target)) getAudio()?.unlock();
    };
    const keydown = (event: KeyboardEvent) => {
      handledKey = false;
      committedComposition = null;
      if (!isWriting(event.target)) return;
      getAudio()?.unlock();
      if (
        composing ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.metaKey ||
        ((event.ctrlKey || event.altKey) && !event.getModifierState("AltGraph"))
      )
        return;
      if (
        Array.from(event.key).length === 1 ||
        ["Enter", "Backspace", "Delete"].includes(event.key)
      ) {
        // Tiptap consumes some Enter/Delete events before beforeinput occurs.
        handledKey = true;
        getAudio()?.play();
      }
    };
    const keyup = () => {
      handledKey = false;
    };
    const beforeinput = (event: InputEvent) => {
      if (!isWriting(event.target) || composing || event.isComposing) return;
      const duplicateComposition =
        committedComposition !== null &&
        event.data === committedComposition &&
        ["insertText", "insertFromComposition"].includes(event.inputType);
      committedComposition = null;
      const duplicateKey = handledKey;
      handledKey = false;
      if (
        !duplicateKey &&
        !duplicateComposition &&
        typingInputs.has(event.inputType)
      )
        getAudio()?.play();
    };
    const compositionstart = () => {
      composing = true;
      handledKey = false;
      committedComposition = null;
    };
    const compositionend = (event: CompositionEvent) => {
      composing = false;
      committedComposition = event.data || null;
      if (event.data && isWriting(event.target)) getAudio()?.play();
      clearTimeout(compositionTimer);
      compositionTimer = setTimeout(() => {
        committedComposition = null;
      }, 0);
    };
    element.addEventListener("pointerdown", unlock, true);
    element.addEventListener("keydown", keydown, true);
    element.addEventListener("keyup", keyup, true);
    element.addEventListener("beforeinput", beforeinput, true);
    element.addEventListener("compositionstart", compositionstart, true);
    element.addEventListener("compositionend", compositionend, true);
    return () => {
      clearTimeout(compositionTimer);
      element.removeEventListener("pointerdown", unlock, true);
      element.removeEventListener("keydown", keydown, true);
      element.removeEventListener("keyup", keyup, true);
      element.removeEventListener("beforeinput", beforeinput, true);
      element.removeEventListener("compositionstart", compositionstart, true);
      element.removeEventListener("compositionend", compositionend, true);
    };
  }, [active]);

  function toggle() {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    audio.current?.setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // The switch still works for this session without persistent storage.
    }
  }

  return { root, enabled, toggle };
}
