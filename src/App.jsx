import React, { Fragment, useCallback, useState, useEffect } from 'react';
import { useSvgDrawing } from './svg-drawing/react';
import { ChromePicker } from 'react-color';

import { Slider, IconButton } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import UndoIcon from '@material-ui/icons/Undo';
import GestureIcon from '@material-ui/icons/Gesture';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import GridOnIcon from '@material-ui/icons/GridOn';
import GridOffIcon from '@material-ui/icons/GridOff';
import BrushIcon from '@material-ui/icons/Brush';
import PanToolIcon from '@material-ui/icons/PanTool';
import SyncIcon from '@material-ui/icons/Sync';
import PublishIcon from '@material-ui/icons/Publish';
import './App.css';

import Node from './p2p-node';

const size = 30;
const DEFAULT_PEN_RADIUS = 5;
const DEFAULT_PEN_COLOR = '#f50057';
const DEFAULT_PEN_SAMPLE_RATE = 20;
const DEFAULT_PEN_SMOOTHING = true;
const DEFAULT_PEN_ENABLED = true;
const DEFAULT_PEN_CLOSE = false;
const DEFAULT_PEN_FILL = 'none';
const DEFAULT_CANVAS_GRID = true;

const area = path => path.getTotalLength() * Number(path.getAttribute('stroke-width'));

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
  // Draw Object
  const [renderRef, draw] = useSvgDrawing({
    penWidth: DEFAULT_PEN_RADIUS, // pen width
    penColor: DEFAULT_PEN_COLOR, // pen color
    close: DEFAULT_PEN_CLOSE, // Use close command for path. Default is false.
    curve: DEFAULT_PEN_SMOOTHING, // Use curve command for path. Default is true.
    delay: DEFAULT_PEN_SAMPLE_RATE, // Set how many ms to draw points every.
    fill: DEFAULT_PEN_FILL, // Set fill attribute for path. default is `none`
  });

  // Drawing
  const [grid, setGrid] = useState(DEFAULT_CANVAS_GRID);
  const [radius, setRadius] = useState(DEFAULT_PEN_RADIUS);
  const [sampleRate, setSampleRate] = useState(DEFAULT_PEN_SAMPLE_RATE);
  const [penColor, setPenColor] = useState(DEFAULT_PEN_COLOR);
  const [smoothing, setSmoothing] = useState(DEFAULT_PEN_SMOOTHING);
  const [drawing, setDrawing] = useState(DEFAULT_PEN_ENABLED);
  const [autoSync, setAutoSync] = useState(false);
  const [pathDrawnListener, setPathDrawnListener] = useState(null);

  // Node
  const [node, setNode] = useState(null);
  const [started, setStarted] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Draw
  useEffect(() => {
    if (!draw) return;

    if (pathDrawnListener && !autoSync) {
      draw.offPathDrawn(pathDrawnListener);
      setPathDrawnListener(null);
    }

    if (!pathDrawnListener && node && autoSync) {
      const callback = sendPath;
      draw.onPathDrawn(callback);
      setPathDrawnListener(() => callback);
    }
  }, [draw, pathDrawnListener, node]);

  // Node
  useEffect(() => {
    if (node) return;

    console.info('Creating P2P node instance.');
    const p2pNode = new Node();
    setNode(p2pNode);

    // Subscribe to events
    p2pNode.on('path', ({ id, data, predecessorIds }) => {
      // TODO: Handle looking for id and predecessorIds
      draw.insertPath(data);
      console.log('Path inserted.');
    });

    p2pNode.start().then(paths => {
      // paths.map(({ data }) => draw.insertPath(data));
      console.info('P2P node instance started.');
    });
  }, [node, draw]);

  const sendPath = async svgPath => {
    if (!svgPath || !node) return;

    // TODO: handle removal if not success
    const success = await node.broadcastPath({ id: svgPath.id, data: svgPath.outerHTML });
  };

  // Draw logic start
  const handleToggleGrid = useCallback(() => {
    setGrid(!grid);
  }, [grid]);

  const handleClear = useCallback(() => {
    draw.clear();
  }, [draw]);

  const handleUndo = useCallback(() => {
    draw.undo();
  }, [draw]);

  const handleChangeRadius = useCallback(
    (_, value) => {
      const num = Number(value);

      if (Number.isNaN(num)) return;

      draw.changePenWidth(num);
      setRadius(num);
    },
    [draw],
  );

  const handleToggleSmoothing = useCallback(() => {
    draw.changeCurve(!smoothing);
    setSmoothing(!smoothing);
  }, [draw, smoothing]);

  const handleToggleDraw = useCallback(() => {
    drawing ? draw.off() : draw.on();
    setDrawing(!drawing);
  }, [draw, drawing]);

  const handleChangeSampleRate = useCallback(
    (_, value) => {
      const num = Number(value);

      if (Number.isNaN(num)) return;

      draw.changeDelay(num);
      setSampleRate(num);
    },
    [draw],
  );

  const handleChangePenColor = useCallback(
    color => {
      draw.changePenColor(color.hex);
      setPenColor(color.hex);
    },
    [draw],
  );

  const handleDownload = useCallback(
    extension => e => {
      // console.log(draw.getSvgXML());
      draw.download(extension);
    },
    [draw],
  );

  const handlePublish = useCallback(() => {
    draw.getDrawnPaths().map(sendPath);
  }, [draw]);

  const handleToggleSync = useCallback(() => {
    if (!autoSync) handlePublish();

    setAutoSync(!autoSync);
  }, [autoSync, handlePublish]);
  // Draw logic end

  return (
    <Fragment>
      <div className="canvas-viewport">
        <div
          ref={renderRef}
          className="canvas"
          style={{ backgroundImage: grid ? lattice(size) : 'none', backgroundSize: `${size}px ${size}px` }}
        />
      </div>

      <div className="options">
        <div className="canvas-buttons">
          {/* <IconButton color="secondary" onClick={handleClear}>
            <ClearIcon />
          </IconButton> */}
          <IconButton color="secondary" onClick={handleUndo}>
            <UndoIcon />
          </IconButton>
          {/* <IconButton color="secondary" onClick={handlePublish}>
            <PublishIcon />
          </IconButton> */}
          <IconButton color="secondary" onClick={handleToggleSmoothing}>
            {smoothing ? <GestureIcon /> : <ShowChartIcon />}
          </IconButton>
          <IconButton color="secondary" onClick={handleToggleGrid}>
            {grid ? <GridOnIcon /> : <GridOffIcon />}
          </IconButton>
          <IconButton color="secondary" onClick={handleToggleDraw}>
            {drawing ? <BrushIcon /> : <PanToolIcon />}
          </IconButton>
          {/* <Button color="secondary" size="small" onClick={handleDownload('png')}>PNG</Button> */}
          {/* <Button color="secondary" size="small" onClick={handleDownload('svg')}>SVG</Button> */}
          <IconButton color="secondary" onClick={handleToggleSync}>
            {autoSync ? <SyncIcon /> : <PublishIcon />}
          </IconButton>
        </div>

        <div className="slider-holder">
          <Typography className="option-label" variant="body2" color="secondary">
            Radius
          </Typography>
          <Slider color="secondary" value={radius} valueLabelDisplay="auto" step={1} min={1} max={40} onChange={handleChangeRadius} />
        </div>

        <div className="slider-holder">
          <Typography className="option-label" variant="body2" color="secondary">
            Sample Rate
          </Typography>
          <Slider
            color="secondary"
            value={sampleRate}
            valueLabelDisplay="auto"
            step={5}
            min={0}
            max={300}
            onChange={handleChangeSampleRate}
          />
        </div>

        <ChromePicker className="color-picker" color={penColor} onChangeComplete={handleChangePenColor} />
      </div>
    </Fragment>
  );
}

export default App;
