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
const MaxUndoSteps = 200;
let LastX, LastY;
let LastPressure;
let PressureSensitivity = 1;
let ResizingLayer = null;
let OriginalAspectRatio = 1;
let Tools = [];
let SelectedTool = null;
let BackgroundColor = null;
let SelectedColorButton = null;
let CanvasZoom = 1;
let CanvasOffsetX = 0;
let CanvasOffsetY = 0;
let LayerOffsets = [];
let LayerScales = [];
let ZoomStartY = 0;
let MoveStartX = 0;
let MoveStartY = 0;
let ScaleStartY = 0;
let ScaleStartScale = 1;

function LoadTools() {
	return fetch('/manifest.json')
		.then(Response => Response.json())
		.then(Manifest => {
			const ToolPromises = Manifest.tools.map(ToolInfo => 
				fetch(`/tools/${ToolInfo.file}`)
					.then(Response => Response.json())
			);
			
			return Promise.all(ToolPromises);
		})
		.then(ToolList => {
			Tools = ToolList;
			PopulateToolDropdown();
			
			const PencilTool = Tools.find(Tool => Tool.name === "Pencil");
			if (PencilTool) {
				SetTool("Pencil");
				
				const Selector = document.getElementById('ToolSelector');
				if (Selector) {
					Selector.value = "Pencil";
				}
			}
			
			return Tools;
		})
		.catch(Error => {
			console.error('Error loading tools:', Error);
			return [];
		});
}

function PopulateToolDropdown() {
	const Selector = document.getElementById('ToolSelector');
	if (!Selector) {
		console.error('ToolSelector element not found');
		return;
	}
	
	Selector.innerHTML = '';
	
	if (!Tools || Tools.length === 0) {
		console.error('No tools available to populate');
		return;
	}
	
	Tools.forEach(Tool => {
		const Option = document.createElement('option');
		Option.value = Tool.name;
		Option.textContent = Tool.icon ? `${Tool.icon} ${Tool.name}` : Tool.name;
		Option.title = Tool.description || '';
		Selector.appendChild(Option);
	});
	
	Selector.addEventListener('change', function(E) {
		SetTool(E.target.value);
	});
}

function SetTool(ToolName) {
	const FoundTool = Tools.find(Tool => Tool.name === ToolName);
	
	if (!FoundTool) {
		console.error(`Tool not found with name: ${ToolName}`);
		return;
	}
	
	SelectedTool = FoundTool;
}

window.onload = function () {
	document.querySelector('[data-action="save"]').addEventListener('click', SaveCanvas);
	document.querySelector('[data-action="export"]').addEventListener('click', ExportCanvas);
	document.querySelector('[data-action="load"]').addEventListener('click', LoadCanvas);
	document.querySelector('[data-action="import"]').addEventListener('click', ImportImage);
	document.querySelector('[data-action="reset-view"]').addEventListener('click', ResetView);
	
	const ColorButtons = document.querySelectorAll('.ColorButton');
	SelectedColorButton = ColorButtons[0];
	SelectedColorButton.style.borderColor = '#000';
	
	ColorButtons.forEach((ColorButton) => {
		ColorButton.addEventListener('click', function(E) {
			HandleColorButtonClick.call(this, E);
		});
	});
	
	const PressureSlider = document.getElementById('PressureSlider');
	const PressureValue = document.getElementById('PressureValue');

	PressureSlider.addEventListener('input', (E) => {
		PressureSensitivity = parseFloat(E.target.value);
		PressureValue.textContent = PressureSensitivity.toFixed(1);
	});

	const SizeSlider = document.getElementById('SizeSlider');
	const SizeValue = document.getElementById('SizeValue');

	SizeSlider.addEventListener('input', (E) => {
		CurrentSize = parseInt(E.target.value);
		SizeValue.textContent = CurrentSize;
	});
	
	document.getElementById('UndoButton').addEventListener('click', Undo);
	document.getElementById('RedoButton').addEventListener('click', Redo);
	
	const BackgroundSwatch = document.getElementById('BackgroundColorSwatch');
	const ClearBgButton = document.getElementById('ClearBackgroundColor');
	
	BackgroundSwatch.addEventListener('click', function() {
		const ExistingPicker = document.querySelector('.background-color-picker');
		if (!ExistingPicker) {
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
			
			ColorPicker.addEventListener('input', (E) => {
				const NewColor = E.target.value;
				BackgroundColor = NewColor;
				ApplyBackgroundColor();
			});
			
			ColorPicker.addEventListener('change', (E) => {
				ColorPicker.remove();
			});
			
			document.body.appendChild(ColorPicker);
			setTimeout(() => ColorPicker.click(), 50);
		}
	});
	
	ClearBgButton.addEventListener('click', function() {
		BackgroundColor = null;
		ApplyBackgroundColor();
	});
	
	function ApplyBackgroundColor() {
		if (BackgroundColor) {
			BackgroundSwatch.style.background = BackgroundColor;
			Canvas.style.background = BackgroundColor;
		} else {
			BackgroundSwatch.style.background = '';
			Canvas.style.background = 'white';
		}
	}
	
	document.addEventListener('click', (E) => {
		if (!E.target.closest('.ColorButton') && !E.target.classList.contains('color-picker-input') &&
			!E.target.closest('#BackgroundColorSwatch') && !E.target.classList.contains('background-color-picker')) {
			const ExistingPicker = document.querySelector('.color-picker-input');
			if (ExistingPicker) ExistingPicker.remove();
			
			const ExistingBgPicker = document.querySelector('.background-color-picker');
			if (ExistingBgPicker) ExistingBgPicker.remove();
		}
	});
	
	LoadTools().then(() => {
		SetupCanvas();
	});
	
	function HandleColorButtonClick(E) {
		if (SelectedColorButton === this) {
			const ExistingPicker = document.querySelector('.color-picker-input');
			if (!ExistingPicker) {
				const ColorPicker = document.createElement('input');
				ColorPicker.type = 'color';
				ColorPicker.value = this.dataset.currentColor;
				ColorPicker.className = 'color-picker-input';
				ColorPicker.style.cssText = `
					top: calc(100% + 5px);
					left: ${this.getBoundingClientRect().left}px;
				`;
				
				ColorPicker.addEventListener('input', (E) => {
					const NewColor = E.target.value;
					this.style.background = NewColor;
					this.dataset.currentColor = NewColor;
					CurrentColor = NewColor;
				});
				
				ColorPicker.addEventListener('change', (E) => {
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
			
			const ExistingPicker = document.querySelector('.color-picker-input');
			if (ExistingPicker) ExistingPicker.remove();
		}
	}
};

function GetToolbarHeight() {
    const Toolbar = document.getElementById('Toolbar');
    return Toolbar ? Toolbar.offsetHeight : 50;
}

function UpdateCanvasContainerHeight() {
    const ToolbarHeight = GetToolbarHeight();
    const LowerContainer = document.querySelector('.LowerContainer');
    if (LowerContainer) {
        LowerContainer.style.setProperty('--toolbar-height', `${ToolbarHeight}px`);
        LowerContainer.style.height = `calc(100vh - ${ToolbarHeight}px)`;
    }
}

function SetupCanvas() {
	Canvas = document.createElement('canvas');
	const Container = document.getElementById('CanvasContainer');

    UpdateCanvasContainerHeight();
	
	const ToolbarHeight = document.getElementById('Toolbar').offsetHeight;
	const AvailableWidth = Container.clientWidth;
	const AvailableHeight = window.innerHeight - ToolbarHeight;
	
	Canvas.width = AvailableWidth - 10;
	Canvas.height = AvailableHeight - 10;
	
	document.getElementById('CanvasContainer').appendChild(Canvas);
	AddLayer();
	SaveState();
	SetupEventListeners();
	
	window.addEventListener('resize', () => {
		UpdateCanvasContainerHeight();
	    const NewToolbarHeight = GetToolbarHeight();
		const NewWidth = Container.clientWidth - 10;
		const NewHeight = window.innerHeight - NewToolbarHeight - 10;
			
		const TempCanvas = document.createElement('canvas');
		TempCanvas.width = Canvas.width;
		TempCanvas.height = Canvas.height;
		const TempCtx = TempCanvas.getContext('2d');
		TempCtx.drawImage(Canvas, 0, 0);

		Canvas.width = NewWidth;
		Canvas.height = NewHeight;
		Layers.forEach(Layer => {
			const NewLayerCanvas = document.createElement('canvas');
			NewLayerCanvas.width = NewWidth;
			NewLayerCanvas.height = NewHeight;
			const NewCtx = NewLayerCanvas.getContext('2d');
			NewCtx.drawImage(Layer.canvas, 0, 0);
			Layer.canvas = NewLayerCanvas;
			Layer.ctx = NewCtx;
		});

		UpdateCanvas();
		UpdateCanvasTransform();
	});
}

function UpdateCanvas() {
	const MainCtx = Canvas.getContext('2d');
	MainCtx.clearRect(0, 0, Canvas.width, Canvas.height);

	Layers.forEach((Layer, Index) => {
		if (Layer.visible) {
			MainCtx.save();
			MainCtx.globalAlpha = Layer.opacity;
			
			const Offset = LayerOffsets[Index] || { x: 0, y: 0 };
			const Scale = LayerScales[Index] || 1;
			
			MainCtx.translate(Offset.x, Offset.y);
			MainCtx.scale(Scale, Scale);
			
			MainCtx.drawImage(Layer.canvas, 0, 0);
			MainCtx.restore();
		}
	});
}

function SetupEventListeners() {
	Canvas.addEventListener('pointerdown', StartDrawing);
	Canvas.addEventListener('pointermove', Draw);
	Canvas.addEventListener('pointerup', StopDrawing);
	Canvas.addEventListener('pointerout', StopDrawing);
	document.addEventListener('keydown', (E) => {
		if (E.ctrlKey && E.key === 'z') Undo();
		if (E.ctrlKey && E.key === 'y') Redo();
	});
	Canvas.addEventListener('contextmenu', function(E) {
        E.preventDefault();
        return false;
    });
}

function StartDrawing(E) {
	if (!SelectedTool) return;
	
	IsDrawing = true;
	
	if (SelectedTool.type === 'zoom') {
		ZoomStartY = E.clientY;
	} else if (SelectedTool.type === 'pan') {
		MoveStartX = E.clientX;
		MoveStartY = E.clientY;
	} else if (SelectedTool.type === 'move') {
		MoveStartX = E.clientX;
		MoveStartY = E.clientY;
	} else if (SelectedTool.type === 'scale') {
		ScaleStartY = E.clientY;
		ScaleStartScale = LayerScales[CurrentLayer] || 1;
	} else if (SelectedTool.type === 'picker') {
        PickColor(E);
    } else {
		const Coords = GetCanvasCoordinates(E.clientX, E.clientY);
		
		const Offset = LayerOffsets[CurrentLayer] || { x: 0, y: 0 };
		const Scale = LayerScales[CurrentLayer] || 1;
		LastX = (Coords.x - Offset.x) / Scale;
		LastY = (Coords.y - Offset.y) / Scale;
	}
	
	LastPressure = E.pressure || 0.5;
}

function Draw(E) {
	if (!IsDrawing || !SelectedTool) return;

	if (SelectedTool.type === 'zoom') {
		const DeltaY = ZoomStartY - E.clientY;
		const ZoomSensitivity = SelectedTool.properties.zoomSensitivity || 0.01;
		const MinZoom = SelectedTool.properties.minZoom || 0.1;
		const MaxZoom = SelectedTool.properties.maxZoom || 10;
		
		const Container = document.getElementById('CanvasContainer');
		const ContainerRect = Container.getBoundingClientRect();
		const CenterX = ContainerRect.width / 2;
		const CenterY = ContainerRect.height / 2;
		
		const OldZoom = CanvasZoom;
		const NewZoom = Math.max(MinZoom, Math.min(MaxZoom, CanvasZoom + DeltaY * ZoomSensitivity));
		
		const ZoomRatio = NewZoom / OldZoom;
		CanvasOffsetX = CenterX - (CenterX - CanvasOffsetX) * ZoomRatio;
		CanvasOffsetY = CenterY - (CenterY - CanvasOffsetY) * ZoomRatio;
		
		CanvasZoom = NewZoom;
		ZoomStartY = E.clientY;
		
		UpdateCanvasTransform();
		return;
	}
	
	if (SelectedTool.type === 'pan') {
		const DeltaX = E.clientX - MoveStartX;
		const DeltaY = E.clientY - MoveStartY;
		
		CanvasOffsetX += DeltaX;
		CanvasOffsetY += DeltaY;
		
		MoveStartX = E.clientX;
		MoveStartY = E.clientY;
		
		UpdateCan‌vasTransform();
		return;
	}
	
	if (SelectedTool.type === 'move') {
		const DeltaX = E.clientX - MoveStartX;
		const DeltaY = E.clientY - MoveStartY;
		
		if (!LayerOffsets[CurrentLayer]) {
			LayerOffsets[CurrentLayer] = { x: 0, y: 0 };
		}
		
		LayerOffsets[CurrentLayer].x += DeltaX / CanvasZoom;
		LayerOffsets[CurrentLayer].y += DeltaY / CanvasZoom;
		
		MoveStartX = E.clientX;
		MoveStartY = E.clientY;
		
		UpdateCanvas();
		return;
	}
	
	if (SelectedTool.type === 'scale') {
		const DeltaY = ScaleStartY - E.clientY;
		const ScaleSensitivity = SelectedTool.properties.scaleSensitivity || 0.005;
		const MinScale = SelectedTool.properties.minScale || 0.1;
		const MaxScale = SelectedTool.properties.maxScale || 5;
		
		const NewScale = Math.max(MinScale, Math.min(MaxScale, ScaleStartScale + DeltaY * ScaleSensitivity));
		LayerScales[CurrentLayer] = NewScale;
		
		UpdateCanvas();
		return;
	}
	
	const Coords = GetCanvasCoordinates(E.clientX, E.clientY);
	
	const Offset = LayerOffsets[CurrentLayer] || { x: 0, y: 0 };
	const Scale = LayerScales[CurrentLayer] || 1;
	const TransformedX = (Coords.x - Offset.x) / Scale;
	const TransformedY = (Coords.y - Offset.y) / Scale;
	
	const RawPressure = E.pressure !== undefined ? E.pressure : 0.5;
	const AdjustedPressure = PressureSensitivity > 0
		? Math.pow(RawPressure, 1 / PressureSensitivity)
		: 1;
	
	const CurrentCtx = Layers[CurrentLayer].ctx;

	CurrentCtx.beginPath();
	CurrentCtx.moveTo(LastX, LastY);
	CurrentCtx.lineTo(TransformedX, TransformedY);

	if (SelectedTool && SelectedTool.properties) {
		CurrentCtx.globalCompositeOperation = SelectedTool.properties.globalCompositeOperation || 'source-over';
		
		CurrentCtx.lineWidth = CurrentSize * AdjustedPressure;
		CurrentCtx.strokeStyle = CurrentColor;
		CurrentCtx.lineCap = 'round';
		CurrentCtx.lineJoin = 'round';
	}
	
	CurrentCtx.stroke();

	LastX = TransformedX;
	LastY = TransformedY;
	UpdateCanvas();
}

function StopDrawing() {
	if (IsDrawing) {
		IsDrawing = false;
		if (SelectedTool && SelectedTool.properties && SelectedTool.properties.globalCompositeOperation) {
			Layers[CurrentLayer].ctx.globalCompositeOperation = 'source-over';
		}
		
		if (SelectedTool && (SelectedTool.type === 'zoom' || SelectedTool.type === 'pan' || SelectedTool.type === 'picker')) {
			return;
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
	
	LayerOffsets.push({ x: 0, y: 0 });
	LayerScales.push(1);

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
		DrawCheckerboard(PreviewCtx, 40, 30, 5);
		
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
		VisibilityBtn.onclick = (E) => {
			E.stopPropagation();
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
		DeleteBtn.onclick = (E) => {
			E.stopPropagation();
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
		OpacitySlider.oninput = (E) => {
			Layer.opacity = parseFloat(E.target.value);
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
		UpArrow.onclick = (E) => {
			E.stopPropagation();
			if (Index > 0) {
				[Layers[Index], Layers[Index - 1]] = [Layers[Index - 1], Layers[Index]];
				[LayerOffsets[Index], LayerOffsets[Index - 1]] = [LayerOffsets[Index - 1], LayerOffsets[Index]];
				[LayerScales[Index], LayerScales[Index - 1]] = [LayerScales[Index - 1], LayerScales[Index]];
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
		DownArrow.onclick = (E) => {
			E.stopPropagation();
			if (Index < Layers.length - 1) {
				[Layers[Index], Layers[Index + 1]] = [Layers[Index + 1], Layers[Index]];
				[LayerOffsets[Index], LayerOffsets[Index + 1]] = [LayerOffsets[Index + 1], LayerOffsets[Index]];
				[LayerScales[Index], LayerScales[Index + 1]] = [LayerScales[Index + 1], LayerScales[Index]];
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

function DrawCheckerboard(Ctx, Width, Height, Size) {
	Ctx.fillStyle = '#f0f0f0';
	Ctx.fillRect(0, 0, Width, Height);
	Ctx.fillStyle = '#cccccc';
	
	for (let Y = 0; Y < Height; Y += Size) {
		for (let X = 0; X < Width; X += Size) {
			if ((X / Size + Y / Size) % 2 === 0) {
				Ctx.fillRect(X, Y, Size, Size);
			}
		}
	}
}

function RemoveLayer(Index) {
	if (Layers.length > 1) {
		Layers.splice(Index, 1);
		LayerOffsets.splice(Index, 1);
		LayerScales.splice(Index, 1);
		CurrentLayer = Math.min(CurrentLayer, Layers.length - 1);
	} else {
		Layers[0].ctx.clearRect(0, 0, Canvas.width, Canvas.height);
		LayerOffsets[0] = { x: 0, y: 0 };
		LayerScales[0] = 1;
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
			layers: Layers.map((Layer, Index) => ({
				data: Layer.canvas.toDataURL(),
				visible: Layer.visible,
				opacity: Layer.opacity,
				offset: LayerOffsets[Index] || { x: 0, y: 0 },
				scale: LayerScales[Index] || 1
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
	Input.onchange = (E) => {
		const File = E.target.files[0];
		const Reader = new FileReader();
		Reader.onload = (Event) => {
			const SaveData = JSON.parse(Event.target.result);
			
			Layers = [];
			LayerOffsets = [];
			LayerScales = [];
			
			Canvas.width = SaveData.canvasWidth;
			Canvas.height = SaveData.canvasHeight;
			
			ResetView();

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

			const LayerPromises = SaveData.layers.map((LayerData, Index) => {
				return new Promise((Resolve) => {
					const NewCanvas = document.createElement('canvas');
					NewCanvas.width = SaveData.canvasWidth;
					NewCanvas.height = SaveData.canvasHeight;
					const NewCtx = NewCanvas.getContext('2d');
					
					const Img = new Image();
					Img.onload = () => {
						NewCtx.drawImage(Img, 0, 0);
						Resolve({
							canvas: NewCanvas,
							ctx: NewCtx,
							visible: LayerData.visible,
							opacity: LayerData.opacity !== undefined ? LayerData.opacity : 1,
							offset: LayerData.offset || { x: 0, y: 0 },
							scale: LayerData.scale || 1
						});
					};
					Img.src = LayerData.data;
				});
			});

			Promise.all(LayerPromises).then(LoadedLayers => {
				Layers = LoadedLayers.map(L => ({
					canvas: L.canvas,
					ctx: L.ctx,
					visible: L.visible,
					opacity: L.opacity
				}));
				LayerOffsets = LoadedLayers.map(L => L.offset);
				LayerScales = LoadedLayers.map(L => L.scale);

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

		Layers.forEach((Layer, Index) => {
			if (Layer.visible) {
				ExportCtx.save();
				ExportCtx.globalAlpha = Layer.opacity;
				
				const Offset = LayerOffsets[Index] || { x: 0, y: 0 };
				const Scale = LayerScales[Index] || 1;
				
				ExportCtx.translate(Offset.x, Offset.y);
				ExportCtx.scale(Scale, Scale);
				
				ExportCtx.drawImage(Layer.canvas, 0, 0);
				ExportCtx.restore();
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
	
	const State = {
		layers: Layers.map((Layer, Index) => ({
			data: Layer.canvas.toDataURL(),
			visible: Layer.visible,
			opacity: Layer.opacity,
			offset: LayerOffsets[Index] || { x: 0, y: 0 },
			scale: LayerScales[Index] || 1
		}))
	};
	
	UndoStack.push(JSON.stringify(State));
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

function LoadStateFromJSON(StateJSON) {
	const State = JSON.parse(StateJSON);
	Layers = [];
	LayerOffsets = [];
	LayerScales = [];
	
	const LayerPromises = State.layers.map((LayerData) => {
		return new Promise((Resolve) => {
			const NewCanvas = document.createElement('canvas');
			NewCanvas.width = Canvas.width;
			NewCanvas.height = Canvas.height;
			const NewCtx = NewCanvas.getContext('2d');
			
			const Img = new Image();
			Img.onload = () => {
				NewCtx.drawImage(Img, 0, 0);
				Resolve({
					canvas: NewCanvas,
					ctx: NewCtx,
					visible: LayerData.visible,
					opacity: LayerData.opacity,
					offset: LayerData.offset || { x: 0, y: 0 },
					scale: LayerData.scale || 1
				});
			};
			Img.src = LayerData.data;
		});
	});
	
	Promise.all(LayerPromises).then(LoadedLayers => {
		Layers = LoadedLayers.map(L => ({
			canvas: L.canvas,
			ctx: L.ctx,
			visible: L.visible,
			opacity: L.opacity
		}));
		LayerOffsets = LoadedLayers.map(L => L.offset);
		LayerScales = LoadedLayers.map(L => L.scale);
		
		if (CurrentLayer >= Layers.length) {
            CurrentLayer = Math.max(0, Layers.length - 1);
        }
		Ctx = Layers[CurrentLayer].ctx;
		
		UpdateLayerPanel();
		UpdateCanvas();
	});
}

function ImportImage() {
	const Input = document.createElement('input');
	Input.type = 'file';
	Input.accept = 'image/*';
	Input.onchange = (E) => {
		const File = E.target.files[0];
		if (File) {
			const Reader = new FileReader();
			Reader.onload = (Event) => {
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
					
					LayerOffsets.push({ x: 0, y: 0 });
					LayerScales.push(1);

					CurrentLayer = Layers.length - 1;
					UpdateLayerPanel();
					UpdateCanvas();
					SaveState();
				};
				Img.src = Event.target.result;
			};
			Reader.readAsDataURL(File);
		}
	};
	Input.click();
}

function GetCanvasCoordinates(ClientX, ClientY) {
	const Rect = Canvas.getBoundingClientRect();
	const ScaleX = Canvas.width / Rect.width;
	const ScaleY = Canvas.height / Rect.height;
	return {
		x: (ClientX - Rect.left) * ScaleX,
		y: (ClientY - Rect.top) * ScaleY
	};
}

function UpdateCanvasTransform() {
	if (CanvasZoom === 1 && CanvasOffsetX === 0 && CanvasOffsetY === 0) {
		Canvas.style.transform = '';
		Canvas.style.transformOrigin = '';
	} else {
		Canvas.style.transformOrigin = '0 0';
		Canvas.style.transform = `translate(${CanvasOffsetX}px, ${CanvasOffsetY}px) scale(${CanvasZoom})`;
	}
}

function ResetView() {
	CanvasZoom = 1;
	CanvasOffsetX = 0;
	CanvasOffsetY = 0;
	UpdateCanvasTransform();
}

function PickColor(E) {
    const Coords = GetCanvasCoordinates(E.clientX, E.clientY);
    
    const CompositeCanvas = document.createElement('canvas');
    CompositeCanvas.width = Canvas.width;
    CompositeCanvas.height = Canvas.height;
    const CompositeCtx = CompositeCanvas.getContext('2d');
    
    if (BackgroundColor) {
        CompositeCtx.fillStyle = BackgroundColor;
        CompositeCtx.fillRect(0, 0, CompositeCanvas.width, CompositeCanvas.height);
    }
    
    Layers.forEach((Layer, Index) => {
        if (Layer.visible) {
            CompositeCtx.save();
            CompositeCtx.globalAlpha = Layer.opacity;
            
            const Offset = LayerOffsets[Index] || { x: 0, y: 0 };
            const Scale = LayerScales[Index] || 1;
            
            CompositeCtx.translate(Offset.x, Offset.y);
            CompositeCtx.scale(Scale, Scale);
            
            CompositeCtx.drawImage(Layer.canvas, 0, 0);
            CompositeCtx.restore();
        }
    });
    
    const PixelData = CompositeCtx.getImageData(Math.floor(Coords.x), Math.floor(Coords.y), 1, 1).data;
    
    const R = PixelData[0];
    const G = PixelData[1];
    const B = PixelData[2];
    const A = PixelData[3];
    
    let HexColor;
    if (A === 0 && !BackgroundColor) {
        HexColor = '#ffffff';
    } else {
        HexColor = '#' + 
            R.toString(16).padStart(2, '0') + 
            G.toString(16).padStart(2, '0') + 
            B.toString(16).padStart(2, '0');
    }
    
    if (SelectedColorButton) {
        SelectedColorButton.style.background = HexColor;
        SelectedColorButton.dataset.currentColor = HexColor;
        CurrentColor = HexColor;
    }
}