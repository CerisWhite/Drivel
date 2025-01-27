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

window.onload = function () {
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';

    const MainContainer = document.createElement('div');
    MainContainer.id = 'MainContainer';
    MainContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: white;
    `;
    document.body.appendChild(MainContainer);

    const Toolbar = document.createElement('div');
	Toolbar.id = 'Toolbar';
	Toolbar.style.cssText = `
	    height: 50px;
	    width: calc(100% - 20px);
	    background: #f0f0f0;
	    display: flex;
	    align-items: center;
	    padding: 0 10px;
	    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
	    position: relative;
	    z-index: 1000;
	    box-sizing: border-box;
	`;
    MainContainer.appendChild(Toolbar);

    const ToolsContainer = document.createElement('div');
    ToolsContainer.style.cssText = `
        display: flex;
        gap: 10px;
    `;
    Toolbar.appendChild(ToolsContainer);

    const ActionsContainer = document.createElement('div');
    ActionsContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-left: auto;
    `;
    Toolbar.appendChild(ActionsContainer);

	const ColorContainer = document.createElement('div');
	ColorContainer.style.cssText = `
	    display: flex;
	    gap: 5px;
	    margin-left: 10px;
	`;
	Toolbar.appendChild(ColorContainer);
	
	let SelectedColorButton = null;
	
	const colors = ['#000000', '#ffffff'];
	colors.forEach((color, index) => {
	    const ColorButton = document.createElement('button');
	    ColorButton.className = 'ColorButton';
	    ColorButton.setAttribute('data-color-index', index);
	    ColorButton.style.cssText = `
	        width: 30px;
	        height: 30px;
	        border: 2px solid #666;
	        border-radius: 4px;
	        background: ${color};
	        cursor: pointer;
	        padding: 0;
	        position: relative;
	    `;
	    
	    ColorButton.dataset.currentColor = color;
	    
	    ColorButton.addEventListener('click', (e) => {
	        if (SelectedColorButton === ColorButton) {
	            const existingPopup = document.querySelector('.ColorPickerPopup');
	            if (!existingPopup) {
	                const ColorPicker = document.createElement('input');
	                ColorPicker.type = 'color';
	                ColorPicker.value = ColorButton.dataset.currentColor;
	                
	                const Popup = document.createElement('div');
	                Popup.className = 'ColorPickerPopup';
	                Popup.setAttribute('data-button-index', index);
	                Popup.style.cssText = `
	                    position: absolute;
	                    top: 100%;
	                    left: 0;
	                    padding: 10px;
	                    background: white;
	                    border: 1px solid #ccc;
	                    border-radius: 4px;
	                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
	                    z-index: 1000;
	                `;
	                
	                ColorPicker.addEventListener('input', (e) => {
	                    const newColor = e.target.value;
	                    ColorButton.style.background = newColor;
	                    ColorButton.dataset.currentColor = newColor;
	                    CurrentColor = newColor;
	                });
	                
	                ColorPicker.addEventListener('change', (e) => {
	                    Popup.remove();
	                });
	                
	                Popup.appendChild(ColorPicker);
	                ColorButton.appendChild(Popup);
	                ColorPicker.click();
	            }
	        } else {
	            if (SelectedColorButton) {
	                SelectedColorButton.style.borderColor = '#666';
	            }
	            
	            SelectedColorButton = ColorButton;
	            ColorButton.style.borderColor = '#000';
	            CurrentColor = ColorButton.dataset.currentColor;
	            
	            const existingPopup = document.querySelector('.ColorPickerPopup');
	            if (existingPopup) existingPopup.remove();
	        }
	    });
	    
	    ColorContainer.appendChild(ColorButton);
	    
	    if (index === 0) {
	        SelectedColorButton = ColorButton;
	        ColorButton.style.borderColor = '#000';
	        CurrentColor = color;
	    }
	});
	
	document.addEventListener('click', (e) => {
	    if (!e.target.closest('.ColorButton')) {
	        const popup = document.querySelector('.ColorPickerPopup');
	        if (popup) popup.remove();
	    }
	});

	const PressureContainer = document.createElement('div');
	PressureContainer.style.cssText = `
	    display: flex;
	    align-items: center;
	    margin-left: 20px;
	    gap: 10px;
	`;
	Toolbar.appendChild(PressureContainer);
	
	const PressureToggleContainer = document.createElement('div');
	PressureToggleContainer.style.cssText = `
	    display: flex;
	    align-items: center;
	    gap: 5px;
	`;
	PressureContainer.appendChild(PressureToggleContainer);
	
	const PressureToggleLabel = document.createElement('label');
	PressureToggleLabel.textContent = 'Use Pressure:';
	PressureToggleLabel.style.cssText = `
	    font-family: Arial, sans-serif;
	    font-size: 14px;
	`;
	PressureToggleContainer.appendChild(PressureToggleLabel);
	
	const PressureToggle = document.createElement('input');
	PressureToggle.type = 'checkbox';
	PressureToggle.checked = true;
	PressureToggleContainer.appendChild(PressureToggle);
	PressureToggle.addEventListener('change', (e) => {
	    UsePressure = e.target.checked;
	    PressureSlider.disabled = !UsePressure;
	});
	
	const PressureSliderContainer = document.createElement('div');
	PressureSliderContainer.style.cssText = `
	    display: flex;
	    align-items: center;
	    gap: 5px;
	`;
	PressureContainer.appendChild(PressureSliderContainer);
	
	const PressureLabel = document.createElement('label');
	PressureLabel.textContent = 'Sensitivity:';
	PressureLabel.style.cssText = `
	    font-family: Arial, sans-serif;
	    font-size: 14px;
	`;
	PressureSliderContainer.appendChild(PressureLabel);
	
	const PressureSlider = document.createElement('input');
	PressureSlider.type = 'range';
	PressureSlider.min = '0.1';
	PressureSlider.max = '3';
	PressureSlider.step = '0.1';
	PressureSlider.value = '1';
	PressureSlider.style.cssText = `
	    width: 100px;
	`;
	PressureSliderContainer.appendChild(PressureSlider);
	
	const PressureValue = document.createElement('span');
	PressureValue.textContent = '1.0';
	PressureValue.style.cssText = `
	    font-family: Arial, sans-serif;
	    font-size: 14px;
	    width: 30px;
	`;
	PressureSliderContainer.appendChild(PressureValue);
	PressureSlider.addEventListener('input', (e) => {
	    PressureSensitivity = parseFloat(e.target.value);
	    PressureValue.textContent = PressureSensitivity.toFixed(1);
	});

    const LowerContainer = document.createElement('div');
    LowerContainer.style.cssText = `
        flex: 1;
        display: flex;
        position: relative;
        height: calc(100vh - 50px);
        overflow: hidden;
    `;
    MainContainer.appendChild(LowerContainer);

    const LayerPanel = document.createElement('div');
    LayerPanel.id = 'LayerPanel';
    LayerPanel.style.cssText = `
        width: 50px;
        height: 100%;
        background: #f0f0f0;
        border-right: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 10px;
    `;
    LowerContainer.appendChild(LayerPanel);

    const CanvasContainer = document.createElement('div');
    CanvasContainer.id = 'CanvasContainer';
    CanvasContainer.style.cssText = `
        flex: 1;
        position: relative;
        overflow: auto;
        background: #888;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1;
    `;
    LowerContainer.appendChild(CanvasContainer);

    const Tools = ['pencil', 'pen', 'eraser'];
    Tools.forEach(Tool => {
        const Button = document.createElement('button');
        Button.textContent = Tool;
        Button.classList.add('ToolButton');
        Button.setAttribute('data-tool', Tool);
        Button.style.cssText = `
            padding: 5px 10px;
            border: none;
            border-radius: 4px;
            background: #ddd;
            cursor: pointer;
            text-transform: capitalize;
            transition: background-color 0.2s;
        `;
        Button.addEventListener('click', () => SetTool(Tool));

        if (Tool === CurrentTool) {
            Button.style.backgroundColor = '#999';
        }
        ToolsContainer.appendChild(Button);
    });

    const Actions = ['Save', 'Load', 'Export'];
    Actions.forEach(Action => {
        const Button = document.createElement('button');
        Button.textContent = Action;
        Button.classList.add('ActionButton');
        Button.setAttribute('data-action', Action.toLowerCase());
        Button.style.cssText = `
            padding: 5px 10px;
            border: none;
            border-radius: 4px;
            background: #ddd;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        Button.addEventListener('click', () => {
		    if (Action === 'Save') {
		        SaveCanvas();
		    } else if (Action === 'Export') {
		        ExportCanvas();
		    } else if (Action === 'Load') {
		        LoadCanvas();
		    }
		});
        ActionsContainer.appendChild(Button);
    });

    const StyleSheet = document.createElement('style');
    StyleSheet.textContent = `
        .ToolButton, .ActionButton {
            padding: 5px 10px;
            border: none;
            border-radius: 4px;
            background: #ddd;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .ToolButton:hover, .ActionButton:hover {
            background-color: #aaa !important;
        }

        .ToolButton.active {
            background-color: #999 !important;
        }
		.ColorButton {
        transition: transform 0.1s;
	    }
	    
	    .ColorButton:hover {
	        transform: scale(1.1);
	    }
	    
	    .ColorButton:active {
	        transform: scale(0.95);
	    }
		input[type="range"] {
	        -webkit-appearance: none;
	        width: 100px;
	        height: 5px;
	        border-radius: 5px;
	        background: #d3d3d3;
	        outline: none;
	        opacity: 0.7;
	        -webkit-transition: .2s;
	        transition: opacity .2s;
	    }
	    input[type="range"]:hover {
	        opacity: 1;
	    }
	    input[type="range"]::-webkit-slider-thumb {
	        -webkit-appearance: none;
	        appearance: none;
	        width: 15px;
	        height: 15px;
	        border-radius: 50%;
	        background: #4CAF50;
	        cursor: pointer;
	    }
	    input[type="range"]::-moz-range-thumb {
	        width: 15px;
	        height: 15px;
	        border-radius: 50%;
	        background: #4CAF50;
	        cursor: pointer;
	    }
	    input[type="range"]:disabled {
	        opacity: 0.5;
	    }
	    input[type="checkbox"] {
	        width: 16px;
	        height: 16px;
	    }
    `;
    document.head.appendChild(StyleSheet);

    const AddLayerBtn = document.createElement('button');
    AddLayerBtn.textContent = '+';
    AddLayerBtn.style.cssText = `
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 4px;
        background: #ddd;
        cursor: pointer;
        margin-bottom: 10px;
    `;
    AddLayerBtn.onclick = AddLayer;
    LayerPanel.appendChild(AddLayerBtn);

    SetupCanvas();
    SetupEventListeners();
};

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

function UpdateCanvas() {
    const MainCtx = Canvas.getContext('2d');
    MainCtx.clearRect(0, 0, Canvas.width, Canvas.height);

    Layers.forEach(Layer => {
        if (Layer.visible) {
            MainCtx.drawImage(Layer.canvas, 0, 0);
        }
    });
}

function SetupCanvas() {
    Canvas = document.createElement('canvas');
    Canvas.width = 1024;
    Canvas.height = 768;
    Canvas.style.cssText = `
        background: white;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
    `;
    document.getElementById('CanvasContainer').appendChild(Canvas);

    AddLayer();
    SaveState();
    SetupEventListeners();
}

function StartDrawing(e) {
    IsDrawing = true;
    const Rect = Canvas.getBoundingClientRect();
    LastX = e.clientX - Rect.left;
    LastY = e.clientY - Rect.top;
    LastPressure = e.pressure || 0.5;
    SaveState();
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

    LastX = X;
    LastY = Y;
    UpdateCanvas();
}

function StopDrawing() {
    if (IsDrawing) {
        IsDrawing = false;
        SaveState();
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

    const DistinctColor = GenerateDistinctColor();

    Layers.push({
        canvas: NewCanvas,
        ctx: NewCtx,
        visible: true,
        color: DistinctColor
    });

    CurrentLayer = Layers.length - 1;
    UpdateLayerPanel();
}

function UpdateLayerPanel() {
    const LayerPanel = document.getElementById('LayerPanel');
    LayerPanel.innerHTML = '';

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
    LayerPanel.appendChild(AddBtn);

    Layers.forEach((Layer, Index) => {
        const LayerDiv = document.createElement('div');
        LayerDiv.className = 'Layer';
        LayerDiv.style.cssText = `
            width: 40px;
            height: 40px;
            margin: 5px;
            background: ${Layer.color};
            position: relative;
            cursor: pointer;
            border: 2px solid ${CurrentLayer === Index ? '#666' : '#999'};
        `;
        LayerDiv.onclick = () => {
            CurrentLayer = Index;
            Ctx = Layers[CurrentLayer].ctx;
            UpdateLayerPanel();
        };

        const VisibilityBtn = document.createElement('button');
        VisibilityBtn.textContent = Layer.visible ? '👁️' : '👁️‍🗨️';
        VisibilityBtn.style.cssText = `
            position: absolute;
            top: 2px;
            left: 2px;
            width: 15px;
            height: 15px;
            border: none;
            background: transparent;
            cursor: pointer;
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
            position: absolute;
            top: 2px;
            right: 2px;
            width: 15px;
            height: 15px;
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

        LayerDiv.appendChild(VisibilityBtn);
        LayerDiv.appendChild(DeleteBtn);
        LayerPanel.appendChild(LayerDiv);
    });
}

function RemoveLayer(Index) {
    if (Layers.length > 1) {
        Layers.splice(Index, 1);
        CurrentLayer = Math.min(CurrentLayer, Layers.length - 1);
    } else {
        Layers[0].ctx.clearRect(0, 0, Canvas.width, Canvas.height);
        Layers[0].color = GenerateDistinctColor();
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
