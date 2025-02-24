if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(Registration => {
                console.log('Service Worker registered with scope:', Registration.scope);
            }).catch(Error => {
                console.log('Service Worker registration failed:', Error);
            });
    });
}

let Canvas, Ctx;
let CurrentTool = 'pencil';
let CurrentColor = '#000000';
let CurrentSize = 2;
let IsDrawing = false;
let Layers = [];
let CurrentLayer = 0;
let UndoStack = [];
let RedoStack = [];
let LastX, LastY;
let UsePressure = true;
let PressureSensitivity = 1;
let resizingLayer = null;
let originalAspectRatio = 1;

window.onload = function () {
    document.querySelectorAll('.ToolButton').forEach(Button => {
        Button.addEventListener('click', () => SetTool(Button.dataset.tool));
    });
    
    SetTool('pencil');
    
    document.querySelector('[data-action="save"]').addEventListener('click', SaveCanvas);
    document.querySelector('[data-action="export"]').addEventListener('click', ExportCanvas);
    document.querySelector('[data-action="load"]').addEventListener('click', LoadCanvas);
    document.querySelector('[data-action="import"]').addEventListener('click', ImportImage);
    
    const colorButtons = document.querySelectorAll('.ColorButton');
    let SelectedColorButton = colorButtons[0];
    SelectedColorButton.style.borderColor = '#000';
    
    colorButtons.forEach((ColorButton) => {
        ColorButton.addEventListener('click', handleColorButtonClick);
    });
    
    const pressureToggle = document.getElementById('PressureToggle');
    const pressureSlider = document.getElementById('PressureSlider');
    const pressureValue = document.getElementById('PressureValue');
    
    pressureToggle.addEventListener('change', (e) => {
        UsePressure = e.target.checked;
        pressureSlider.disabled = !UsePressure;
    });
    
    pressureSlider.addEventListener('input', (e) => {
        PressureSensitivity = parseFloat(e.target.value);
        pressureValue.textContent = PressureSensitivity.toFixed(1);
    });
    
    document.getElementById('UndoButton').addEventListener('click', Undo);
    document.getElementById('RedoButton').addEventListener('click', Redo);
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ColorButton') && !e.target.classList.contains('color-picker-input')) {
            const existingPicker = document.querySelector('.color-picker-input');
            if (existingPicker) existingPicker.remove();
        }
    });
    
    SetupCanvas();
    
    function handleColorButtonClick(e) {
        if (SelectedColorButton === this) {
            const existingPicker = document.querySelector('.color-picker-input');
            if (!existingPicker) {
                const ColorPicker = document.createElement('input');
                ColorPicker.type = 'color';
                ColorPicker.value = this.dataset.currentColor;
                ColorPicker.className = 'color-picker-input';
                ColorPicker.style.cssText = `
                    top: calc(100% + 5px);
                    left: ${this.getBoundingClientRect().left}px;
                `;
                
                ColorPicker.addEventListener('input', (e) => {
                    const newColor = e.target.value;
                    this.style.background = newColor;
                    this.dataset.currentColor = newColor;
                    CurrentColor = newColor;
                });
                
                ColorPicker.addEventListener('change', (e) => {
                    ColorPicker.remove();
                });
                
                document.body.appendChild(ColorPicker);
                setTimeout(() => ColorPicker.click(), 50);
            }
        } else {
            if (SelectedColorButton) {
                SelectedColorButton.style.borderColor = '#666';
            }
            
            SelectedColorButton = this;
            this.style.borderColor = '#000';
            CurrentColor = this.dataset.currentColor;
            
            const existingPicker = document.querySelector('.color-picker-input');
            if (existingPicker) existingPicker.remove();
        }
    }
};

function SetupCanvas() {
    Canvas = document.createElement('canvas');
    Canvas.width = 1024;
    Canvas.height = 768;
    document.getElementById('CanvasContainer').appendChild(Canvas);

    AddLayer();
    SaveState();
    SetupEventListeners();
}

function UpdateCanvas() {
    const MainCtx = Canvas.getContext('2d');
    MainCtx.clearRect(0, 0, Canvas.width, Canvas.height);

    Layers.forEach(Layer => {
        if (Layer.visible) {
            MainCtx.globalAlpha = Layer.opacity;
            MainCtx.drawImage(Layer.canvas, 0, 0);
        }
    });
}


function SetupEventListeners() {
    Canvas.addEventListener('pointerdown', StartDrawing);
    Canvas.addEventListener('pointermove', Draw);
    Canvas.addEventListener('pointerup', StopDrawing);
    Canvas.addEventListener('pointerout', StopDrawing);
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') Undo();
        if (e.ctrlKey && e.key === 'y') Redo();
    });
}

function SetTool(Tool) {
    CurrentTool = Tool;
    document.querySelectorAll('.ToolButton').forEach(Button => {
        Button.style.backgroundColor = '#ddd';
    });
    const ActiveButton = document.querySelector(`.ToolButton[data-tool="${Tool}"]`);
    if (ActiveButton) {
        ActiveButton.style.backgroundColor = '#999';
    }
}

function StartDrawing(e) {
    IsDrawing = true;
    const Rect = Canvas.getBoundingClientRect();
    LastX = e.clientX - Rect.left;
    LastY = e.clientY - Rect.top;
    LastPressure = e.pressure || 0.5;
}

function Draw(e) {
    if (!IsDrawing) return;

    const Rect = Canvas.getBoundingClientRect();
    const X = e.clientX - Rect.left;
    const Y = e.clientY - Rect.top;
    const RawPressure = e.pressure !== undefined ? e.pressure : 0.5;
    
    const AdjustedPressure = UsePressure 
        ? Math.pow(RawPressure, 1 / PressureSensitivity)
        : 1;
    
    const CurrentCtx = Layers[CurrentLayer].ctx;

    CurrentCtx.beginPath();
    CurrentCtx.moveTo(LastX, LastY);
    CurrentCtx.lineTo(X, Y);

    CurrentCtx.globalCompositeOperation = 'source-over';

    switch (CurrentTool) {
        case 'pencil':
            CurrentCtx.lineWidth = CurrentSize * AdjustedPressure;
            CurrentCtx.strokeStyle = CurrentColor;
            break;
        case 'pen':
            CurrentCtx.lineWidth = (CurrentSize * 2) * AdjustedPressure;
            CurrentCtx.strokeStyle = CurrentColor;
            break;
        case 'eraser':
            CurrentCtx.lineWidth = (CurrentSize * 2) * AdjustedPressure;
            CurrentCtx.strokeStyle = '#ffffff';
            CurrentCtx.globalCompositeOperation = 'destination-out';
            break;
    }

    CurrentCtx.lineCap = 'round';
    CurrentCtx.lineJoin = 'round';
    CurrentCtx.stroke();

    CurrentCtx.globalCompositeOperation = 'source-over';

    LastX = X;
    LastY = Y;
    UpdateCanvas();
}

function StopDrawing() {
    if (IsDrawing) {
        IsDrawing = false;
        Layers[CurrentLayer].ctx.globalCompositeOperation = 'source-over';
        SaveState();
        UpdateLayerPanel();
    }
}

function GenerateDistinctColor() {
    const ExistingColors = Layers.map(layer => layer.color);
    const MinDistance = 100;
    let NewColor;
    let Attempts = 0;
    const MaxAttempts = 100;

    function ColorDistance(color1, color2) {
        const r1 = parseInt(color1.substr(1,2), 16);
        const g1 = parseInt(color1.substr(3,2), 16);
        const b1 = parseInt(color1.substr(5,2), 16);
        const r2 = parseInt(color2.substr(1,2), 16);
        const g2 = parseInt(color2.substr(3,2), 16);
        const b2 = parseInt(color2.substr(5,2), 16);
        
        return Math.sqrt(
            Math.pow(r1 - r2, 2) +
            Math.pow(g1 - g2, 2) +
            Math.pow(b1 - b2, 2)
        );
    }

    do {
        NewColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        Attempts++;
        
        if (ExistingColors.every(existingColor => 
            ColorDistance(NewColor, existingColor) > MinDistance)) {
            return NewColor;
        }
    } while (Attempts < MaxAttempts);

    return NewColor;
}

function AddLayer() {
    const NewCanvas = document.createElement('canvas');
    NewCanvas.width = Canvas.width;
    NewCanvas.height = Canvas.height;
    const NewCtx = NewCanvas.getContext('2d');

    Layers.push({
        canvas: NewCanvas,
        ctx: NewCtx,
        visible: true,
        opacity: 1
    });

    CurrentLayer = Layers.length - 1;
    UpdateLayerPanel();
}

function UpdateLayerPanel() {
    const LayerScrollContainer = document.querySelector('#LayerPanel > div');
    LayerScrollContainer.innerHTML = '';

    const AddBtn = document.createElement('button');
    AddBtn.textContent = '+';
    AddBtn.style.cssText = `
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 4px;
        background: #ddd;
        cursor: pointer;
        margin-bottom: 10px;
    `;
    AddBtn.onclick = AddLayer;
    LayerScrollContainer.appendChild(AddBtn);

    Layers.forEach((Layer, Index) => {
        const LayerContainer = document.createElement('div');
        LayerContainer.style.cssText = `
            margin-bottom: 15px;
            width: 50px;
        `;

        const PreviewCanvas = document.createElement('canvas');
        PreviewCanvas.width = 40;
        PreviewCanvas.height = 30;
        PreviewCanvas.style.cssText = `
            border: 2px solid ${CurrentLayer === Index ? '#666' : '#999'};
            cursor: pointer;
            background-color: white;
        `;
        
        const PreviewCtx = PreviewCanvas.getContext('2d');
        drawCheckerboard(PreviewCtx, 40, 30, 5);
        
        const ScaleFactorX = 40 / Canvas.width;
        const ScaleFactorY = 30 / Canvas.height;
        PreviewCtx.save();
        PreviewCtx.scale(ScaleFactorX, ScaleFactorY);
        PreviewCtx.drawImage(Layer.canvas, 0, 0);
        PreviewCtx.restore();

        PreviewCanvas.onclick = () => {
            CurrentLayer = Index;
            Ctx = Layers[CurrentLayer].ctx;
            UpdateLayerPanel();
        };

        const ControlsContainer = document.createElement('div');
        ControlsContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
        `;

        const VisibilityBtn = document.createElement('button');
        VisibilityBtn.textContent = Layer.visible ? '👁️' : '✖';
        VisibilityBtn.style.cssText = `
            width: 18px;
            height: 18px;
            border: none;
            background: transparent;
            cursor: pointer;
            padding: 0;
            font-size: 12px;
        `;
        VisibilityBtn.onclick = (e) => {
            e.stopPropagation();
            Layer.visible = !Layer.visible;
            UpdateCanvas();
            UpdateLayerPanel();
        };

        const DeleteBtn = document.createElement('button');
        DeleteBtn.textContent = '×';
        DeleteBtn.style.cssText = `
            width: 18px;
            height: 18px;
            border: none;
            border-radius: 2px;
            background: #999;
            cursor: pointer;
            padding: 0;
            line-height: 15px;
        `;
        DeleteBtn.onclick = (e) => {
            e.stopPropagation();
            RemoveLayer(Index);
        };

        const OpacitySlider = document.createElement('input');
        OpacitySlider.type = 'range';
        OpacitySlider.min = '0';
        OpacitySlider.max = '1';
        OpacitySlider.step = '0.01';
        OpacitySlider.value = Layer.opacity;
        OpacitySlider.style.cssText = `
            width: 40px;
            margin-top: 4px;
        `;
        OpacitySlider.oninput = (e) => {
            Layer.opacity = parseFloat(e.target.value);
            UpdateCanvas();
        };

        ControlsContainer.appendChild(VisibilityBtn);
        ControlsContainer.appendChild(DeleteBtn);
        LayerContainer.appendChild(PreviewCanvas);
        LayerContainer.appendChild(ControlsContainer);
        LayerContainer.appendChild(OpacitySlider);
        LayerScrollContainer.appendChild(LayerContainer);
    });
}

function drawCheckerboard(ctx, width, height, size) {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#cccccc';
    
    for (let y = 0; y < height; y += size) {
        for (let x = 0; x < width; x += size) {
            if ((x / size + y / size) % 2 === 0) {
                ctx.fillRect(x, y, size, size);
            }
        }
    }
}

function RemoveLayer(Index) {
    if (Layers.length > 1) {
        Layers.splice(Index, 1);
        CurrentLayer = Math.min(CurrentLayer, Layers.length - 1);
    } else {
        Layers[0].ctx.clearRect(0, 0, Canvas.width, Canvas.height);
        CurrentLayer = 0;
    }
    
    if (Layers.length === 0) {
        AddLayer();
    }
    
    Ctx = Layers[CurrentLayer].ctx;
    UpdateLayerPanel();
    UpdateCanvas();
    SaveState();
}

function SaveCanvas() {
    const SaveButton = document.querySelector('[data-action="save"]');
    if (SaveButton) {
        SaveButton.style.backgroundColor = '#999';

        const SaveData = {
            layers: Layers.map(layer => ({
                data: layer.canvas.toDataURL(),
                visible: layer.visible,
                color: layer.color
            })),
            undoStack: UndoStack,
            redoStack: RedoStack,
            canvasWidth: Canvas.width,
            canvasHeight: Canvas.height,
            currentLayer: CurrentLayer
        };

        const SaveBlob = new Blob([JSON.stringify(SaveData)], {type: 'application/json'});
        const Link = document.createElement('a');
        Link.download = 'drawing.cnv';
        Link.href = URL.createObjectURL(SaveBlob);
        Link.click();

        setTimeout(() => {
            SaveButton.style.backgroundColor = '#ddd';
        }, 200);
    }
}

function LoadCanvas() {
    const Input = document.createElement('input');
    Input.type = 'file';
    Input.accept = '.cnv';
    Input.onchange = (e) => {
        const File = e.target.files[0];
        const Reader = new FileReader();
        Reader.onload = (event) => {
            const SaveData = JSON.parse(event.target.result);
            
            Layers = [];
            
            Canvas.width = SaveData.canvasWidth;
            Canvas.height = SaveData.canvasHeight;

            const LayerPromises = SaveData.layers.map((layerData, index) => {
                return new Promise((resolve) => {
                    const NewCanvas = document.createElement('canvas');
                    NewCanvas.width = SaveData.canvasWidth;
                    NewCanvas.height = SaveData.canvasHeight;
                    const NewCtx = NewCanvas.getContext('2d');
                    
                    const Img = new Image();
                    Img.onload = () => {
                        NewCtx.drawImage(Img, 0, 0);
                        resolve({
                            canvas: NewCanvas,
                            ctx: NewCtx,
                            visible: layerData.visible,
                            color: layerData.color
                        });
                    };
                    Img.src = layerData.data;
                });
            });

            Promise.all(LayerPromises).then(loadedLayers => {
                Layers = loadedLayers;

                UndoStack = SaveData.undoStack;
                RedoStack = SaveData.redoStack;

                CurrentLayer = SaveData.currentLayer;
                Ctx = Layers[CurrentLayer].ctx;

                UpdateLayerPanel();
                UpdateCanvas();
            });
        };
        Reader.readAsText(File);
    };
    Input.click();
}

function ExportCanvas() {
    const ExportButton = document.querySelector('[data-action="export"]');
    if (ExportButton) {
        ExportButton.style.backgroundColor = '#999';

        const ExportCanvas = document.createElement('canvas');
        ExportCanvas.width = Canvas.width;
        ExportCanvas.height = Canvas.height;
        const ExportCtx = ExportCanvas.getContext('2d');

        Layers.forEach(Layer => {
            if (Layer.visible) {
                ExportCtx.drawImage(Layer.canvas, 0, 0);
            }
        });

        const Link = document.createElement('a');
        Link.download = 'drawing.png';
        Link.href = ExportCanvas.toDataURL();
        Link.click();

        setTimeout(() => {
            ExportButton.style.backgroundColor = '#ddd';
        }, 200);
    }
}

function SaveState() {
    RedoStack = [];
    
    const StateCanvas = document.createElement('canvas');
    StateCanvas.width = Canvas.width;
    StateCanvas.height = Canvas.height;
    const StateCtx = StateCanvas.getContext('2d');
    
    Layers.forEach(Layer => {
        if (Layer.visible) {
            StateCtx.drawImage(Layer.canvas, 0, 0);
        }
    });
    
    UndoStack.push(StateCanvas.toDataURL());
    
    const MaxUndoSteps = 20;
    if (UndoStack.length > MaxUndoSteps) {
        UndoStack.shift();
    }
}

function Undo() {
    if (UndoStack.length > 1) {
        RedoStack.push(UndoStack.pop());
        const PreviousState = UndoStack[UndoStack.length - 1];
        
        LoadStateToLayers(PreviousState);
    }
}

function Redo() {
    if (RedoStack.length > 0) {
        const NextState = RedoStack.pop();
        UndoStack.push(NextState);
        
        LoadStateToLayers(NextState);
    }
}

function LoadStateToLayers(StateDataURL) {
    const Img = new Image();
    Img.src = StateDataURL;
    Img.onload = () => {
        Layers.forEach(Layer => {
            Layer.ctx.clearRect(0, 0, Canvas.width, Canvas.height);
        });
        
        Layers[0].ctx.drawImage(Img, 0, 0);
        UpdateCanvas();
    };
}

function ImportImage() {
    const Input = document.createElement('input');
    Input.type = 'file';
    Input.accept = 'image/*';
    Input.onchange = (e) => {
        const File = e.target.files[0];
        if (File) {
            const Reader = new FileReader();
            Reader.onload = (event) => {
                const Img = new Image();
                Img.onload = () => {
                    const NewCanvas = document.createElement('canvas');
                    NewCanvas.width = Canvas.width;
                    NewCanvas.height = Canvas.height;
                    const NewCtx = NewCanvas.getContext('2d');

                    const Scale = Math.min(
                        Canvas.width / Img.width,
                        Canvas.height / Img.height
                    );
                    const X = (Canvas.width - Img.width * Scale) / 2;
                    const Y = (Canvas.height - Img.height * Scale) / 2;

                    NewCtx.drawImage(
                        Img,
                        X,
                        Y,
                        Img.width * Scale,
                        Img.height * Scale
                    );

                    Layers.push({
                        canvas: NewCanvas,
                        ctx: NewCtx,
                        visible: true,
                        opacity: 1
                    });

                    CurrentLayer = Layers.length - 1;
                    UpdateLayerPanel();
                    UpdateCanvas();
                    SaveState();
                };
                Img.src = event.target.result;
            };
            Reader.readAsDataURL(File);
        }
    };
    Input.click();
}
