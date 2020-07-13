import React, { useEffect, useRef, Fragment, useCallback, useState } from 'react';
import { SvgDrawing } from 'svg-drawing';
import { ChromePicker } from 'react-color';
import { Slider, Button, IconButton } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import ClearIcon from '@material-ui/icons/Clear';
import UndoIcon from '@material-ui/icons/Undo';
import GestureIcon from '@material-ui/icons/Gesture';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import GridOnIcon from '@material-ui/icons/GridOn';
import GridOffIcon from '@material-ui/icons/GridOff';
import BrushIcon from '@material-ui/icons/Brush';
import PanToolIcon from '@material-ui/icons/PanTool';
import './App.css';

const size = 30;

const getSvgPath = () => {
  return `<path fill="none" stroke="#f50057" stroke-width="5" d="M 57.59 56.22 C 57.33 56.48 57.43 56.27 56.3 57.51 C 55.16 58.75 53.31 60.45 51.91 62.41 C 50.52 64.37 50.52 64.47 49.34 67.3 C 48.15 70.12 47.12 73.4 45.98 76.53 C 44.85 79.66 44.72 79.54 43.66 82.94 C 42.61 86.34 41.51 89.61 40.71 93.55 C 39.91 97.48 39.89 98.88 39.68 102.61 C 39.47 106.34 39.12 108.53 39.68 112.19 C 40.23 115.85 41.05 117.92 42.47 120.9 C 43.89 123.87 44.8 125.06 46.79 127.07 C 48.77 129.07 49.98 129.85 52.37 130.93 C 54.76 132.01 56.74 132.17 58.72 132.48 C 60.7 132.79 60.14 133.04 62.27 132.48 C 64.41 131.92 66.29 131.05 69.38 129.68 C 72.48 128.31 74.22 127.34 77.76 125.62 C 81.31 123.9 83.29 122.84 87.11 121.07 C 90.93 119.3 92.27 118.75 96.87 116.75 C 101.46 114.76 105.03 113.18 110.09 111.09 C 115.15 109 116.84 108.1 122.19 106.3 C 127.54 104.51 132.44 103.19 136.83 102.13 C 141.22 101.06 140.12 101.32 144.15 100.99 C 148.19 100.66 152.15 100.48 157.02 100.48 C 161.89 100.49 163.8 100.14 168.5 101 C 173.21 101.86 175.35 102.68 180.52 104.77 C 185.7 106.85 189.49 108.63 194.36 111.42 C 199.23 114.21 201.1 115.27 204.88 118.73 C 208.66 122.19 210.97 125.29 213.26 128.73 C 215.54 132.16 215.39 133.29 216.3 135.91 C 217.22 138.53 217.27 139.25 217.83 141.82 C 218.39 144.39 218.74 145.83 219.1 148.75 C 219.45 151.68 219.5 153.57 219.61 156.45 C 219.71 159.32 219.55 161.02 219.61 163.13 C 219.66 165.24 219.81 165.96 219.86 167 C 219.91 168.03 219.86 167.92 219.86 168.29 C 219.86 168.65 219.86 168.65 219.86 168.8 C 219.86 168.96 219.86 169.01 219.86 169.06" stroke-linecap="round" stroke-linejoin="round"></path>`;
};

const lattice = s => `
  repeating-linear-gradient(
    90deg,
    #ddd ,
    #ddd 1px,
    transparent 1px,
    transparent ${String(s)}px
  ),
  repeating-linear-gradient(
    0deg,
    #ddd ,
    #ddd 1px,
    transparent 1px,
    transparent ${String(s)}px
  )
`;

function App() {
  const divRef = useRef(null);
  const drawingRef = useRef(null);
  
  const [smoothing, setSmoothing] = useState(true);
  const [grid, setGrid] = useState(false);
  const [drawing, setDrawing] = useState(true);
  const [penColor, setPenColor] = useState('#f50057');
  const [sampleRate, setSampleRate] = useState(20);
  const [radius, setRadius] = useState(5);

  const handleDownload = useCallback(extension => e => {
      if (!drawingRef.current) return;

      drawingRef.current.download(extension);
    },
    []
  );

  const handleToggleSmoothing = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.curve = !smoothing;
    setSmoothing(!smoothing);
  }, [smoothing]);

  const handleToggleGrid = useCallback(() => {
    if (!drawingRef.current) return;

    setGrid(!grid);
  }, [grid]);

  const handleChangeRadius = useCallback((_, value) => {
    if (!drawingRef.current) return;

    const num = Number(value);

    if (Number.isNaN(num)) return;

    drawingRef.current.penWidth = num;
    setRadius(num);
  }, []);

  const handleChangeSampleRate = useCallback((_, value) => {
    if (!drawingRef.current) return;

    const num = Number(value);

    if (Number.isNaN(num)) return;

    drawingRef.current.changeDelay(num);
    setSampleRate(num);
  }, []);

  const updatePenColor = useCallback(color => {
    if (!drawingRef.current) return;

    drawingRef.current.penColor = color;
    setPenColor(color);
  }, []);

  const handleChangePenColor = useCallback(color => {
      updatePenColor(color.hex);
    },
    [updatePenColor]
  );

  const handleClear = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.clear();
  }, []);

  const handleUndo = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.undo();
  }, [drawingRef]);

  const handleToggleDraw = useCallback(() => {
    if (!drawingRef.current) return;

    drawing ? drawingRef.current.off() : drawingRef.current.on();

    setDrawing(!drawing);
  }, [drawing, drawingRef]);

  useEffect(() => {
    if (drawingRef.current) return;

    if (!divRef.current) return;

    const drawingOptions = { curve: smoothing, close: false, delay: sampleRate, penWidth: radius, penColor: '#f50057', fill: 'none' };
    drawingRef.current = new SvgDrawing(divRef.current, drawingOptions);
  });

  return (
    <Fragment>
      <div ref={divRef} className="canvas" style={{ backgroundImage: grid ? lattice(size) : 'none', backgroundSize: `${size}px ${size}px` }}/>

      <div className="options">
        <div className="canvas-buttons">
          <IconButton color="secondary" onClick={handleClear}><ClearIcon /></IconButton>
          <IconButton color="secondary" onClick={handleUndo}><UndoIcon /></IconButton>
          <IconButton color="secondary" onClick={handleToggleSmoothing}>{smoothing ? <GestureIcon /> : <ShowChartIcon />}</IconButton>
          <IconButton color="secondary" onClick={handleToggleGrid}>{grid ? <GridOnIcon /> : <GridOffIcon />}</IconButton>
          <IconButton color="secondary" onClick={handleToggleDraw}>{drawing ? <BrushIcon /> : <PanToolIcon />}</IconButton>
          <Button color="secondary" size="small" onClick={handleDownload('png')}>PNG</Button>
          <Button color="secondary" size="small" onClick={handleDownload('svg')}>SVG</Button>
        </div>

        <div className="slider-holder">
          <Typography className="option-label" variant="body2" color="secondary">Radius</Typography>
          <Slider color="secondary" value={radius} valueLabelDisplay="auto" step={1} min={1} max={40} onChange={handleChangeRadius}/>
        </div>

        <div className="slider-holder">
          <Typography className="option-label" variant="body2" color="secondary">Sample Rate</Typography>
          <Slider color="secondary" value={sampleRate} valueLabelDisplay="auto" step={5} min={0} max={300} onChange={handleChangeSampleRate}/>
        </div>

        <ChromePicker className="color-picker" color={penColor} onChangeComplete={handleChangePenColor}/>
      </div>
    </Fragment>
  )
}

export default App;
