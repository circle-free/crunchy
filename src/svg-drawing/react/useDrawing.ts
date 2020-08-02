import React, { useRef, useEffect, useCallback, MutableRefObject } from 'react';
import { SvgDrawing, DrawingOption } from '../core';

interface UseSvgDrawing {
  instance: SvgDrawing | null;
  clear: () => void;
  undo: () => void;
  changePenColor: (penColor: DrawingOption['penColor']) => void;
  changePenWidth: (penWidth: DrawingOption['penWidth']) => void;
  changeFill: (fill: DrawingOption['fill']) => void;
  changeClose: (close: DrawingOption['close']) => void;
  changeDelay: (delay: DrawingOption['delay']) => void;
  changeCurve: (curve: DrawingOption['curve']) => void;
  getSvgXML: () => string | null;
  download: (ext: 'svg' | 'png' | 'jpg') => void;
  insertPath: (pathString: string) => void;
  getDrawnPaths: () => any[] | undefined;
  on: () => void;
  off: () => void;
  onPathDrawn: (callback : Function) => any;
  offPathDrawn: (listener : Function) => any;
}

export const useSvgDrawing = (option?: Partial<DrawingOption>): [MutableRefObject<HTMLDivElement | null>, UseSvgDrawing] => {
  const renderRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef<SvgDrawing | null>(null);

  const getSvgXML = useCallback(() => {
    if (!drawingRef.current) return null;
    
    return drawingRef.current.toElement().outerHTML;
  }, []);

  const download = useCallback((ext: 'svg' | 'png' | 'jpg' = 'svg') => {
    if (!drawingRef.current) return;

    drawingRef.current.download(ext);
  }, []);

  const changePenColor = useCallback((param: DrawingOption['penColor']) => {
    if (!drawingRef.current || !param) return;

    drawingRef.current.penColor = param;
  }, []);

  const changeFill = useCallback((param: DrawingOption['fill']) => {
    if (!drawingRef.current || !param) return;

    drawingRef.current.fill = param;
  }, []);

  const changeDelay = useCallback((param: DrawingOption['delay']) => {
    if (!drawingRef.current || !param) return;

    drawingRef.current.changeDelay(param);
  }, []);

  const changePenWidth = useCallback((param: DrawingOption['penWidth']) => {
    if (!drawingRef.current) return;

    drawingRef.current.penWidth = Number(param);
  }, []);

  const changeClose = useCallback((param: DrawingOption['close']) => {
    if (!drawingRef.current) return;

    drawingRef.current.close = param ?? false;
  }, []);

  const changeCurve = useCallback((param: DrawingOption['curve']) => {
    if (!drawingRef.current) return;

    drawingRef.current.curve = param ?? true;
  }, []);

  const clear = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.clear();
  }, []);

  const undo = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.undo();
  }, []);

  const insertPath = useCallback((pathString: string) => {
    if (!drawingRef.current) return;
    
    drawingRef.current.insertPath(pathString);
  }, []);

  const getDrawnPaths = useCallback(() => {
    if (!drawingRef.current) return;

    return drawingRef.current.getDrawnPaths();
  }, []);

  const off = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.off();
  }, []);

  const on = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.on();
  }, []);

  const onPathDrawn = useCallback((callback) => {
    if (!drawingRef.current) return;

    return drawingRef.current.onPathDrawn(callback);
  }, []);

  const offPathDrawn = useCallback((listener) => {
    if (!drawingRef.current) return;

    return drawingRef.current.offPathDrawn(listener);
  }, []);

  useEffect(() => {
    if (drawingRef.current) return;

    if (!renderRef.current) return;

    drawingRef.current = new SvgDrawing(renderRef.current, {
      ...option,
    });
  })

  return [
    renderRef,
    {
      instance: drawingRef.current,
      changePenWidth,
      changePenColor,
      changeFill,
      changeDelay,
      changeClose,
      changeCurve,
      clear,
      undo,
      insertPath,
      getDrawnPaths,
      getSvgXML,
      download,
      off,
      on,
      onPathDrawn,
      offPathDrawn,
    },
  ];
}
