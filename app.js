if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js')
			.then(Registration => {}).catch(Error => {
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
const MaxUndoSteps = 100;
let LastX, LastY;
let PressureSensitivity = 1;
let resizingLayer = null;
let originalAspectRatio = 1;
let Brushes = [];
let CurrentBrush = null;
let BackgroundColor = null; // null means transparent/alpha

function loadBrushes() {
	return fetch('/manifest.json')
		.then(response => response.json())
		.then(manifest => {
			const brushPromises = manifest.brushes.map(brushInfo => 
				fetch(`/brushes/${brushInfo.file}`)
					.then(response => response.json())
			);
			
			return Promise.all(brushPromises);
		})
		.then(brushes => {
			Brushes = brushes;
			populateBrushDropdown();
			
			const pencilBrush = Brushes.find(brush => brush.name === "Pencil");
			if (pencilBrush) {
				setBrush("Pencil");
				
				const selector = document.getElementById('BrushSelector');
				if (selector) {
					selector.value = "Pencil";
				}
			}
			
			return brushes;
		})
		.catch(error => {
			console.error('Error loading brushes:', error);
		});
}

function populateBrushDropdown() {
	const selector = document.getElementById('BrushSelector');
	if (!selector) return;
	
	selector.innerHTML = '';
	
	Brushes.forEach(brush => {
		const option = document.createElement('option');
		option.value = brush.name;
		option.textContent = brush.icon ? `${brush.icon} ${brush.name}` : brush.name;
		option.title = brush.description || '';
		selector.appendChild(option);
	});
	
	selector.addEventListener('change', function(e) {
		setBrush(e.target.value);
	});
}

function setBrush(brushName) {
	const foundBrush = Brushes.find(brush => brush.name === brushName);
	
	if (!foundBrush) {
		console.error(`Brush not found with name: ${brushName}`);
		return;
	}
	
	CurrentBrush = foundBrush;
	
	if (CurrentBrush.properties) {
		CurrentTool = CurrentBrush.name.toLowerCase();
		CurrentSize = CurrentBrush.properties.lineWidth || 2;
	}
}

window.onload = function () {
	document.querySelector('[data-action="save"]').addEventListener('click', SaveCanvas);
	document.querySelector('[data-action="export"]').addEventListener('click', ExportCanvas);
	document.querySelector('[data-action="load"]').addEventListener('click', LoadCanvas);
	document.querySelector('[data-action="import"]').addEventListener('click', ImportImage);
	
	const colorButtons = document.querySelectorAll('.ColorButton');
	let SelectedColorButton = colorButtons[0];
	SelectedColorButton.style.borderColor = '#000';
	
	colorButtons.forEach((ColorButton) => {
		ColorButton.addEventListener('click', function(e) {
			handleColorButtonClick.call(this, e);
		});
	});
	
	const pressureSlider = document.getElementById('PressureSlider');
	const pressureValue = document.getElementById('PressureValue');
	
	pressureSlider.addEventListener('input', (e) => {
		PressureSensitivity = parseFloat(e.target.value);
		pressureValue.textContent = PressureSensitivity.toFixed(1);
	});
	
	document.getElementById('UndoButton').addEventListener('click', Undo);
	document.getElementById('RedoButton').addEventListener('click', Redo);
	
	const backgroundSwatch = document.getElementById('BackgroundColorSwatch');
	const clearBgButton = document.getElementById('ClearBackgroundColor');
	
	backgroundSwatch.addEventListener('click', function() {
		const existingPicker = document.querySelector('.background-color-picker');
		if (!existingPicker) {
			const ColorPicker = document.createElement('input');
			ColorPicker.type = 'color';
			ColorPicker.value = BackgroundColor || '#ffffff';
			ColorPicker.className = 'background-color-picker';
			ColorPicker.style.cssText = `
				position: absolute;
				opacity: 1;
				z-index: 1001;
				top: ${this.getBoundingClientRect().top + 30}px;
				left: ${this.getBoundingClientRect().left}px;
			`;
			
			ColorPicker.addEventListener('input', (e) => {
				const newColor = e.target.value;
				BackgroundColor = newColor;
				applyBackgroundColor();
			});
			
			ColorPicker.addEventListener('change', (e) => {
				ColorPicker.remove();
			});
			
			document.body.appendChild(ColorPicker);
			setTimeout(() => ColorPicker.click(), 50);
		}
	});
	
	clearBgButton.addEventListener('click', function() {
		BackgroundColor = null;
		applyBackgroundColor();
	});
	
	function applyBackgroundColor() {
		if (BackgroundColor) {
			backgroundSwatch.style.background = BackgroundColor;
			Canvas.style.background = BackgroundColor;
		} else {
			backgroundSwatch.style.background = '';
			Canvas.style.background = 'white';
		}
	}
	
	document.addEventListener('click', (e) => {
		if (!e.target.closest('.ColorButton') && !e.target.classList.contains('color-picker-input') &&
			!e.target.closest('#BackgroundColorSwatch') && !e.target.classList.contains('background-color-picker')) {
			const existingPicker = document.querySelector('.color-picker-input');
			if (existingPicker) existingPicker.remove();
			
			const existingBgPicker = document.querySelector('.background-color-picker');
			if (existingBgPicker) existingBgPicker.remove();
		}
	});
	
	loadBrushes().then(() => {
		SetupCanvas();
	});
	
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

function getToolbarHeight() {
    const toolbar = document.getElementById('Toolbar');
    return toolbar ? toolbar.offsetHeight : 50;
}

function updateCanvasContainerHeight() {
    const toolbarHeight = getToolbarHeight();
    const lowerContainer = document.querySelector('.LowerContainer');
    if (lowerContainer) {
        lowerContainer.style.setProperty('--toolbar-height', `${toolbarHeight}px`);
        lowerContainer.style.height = `calc(100vh - ${toolbarHeight}px)`;
    }
}

function SetupCanvas() {
	Canvas = document.createElement('canvas');
	const container = document.getElementById('CanvasContainer');

        updateCanvasContainerHeight();
	
	const toolbarHeight = document.getElementById('Toolbar').offsetHeight;
	const availableWidth = container.clientWidth;
	const availableHeight = window.innerHeight - toolbarHeight;
	
	Canvas.width = availableWidth - 10;
	Canvas.height = availableHeight - 10;
	
	document.getElementById('CanvasContainer').appendChild(Canvas);
	AddLayer();
	SaveState();
	SetupEventListeners();
	
	window.addEventListener('resize', () => {
		updateCanvasContainerHeight();
	        const newToolbarHeight = getToolbarHeight();
		const newWidth = container.clientWidth - 10;
		const newHeight = window.innerHeight - newToolbarHeight - 10;
			
		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = Canvas.width;
		tempCanvas.height = Canvas.height;
		const tempCtx = tempCanvas.getContext('2d');
		tempCtx.drawImage(Canvas, 0, 0);

		Canvas.width = newWidth;
		Canvas.height = newHeight;
		Layers.forEach(layer => {
			const newLayerCanvas = document.createElement('canvas');
			newLayerCanvas.width = newWidth;
			newLayerCanvas.height = newHeight;
			const newCtx = newLayerCanvas.getContext('2d');
			newCtx.drawImage(layer.canvas, 0, 0);
			layer.canvas = newLayerCanvas;
			layer.ctx = newCtx;
		});

		UpdateCanvas();
	});
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
	Canvas.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                return false;
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
	if (!IsDrawing || !CurrentBrush) return;

	const Rect = Canvas.getBoundingClientRect();
	const X = e.clientX - Rect.left;
	const Y = e.clientY - Rect.top;
	const RawPressure = e.pressure !== undefined ? e.pressure : 0.5;
	
	const AdjustedPressure = PressureSensitivity > 0
		? Math.pow(RawPressure, 1 / PressureSensitivity)
		: 1;
	
	const CurrentCtx = Layers[CurrentLayer].ctx;

	CurrentCtx.beginPath();
	CurrentCtx.moveTo(LastX, LastY);
	CurrentCtx.lineTo(X, Y);

	if (CurrentBrush && CurrentBrush.properties) {
		CurrentCtx.globalCompositeOperation = 
			CurrentBrush.properties.globalCompositeOperation || 'source-over';
		
		const baseWidth = CurrentBrush.properties.lineWidth;
		const factor = CurrentBrush.properties.lineWidthFactor || 1;
		CurrentCtx.lineWidth = baseWidth * factor * AdjustedPressure;
		CurrentCtx.strokeStyle = CurrentColor;
		CurrentCtx.lineCap = CurrentBrush.properties.lineCap || 'round';
		CurrentCtx.lineJoin = CurrentBrush.properties.lineJoin || 'round';
	}
	
	CurrentCtx.stroke();

	LastX = X;
	LastY = Y;
	UpdateCanvas();
}

function StopDrawing() {
	if (IsDrawing) {
		IsDrawing = false;
		if (CurrentBrush && CurrentBrush.properties.globalCompositeOperation) {
			Layers[CurrentLayer].ctx.globalCompositeOperation = 'source-over';
		}
		SaveState();
		UpdateLayerPanel();
	}
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
	SaveState();
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
			SaveState();
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

		const ArrowsContainer = document.createElement('div');
		ArrowsContainer.style.cssText = `
			display: flex;
			flex-direction: column;
			font-size: 10px;
			line-height: 1;
		`;

		const UpArrow = document.createElement('button');
		UpArrow.innerHTML = '&#9650;';
		UpArrow.style.cssText = `
			width: 12px;
			height: 12px;
			border: none;
			background: transparent;
			cursor: pointer;
			padding: 0;
			color: ${Index === 0 ? '#999' : '#333'};
			-webkit-appearance: none;
			display: flex;
			align-items: center;
			justify-content: center;
		`;
		UpArrow.onclick = (e) => {
			e.stopPropagation();
			if (Index > 0) {
				[Layers[Index], Layers[Index - 1]] = [Layers[Index - 1], Layers[Index]];
				if (CurrentLayer === Index) CurrentLayer--;
				else if (CurrentLayer === Index - 1) CurrentLayer++;
				UpdateCanvas();
				UpdateLayerPanel();
				SaveState();
			}
		};

		const DownArrow = document.createElement('button');
		DownArrow.innerHTML = '&#9660;';
		DownArrow.style.cssText = UpArrow.style.cssText;
		DownArrow.style.color = Index === Layers.length - 1 ? '#999' : '#333';
		DownArrow.onclick = (e) => {
			e.stopPropagation();
			if (Index < Layers.length - 1) {
				[Layers[Index], Layers[Index + 1]] = [Layers[Index + 1], Layers[Index]];
				if (CurrentLayer === Index) CurrentLayer++;
				else if (CurrentLayer === Index + 1) CurrentLayer--;
				UpdateCanvas();
				UpdateLayerPanel();
				SaveState();
			}
		};

		UpArrow.disabled = Index === 0;
		DownArrow.disabled = Index === Layers.length - 1;

		ArrowsContainer.appendChild(UpArrow);
		ArrowsContainer.appendChild(DownArrow);

		ControlsContainer.style.cssText = `
			display: grid;
			grid-template-columns: auto auto auto auto;
			gap: 2px;
			align-items: center;
			margin-top: 4px;
		`;

		ControlsContainer.appendChild(ArrowsContainer);
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
				opacity: layer.opacity
			})),
			canvasWidth: Canvas.width,
			canvasHeight: Canvas.height,
			currentLayer: CurrentLayer,
			backgroundColor: BackgroundColor
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

			if (SaveData.backgroundColor) {
				BackgroundColor = SaveData.backgroundColor;
				if (document.getElementById('BackgroundColorSwatch')) {
					document.getElementById('BackgroundColorSwatch').style.background = BackgroundColor;
				}
				Canvas.style.background = BackgroundColor;
			} else {
				BackgroundColor = null;
				if (document.getElementById('BackgroundColorSwatch')) {
					document.getElementById('BackgroundColorSwatch').style.background = '';
				}
				Canvas.style.background = 'white';
			}

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
							opacity: layerData.opacity !== undefined ? layerData.opacity : 1
						});
					};
					Img.src = layerData.data;
				});
			});

			Promise.all(LayerPromises).then(loadedLayers => {
				Layers = loadedLayers;

				UndoStack = [];
				RedoStack = [];

				Ctx = Layers[0].ctx;

				UpdateLayerPanel();
				UpdateCanvas();
				SaveState();
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

		if (BackgroundColor) {
			ExportCtx.fillStyle = BackgroundColor;
			ExportCtx.fillRect(0, 0, Canvas.width, Canvas.height);
		}

		Layers.forEach(Layer => {
			if (Layer.visible) {
				ExportCtx.globalAlpha = Layer.opacity;
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
	
	const state = {
		layers: Layers.map(layer => ({
			data: layer.canvas.toDataURL(),
			visible: layer.visible,
            		opacity: layer.opacity
        	})),
		currentLayer: CurrentLayer,
		backgroundColor: BackgroundColor
	};
	
	UndoStack.push(JSON.stringify(state));
	if (UndoStack.length > MaxUndoSteps) {
		UndoStack.shift();
	}
}

function Undo() {
	if (UndoStack.length > 1) {
		RedoStack.push(UndoStack.pop());
		const PreviousState = UndoStack[UndoStack.length - 1];
		
		LoadStateFromJSON(PreviousState);
	}
}

function Redo() {
	if (RedoStack.length > 0) {
		const NextState = RedoStack.pop();
		UndoStack.push(NextState);
		
		LoadStateFromJSON(NextState);
	}
}

function LoadStateFromJSON(stateJSON) {
	const state = JSON.parse(stateJSON);
	Layers = [];
	
	BackgroundColor = state.backgroundColor || null;
	if (BackgroundColor) {
		if (document.getElementById('BackgroundColorSwatch')) {
			document.getElementById('BackgroundColorSwatch').style.background = BackgroundColor;
		}
		Canvas.style.background = BackgroundColor;
	} else {
		if (document.getElementById('BackgroundColorSwatch')) {
			document.getElementById('BackgroundColorSwatch').style.background = '';
		}
		Canvas.style.background = 'white';
	}
	
	const layerPromises = state.layers.map((layerData) => {
		return new Promise((resolve) => {
			const NewCanvas = document.createElement('canvas');
			NewCanvas.width = Canvas.width;
			NewCanvas.height = Canvas.height;
			const NewCtx = NewCanvas.getContext('2d');
			
			const Img = new Image();
			Img.onload = () => {
				NewCtx.drawImage(Img, 0, 0);
				resolve({
					canvas: NewCanvas,
					ctx: NewCtx,
					visible: layerData.visible,
					opacity: layerData.opacity
				});
			};
			Img.src = layerData.data;
		});
	});
	
	Promise.all(layerPromises).then(loadedLayers => {
		Layers = loadedLayers;
		CurrentLayer = state.currentLayer || 0;
		Ctx = Layers[CurrentLayer].ctx;
		
		UpdateLayerPanel();
		UpdateCanvas();
	});
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
