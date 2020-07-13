import React, { useEffect, useRef, Fragment, useCallback, useState, ChangeEvent } from 'react';
import { SvgDrawing, SvgAnimation, FrameAnimation, Command, Point } from 'svg-drawing';
import Pressure from 'pressure';
import './App.css';

const size = 30;

const colorList = [
  'none',
  '#F44336',
  '#E91E63',
  '#9C27B0',
  '#673AB7',
  '#3F51B5',
  '#2196F3',
  '#00BCD4',
  '#009688',
  '#4CAF50',
  '#8BC34A',
  '#CDDC39',
  '#FFEB3B',
  '#FFC107',
  '#FF9800',
  '#FF5722',
  '#795548',
  '#ddd',
  '#9E9E9E',
  '#444',
  'black',
];

const getRandomInt = max => Math.floor(Math.random() * Math.floor(max));

const getRandomColor = () => `#${Array.from({ length: 3 }, () => String(getRandomInt(255).toString(16)).padStart(2, '0')  ).join('')}`;

const CANVAS_SIZE = window.innerHeight > window.innerWidth ? '98vw' : '49vw';

const shake = paths => {
  const range = 5;
  const randomShaking = () => Math.random() * range - range / 2;

  for (let i = 0; i < paths.length; i += 1) {
    paths[i].commands = paths[i].commands.map(c => {
      c.point = c.point?.add(new Point(randomShaking(), randomShaking()));
      c.cl = c.cl?.add(new Point(randomShaking(), randomShaking()));
      c.cr = c.cr?.add(new Point(randomShaking(), randomShaking()));

      return c;
    });
  }

  return paths;
};

const colorfulList = [
  '#F44336',
  '#E91E63',
  '#9C27B0',
  '#673AB7',
  '#3F51B5',
  '#2196F3',
  '#00BCD4',
  '#009688',
  '#4CAF50',
  '#8BC34A',
  '#CDDC39',
  '#FFEB3B',
  '#FFC107',
  '#FF9800',
  '#FF5722',
];

const colorfulAnimation = (paths, fid) => {
  for (let i = 0; i < paths.length; i += 1) {
    paths[i].stroke = colorfulList[fid % colorfulList.length];
    paths[i].fill = colorfulList[(fid + 4) % colorfulList.length];
  }

  return paths;
};

const drawingAnimation = (paths, count) => {
  const update = [];

  for (let i = 0; i < paths.length; i += 1) {
    if (count < paths[i].commands.length) {
      paths[i].commands = paths[i].commands.slice(0, count);
      update.push(paths[i]);
      break;
    }

    count -= paths[i].commands.length;
    update.push(paths[i]);
  }

  return update;
}

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
  const aniDivRef = useRef(null);
  const animationRef = useRef(null);
  
 
  // const [thinner, switchThinner] = useState(true);
  const [rainbowPen, switchRainbowPen] = useState(false);
  const [curve, switchCurve] = useState(true);
  const [close, switchClose] = useState(false);
  const [fill, setFill] = useState('none');
  const [penColor, setPenColor] = useState('black');
  const [delay, setDelay] = useState(20);
  const [animMs, setAnimMs] = useState(20);
  const [penWidth, setPenWidth] = useState(5);

  const clickDownload = useCallback(extension => e => {
      if (!drawingRef.current) return;

      drawingRef.current.download(extension);
    },
    []
  );

  // const pressureChange = useCallback(
  //   (force: any, event: any) => {
  //     if (!thinner) return
  //     if (!drawingRef.current) return
  //     const pw = 30 - Math.floor(force * 40)
  //     drawingRef.current.penWidth = pw
  //   },
  //   [thinner]
  // )

  const handleChangeRainbowPen = useCallback(e => {
    if (!drawingRef.current) return;

    drawingRef.current.fill = 'none';
    drawingRef.current.close = false;
    switchRainbowPen(e.target.checked);
  }, []);

  // const handleChangeThinner = useCallback(e => {
  //   if (!drawingRef.current) return
  //   switchThinner(e.target.checked)
  // }, [])

  const handleChangeCurve = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.curve = !curve;
    switchCurve(!curve);
  }, [curve]);

  const handleChangeClose = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.close = !close;
    switchClose(!close);
  }, [close]);

  const handlePenWidth = useCallback(e => {
    if (!drawingRef.current) return;

    const num = Number(e.target.value);

    if (Number.isNaN(num)) return;

    drawingRef.current.penWidth = num;
    setPenWidth(num);
  }, []);

  const handleChangeDelay = useCallback(e => {
    if (!drawingRef.current) return;

    const num = Number(e.target.value);

    if (Number.isNaN(num)) return;

    drawingRef.current.changeDelay(num);
    setDelay(num);
  }, []);

  const handleChangeAnimMs = useCallback(e => {
    if (!animationRef.current) return;

    const num = Number(e.target.value);

    if (Number.isNaN(num)) return;

    animationRef.current.ms = num;
    setAnimMs(num);
  }, []);

  const updatePenColor = useCallback(color => {
    if (!drawingRef.current) return;

    drawingRef.current.penColor = color;
    setPenColor(color);
  }, []);

  const handleChangePenColor = useCallback(e => {
      updatePenColor(e.target.value)
    },
    [updatePenColor]
  );

  const handleClickPenColor = useCallback(col => () => {
      updatePenColor(col)
    },
    [updatePenColor]
  );

  const updateFill = useCallback(color => {
    if (!drawingRef.current) return;

    drawingRef.current.fill = color;
    setFill(color);
  }, []);

  const handleChangeFill = useCallback(e => {
      updateFill(e.target.value)
    },
    [updateFill]
  );

  const handleClickFill = useCallback(col => () => {
      updateFill(col)
    },
    [updateFill]
  );

  const clickClear = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.clear();
  }, []);

  const clickUndo = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.undo();
  }, [drawingRef]);

  const clickOff = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.off();
  }, [drawingRef]);

  const clickOn = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current.on();
  }, [drawingRef]);

  useEffect(() => {
    if (drawingRef.current) return;

    if (!divRef.current) return;

    const drawingOptions = { curve, close, delay, penWidth, fill };
    drawingRef.current = new SvgDrawing(divRef.current, drawingOptions);
  })

  useEffect(() => {
    if (animationRef.current) return;

    if (!aniDivRef.current) return;

    const animationOptions = { ms: animMs };
    animationRef.current = new SvgAnimation(aniDivRef.current, animationOptions);
  });

  useEffect(() => {
    const stop = setInterval(() => {
      if (drawingRef.current && rainbowPen) {
        const color = getRandomColor();
        drawingRef.current.penColor = color;
        setPenColor(color);
      }
    }, delay * 4);

    return () => clearInterval(stop);
  }, [delay, rainbowPen]);

  const handleFiles = useCallback(e => {
    const reader = new FileReader();

    reader.onload = ev => {
      if (typeof ev.target.result !== 'string') return;

      const [type, data] = ev.target.result.split(',');

      if (type === 'data:image/svg+xml;base64') {
        const svgXml = atob(data);

        if (!drawingRef.current) return;

        drawingRef.current.parseSVGString(svgXml);
        drawingRef.current.update();
      }
    };

    reader.readAsDataURL(e.target.files[0]);
  }, []);

  const handleClickShake = useCallback(() => {
    if (!animationRef.current) return;

    if (!drawingRef.current) return;

    animationRef.current.setAnimation(shake, { frames: 3 });
    animationRef.current.copy(drawingRef.current);
    animationRef.current.start();
  }, []);

  const handleClickDrawingAnimation = useCallback(() => {
    if (!animationRef.current) return;

    if (!drawingRef.current) return;

    animationRef.current.setAnimation(drawingAnimation, { repeatCount: 1 });
    animationRef.current.copy(drawingRef.current);
    animationRef.current.start();
  }, []);

  const handleClickColorfulAnimation = useCallback(() => {
    if (!animationRef.current) return;

    if (!drawingRef.current) return;

    animationRef.current.setAnimation(colorfulAnimation, { frames: colorfulList.length });
    animationRef.current.copy(drawingRef.current);
    animationRef.current.start();
  }, []);

  const handleClickStop = useCallback(() => {
    if (!animationRef.current) return;

    animationRef.current.stop();
  }, []);

  const handleClickRestore = useCallback(() => {
    if (!animationRef.current) return;

    animationRef.current.restore();
  }, []);

  const handleDownloadAnimation = useCallback(() => {
    if (!animationRef.current) return;

    animationRef.current.downloadAnimation();
  }, []);

  // useEffect(() => {
  //   if (!divRef.current) return
  //   Pressure.set(divRef.current, {
  //     change: throttle(pressureChange, delay)
  //   })
  // })

  return (
    <Fragment>
      <div>
        <fieldset>
          <h3>PEN CONFIG</h3>

          <div>
            STROKE WIDTH:
            <input type="number" min="1" max="20" step="1" value={penWidth} onChange={handlePenWidth} />
            <input type="range" min="1" max="20" step="1" value={penWidth} onChange={handlePenWidth} />
          </div>

          <div>
            THROTTLE DELAY:
            <input type="number" min="0" max="300" step="5" value={delay} onChange={handleChangeDelay} />
            <input type="range" min="0" max="300" step="5" value={delay} onChange={handleChangeDelay} />
          </div>

          {/* TODO: fix <label> <input type="checkbox" checked={thinner} onChange={handleChangeThinner} /> Thinner </label> */}

          <label> Curve <input type="checkbox" checked={curve} onChange={handleChangeCurve} /> </label>

          {!rainbowPen && (<label> Close <input type="checkbox" checked={close} onChange={handleChangeClose} /> </label>)}
        </fieldset>

        <fieldset>
          <h3>COLOR</h3>

          <label> Rainbow pen <input type="checkbox" checked={rainbowPen} onChange={handleChangeRainbowPen} /> </label>

          {!rainbowPen && (
            <>
              <div> FILL: <input type="text" placeholder="#000 or black or rgba(0,0,0,1)" value={fill} onChange={handleChangeFill} /> </div>

              <div>
                {colorList.map(col => (
                  <div className="color-elem" key={col} style={{ backgroundColor: col, border: col === fill ? '2px solid #000' : '2px solid #999' }} onClick={handleClickFill(col)} />
                ))}
              </div>

              <div> PEN COLOR: <input type="text" placeholder="#000 or black or rgba(0,0,0,1)" value={penColor} onChange={handleChangePenColor} /> </div>

              <div>
                {colorList.map(col => (
                  <div className="color-elem" key={col} style={{ backgroundColor: col, border: col === penColor ? '2px solid #000' : '2px solid #999' }} onClick={handleClickPenColor(col)} />
                ))}
              </div>
            </>
          )}
        </fieldset>

        <fieldset>
          <h3>Load Svg files</h3>
          <p>Svg exported by this library can be read.</p>
          <input type="file" onChange={handleFiles} multiple accept="image/*" />
        </fieldset>
      </div>

      <div className="flex-wrap">
        <div>
          <fieldset>
            <h3>Drawing methods</h3>

            <button onClick={clickClear}>Clear</button>
            <button onClick={clickUndo}>Undo</button>
            <button onClick={clickOff}>OFF</button>
            <button onClick={clickOn}>ON</button>
            <button onClick={clickDownload('png')}>Download PNG</button>
            <button onClick={clickDownload('jpg')}>Download JPG</button>
            {/* <button onClick={clickDownloadGIF}>Download GIF</button> */}
            <button onClick={clickDownload('svg')}>Download SVG</button>
          </fieldset>

          <div ref={divRef} style={{ backgroundImage: lattice(size), backgroundSize: `${size}px ${size}px`, border: '1px solid #333', width: CANVAS_SIZE, height: CANVAS_SIZE, margin: 'auto' }} />
        </div>

        <div>
          <fieldset>
            <h3>Animation methods</h3>

            <button onClick={handleClickShake}>Shaking</button>
            <button onClick={handleClickDrawingAnimation}>Drawing</button>
            <button onClick={handleClickColorfulAnimation}>Colorful</button>
            <button onClick={handleClickStop}>Stop</button>
            <button onClick={handleClickRestore}>Restore</button>
            <button onClick={handleDownloadAnimation}>Download Animation SVG</button>

            <div>
              ANIMATION MS
              <input type="number" min="0" max="500" step="5" value={animMs} onChange={handleChangeAnimMs} />
              <input type="range" min="0" max="500" step="5" value={animMs} onChange={handleChangeAnimMs} />
            </div>
          </fieldset>

          <div ref={aniDivRef} style={{ backgroundSize: `${size}px ${size}px`, border: '1px solid #333', width: CANVAS_SIZE, height: CANVAS_SIZE, margin: 'auto' }} />
        </div>
      </div>
    </Fragment>
  )
}

export default App;
