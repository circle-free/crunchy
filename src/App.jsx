import React, { Fragment, useCallback, useState, useEffect } from 'react';
import EventEmitter from 'events';
import { useSvgDrawing } from './svg-drawing/react';
import { ChromePicker } from 'react-color';
import { getOrCreatePeerId } from './peer-id';

// Chat over Pubsub
import PubsubChat from './chat';

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
import SyncIcon from '@material-ui/icons/Sync';
import SyncDisabledIcon from '@material-ui/icons/SyncDisabled';
import PublishIcon from '@material-ui/icons/Publish';
import './App.css';

const size = 30;
const DEFAULT_PEN_RADIUS = 5;
const DEFAULT_PEN_COLOR = '#f50057';
const DEFAULT_PEN_SAMPLE_RATE = 20;
const DEFAULT_PEN_SMOOTHING = true;
const DEFAULT_PEN_ENABLED = true;
const DEFAULT_PEN_CLOSE = false;
const DEFAULT_PEN_FILL = 'none';
const DEFAULT_CANVAS_GRID = true;
// const DEFAULT_INTEGERS = true;

const getSvgPath = () => {
  return `<path id="5a9acc55-fb7b-47d0-b630-ff885facc66b" fill="none" stroke="#f50057" stroke-width="5" d="M 57.59 56.22 C 57.33 56.48 57.43 56.27 56.3 57.51 C 55.16 58.75 53.31 60.45 51.91 62.41 C 50.52 64.37 50.52 64.47 49.34 67.3 C 48.15 70.12 47.12 73.4 45.98 76.53 C 44.85 79.66 44.72 79.54 43.66 82.94 C 42.61 86.34 41.51 89.61 40.71 93.55 C 39.91 97.48 39.89 98.88 39.68 102.61 C 39.47 106.34 39.12 108.53 39.68 112.19 C 40.23 115.85 41.05 117.92 42.47 120.9 C 43.89 123.87 44.8 125.06 46.79 127.07 C 48.77 129.07 49.98 129.85 52.37 130.93 C 54.76 132.01 56.74 132.17 58.72 132.48 C 60.7 132.79 60.14 133.04 62.27 132.48 C 64.41 131.92 66.29 131.05 69.38 129.68 C 72.48 128.31 74.22 127.34 77.76 125.62 C 81.31 123.9 83.29 122.84 87.11 121.07 C 90.93 119.3 92.27 118.75 96.87 116.75 C 101.46 114.76 105.03 113.18 110.09 111.09 C 115.15 109 116.84 108.1 122.19 106.3 C 127.54 104.51 132.44 103.19 136.83 102.13 C 141.22 101.06 140.12 101.32 144.15 100.99 C 148.19 100.66 152.15 100.48 157.02 100.48 C 161.89 100.49 163.8 100.14 168.5 101 C 173.21 101.86 175.35 102.68 180.52 104.77 C 185.7 106.85 189.49 108.63 194.36 111.42 C 199.23 114.21 201.1 115.27 204.88 118.73 C 208.66 122.19 210.97 125.29 213.26 128.73 C 215.54 132.16 215.39 133.29 216.3 135.91 C 217.22 138.53 217.27 139.25 217.83 141.82 C 218.39 144.39 218.74 145.83 219.1 148.75 C 219.45 151.68 219.5 153.57 219.61 156.45 C 219.71 159.32 219.55 161.02 219.61 163.13 C 219.66 165.24 219.81 165.96 219.86 167 C 219.91 168.03 219.86 167.92 219.86 168.29 C 219.86 168.65 219.86 168.65 219.86 168.8 C 219.86 168.96 219.86 169.01 219.86 169.06" stroke-linecap="round" stroke-linejoin="round"></path>`;
};

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

function App({ createLibp2p }) {
  // Draw O=object
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
  const [syncing, setSyncing] = useState(false);
  const [pathDrawnListener, setPathDrawnListener] = useState(null);

  // LibP2P
  const [peerId, setPeerId] = useState(null);
  const [libp2p, setLibp2p] = useState(null);
  const [started, setStarted] = useState(false);
  const eventBus = new EventEmitter();

  // Chat
  const [chatClient, setChatClient] = useState(null);
  const [peers, setPeers] = useState({});

  // Metrics
  const [listening, setListening] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [stats, setStats] = useState(new Map());

  // Draw
  useEffect(() => {
    if (!draw) return;

    if (!pathDrawnListener && chatClient) {
      setPathDrawnListener(draw.onPathDrawn(path => sendMessage(path.outerHTML)));
    }
  }, [draw, pathDrawnListener, chatClient]);

  // App
  useEffect(() => {
    if (!peerId) {
      console.info('Getting our PeerId.');
      getOrCreatePeerId().then(setPeerId);
      return;
    }

    if (!libp2p) {
      console.info('Creating our Libp2p instance.');
      createLibp2p(peerId).then(node => {
        setLibp2p(node);
        setStarted(true);
        console.info('Libp2p instance created.');
      });
    }
  }, [peerId, libp2p, createLibp2p, setPeerId]);

  // Chat
  useEffect(() => {
    if (!libp2p) return;

    // Create the pubsub chatClient
    if (!chatClient) {
      const pubsubChat = new PubsubChat(libp2p, PubsubChat.TOPIC);

      // Listen for messages
      pubsubChat.on('message', message => {
        if (message.from === libp2p.peerId.toB58String()) {
          message.isMine = true;
        }

        console.log(`Received path ${message.from}${message.isMine ? ' (self)' : ''} created at ${message.created}.`);

        // TODO: validate message
        draw.insertPath(message.data.toString());
      });

      // Listen for peer updates
      pubsubChat.on('peer:update', ({ id, name }) => {
        setPeers(peers => {
          const newPeers = { ...peers };
          newPeers[id] = { name };
          return newPeers;
        });
      });

      // Forward stats events to the eventBus
      pubsubChat.on('stats', stats => eventBus.emit('stats', stats));

      setChatClient(pubsubChat);
    }
  }, [libp2p, chatClient, draw, eventBus, setChatClient]);

  // Metrics
  useEffect(() => {
    if (!libp2p) return;

    if (!listening) {
      eventBus.on('stats', stats => {
        setStats(stats);
      });

      libp2p.peerStore.on('peer', peerId => {
        const num = libp2p.peerStore.peers.size;
        setPeerCount(num);
      });

      setListening(true);

      return;
    }
  }, [libp2p, listening, eventBus, setStats, setPeerCount, setListening]);

  // Sends the current message in the chat field
  const sendMessage = async message => {
    if (!message) return;

    if (!chatClient) return;

    if (chatClient.checkCommand(message)) return;

    try {
      await chatClient.send(message);
      console.info('Publish done');
    } catch (err) {
      console.error('Could not send message', err);
    }
  };

  // Draw logic start
  const handleToggleGrid = useCallback(() => {
    setGrid(!grid);
  }, [draw, grid]);

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

  const handlePublish = useCallback(
    color => {
      draw.getDrawnPaths().map(path => {
        // TODO: maybe some validation here
        sendMessage(path.outerHTML);
      });
    },
    [draw],
  );

  const syncDrawnPaths = () => {
    // setSyncing(true);
    // getLastPath();
    // setSyncing(false);
  };

  const handleToggleSync = useCallback(() => {
    setAutoSync(!autoSync);

    if (!autoSync) syncDrawnPaths();
  }, [autoSync]);
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
          {/* <IconButton color="secondary" onClick={handleClear}><ClearIcon /></IconButton> */}
          <IconButton color="secondary" onClick={handleUndo}>
            <UndoIcon />
          </IconButton>
          <IconButton color="secondary" onClick={handlePublish}>
            <PublishIcon />
          </IconButton>
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
          {/* <IconButton color="secondary" onClick={handleToggleSync}>{autoSync ? <SyncIcon /> : <SyncDisabledIcon />}</IconButton> */}
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
