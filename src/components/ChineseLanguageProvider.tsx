'use client';

import { Converter } from 'opencc-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type ChineseMode = 'simplified' | 'traditional';

interface ChineseLanguageContextValue {
  mode: ChineseMode;
  setMode: (mode: ChineseMode) => void;
  toggleMode: () => void;
}

const STORAGE_KEY = 'moontv-chinese-mode';
const CONVERTIBLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;
const SKIPPED_ELEMENTS = new Set([
  'SCRIPT',
  'STYLE',
  'CODE',
  'PRE',
  'TEXTAREA',
  'NOSCRIPT',
]);

const ChineseLanguageContext =
  createContext<ChineseLanguageContextValue | null>(null);

function shouldSkip(element: Element | null) {
  return Boolean(
    element &&
      (SKIPPED_ELEMENTS.has(element.tagName) ||
        element.closest('[data-no-chinese-convert], [contenteditable="true"]'))
  );
}

function convertElement(root: Node, converter: (text: string) => string) {
  if (root.nodeType === Node.TEXT_NODE) {
    const textNode = root as Text;
    if (!shouldSkip(textNode.parentElement)) {
      const converted = converter(textNode.data);
      if (converted !== textNode.data) textNode.data = converted;
    }
    return;
  }

  if (!(root instanceof Element) || shouldSkip(root)) return;

  for (const attribute of CONVERTIBLE_ATTRIBUTES) {
    const value = root.getAttribute(attribute);
    if (value) {
      const converted = converter(value);
      if (converted !== value) root.setAttribute(attribute, converted);
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (!shouldSkip((node as Text).parentElement)) {
      const textNode = node as Text;
      const converted = converter(textNode.data);
      if (converted !== textNode.data) textNode.data = converted;
    }
    node = walker.nextNode();
  }

  root.querySelectorAll('*').forEach((element) => {
    if (shouldSkip(element)) return;
    for (const attribute of CONVERTIBLE_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (value) {
        const converted = converter(value);
        if (converted !== value) element.setAttribute(attribute, converted);
      }
    }
  });
}

export function ChineseLanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<ChineseMode>('simplified');
  const [ready, setReady] = useState(false);
  // `twp` includes Taiwan phrase conversion (视频→影片、加载→載入),
  // producing natural Traditional Chinese rather than character-only conversion.
  const toTraditional = useMemo(() => Converter({ from: 'cn', to: 'twp' }), []);
  const toSimplified = useMemo(() => Converter({ from: 'twp', to: 'cn' }), []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setModeState(saved === 'traditional' ? 'traditional' : 'simplified');
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const converter = mode === 'traditional' ? toTraditional : toSimplified;
    document.documentElement.lang = mode === 'traditional' ? 'zh-TW' : 'zh-CN';
    document.documentElement.dataset.chineseMode = mode;
    convertElement(document.body, converter);

    let queued = false;
    const pending = new Set<Node>();
    const flush = () => {
      queued = false;
      pending.forEach((node) => convertElement(node, converter));
      pending.clear();
    };
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') pending.add(mutation.target);
        if (mutation.type === 'attributes') pending.add(mutation.target);
        mutation.addedNodes.forEach((node) => pending.add(node));
      });
      if (!queued && pending.size) {
        queued = true;
        queueMicrotask(flush);
      }
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...CONVERTIBLE_ATTRIBUTES],
      subtree: true,
    });
    return () => observer.disconnect();
  }, [mode, ready, toSimplified, toTraditional]);

  const setMode = useCallback((next: ChineseMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);
  const toggleMode = useCallback(
    () => setMode(mode === 'simplified' ? 'traditional' : 'simplified'),
    [mode, setMode]
  );

  return (
    <ChineseLanguageContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ChineseLanguageContext.Provider>
  );
}

export function useChineseLanguage() {
  const context = useContext(ChineseLanguageContext);
  if (!context)
    throw new Error(
      'useChineseLanguage must be used inside ChineseLanguageProvider'
    );
  return context;
}
