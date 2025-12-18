// ----------------------------------------------------------------------------
// ExtractPanel.js - Extract mode UI panel for pInset
// ----------------------------------------------------------------------------
//
// Contains all controls for the Extract mode:
// - Target image selection
// - Shape selection (Rectangular/Circular)
// - Zoom factor control
// - Interpolation method selection
// - Preview and Extract buttons
//
// Author: Giovanni Rocca (iGio90) and Antigravity
//
// ----------------------------------------------------------------------------

/**
 * Create the complete Extract mode UI section.
 * @param {Dialog} dialog - Parent dialog
 * @param {Object} params - Parameters object
 * @param {Number} labelWidth - Width for label alignment
 * @param {Control} parent - Parent control for widgets
 * @returns {Object} Object containing all extract mode controls and sizers
 */
function createExtractControls(dialog, params, labelWidth, parent) {
   var result = {};
   
   // -------------------------------------------------------------------------
   // Source Image Selection
   // -------------------------------------------------------------------------
   
   result.imageLabel = new Label(parent);
   result.imageLabel.text = "Target Image:";
   result.imageLabel.textAlignment = TextAlign_Left;
   dialog.imageLabel = result.imageLabel;
   
   result.imageList = new ViewList(parent);
   result.imageList.getMainViews();
   result.imageList.onViewSelected = function(view) {
      dialog.targetView = view;
      dialog.updateImageDimensions();
      dialog.updatePreviewBitmap();
   };
   dialog.imageList = result.imageList;
   
   // -------------------------------------------------------------------------
   // Inset Properties Group
   // -------------------------------------------------------------------------
   
   result.group = new GroupBox(parent);
   result.group.title = "Inset Properties";
   
   // Shape
   var shapeLabel = new Label(result.group);
   shapeLabel.text = "Shape:";
   shapeLabel.setFixedWidth(labelWidth);
   shapeLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   dialog.shapeCombo = new ComboBox(result.group);
   dialog.shapeCombo.addItem("Rectangular");
   dialog.shapeCombo.addItem("Circular");
   dialog.shapeCombo.currentItem = 0;
   dialog.shapeCombo.onItemSelected = function(index) {
      params.insetShape = index === 1 ? "Circular" : "Rectangular";
      if (dialog.previewControl) {
         dialog.previewControl.repaint();
      }
   };
   
   var shapeSizer = new HorizontalSizer;
   shapeSizer.spacing = 6;
   shapeSizer.add(shapeLabel);
   shapeSizer.add(dialog.shapeCombo, 100);
   
   // Zoom Factor
   var zoomLabel = new Label(result.group);
   zoomLabel.text = "Zoom:";
   zoomLabel.setFixedWidth(labelWidth);
   zoomLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   dialog.zoomControl = new NumericControl(result.group);
   dialog.zoomControl.setRange(1.5, 10);
   dialog.zoomControl.slider.setRange(0, 170);
   dialog.zoomControl.setPrecision(1);
   dialog.zoomControl.setValue(params.zoomFactor);
   dialog.zoomControl.onValueUpdated = function(value) {
      params.zoomFactor = value;
   };
   
   var zoomSizer = new HorizontalSizer;
   zoomSizer.spacing = 6;
   zoomSizer.add(zoomLabel);
   zoomSizer.add(dialog.zoomControl, 100);
   
   // Interpolation Method
   var interpLabel = new Label(result.group);
   interpLabel.text = "Scale:";
   interpLabel.setFixedWidth(labelWidth);
   interpLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   dialog.interpCombo = new ComboBox(result.group);
   dialog.interpCombo.addItem("Nearest Neighbor");
   dialog.interpCombo.addItem("Bilinear");
   dialog.interpCombo.addItem("Bicubic");
   dialog.interpCombo.addItem("Lanczos-3");
   dialog.interpCombo.currentItem = 2; // Default to Bicubic
   dialog.interpCombo.onItemSelected = function(index) {
      var methods = ["nearest", "bilinear", "bicubic", "lanczos"];
      params.interpolationMethod = methods[index];
   };
   params.interpolationMethod = "bicubic";
   
   var interpSizer = new HorizontalSizer;
   interpSizer.spacing = 6;
   interpSizer.add(interpLabel);
   interpSizer.add(dialog.interpCombo, 100);
   
   // Group sizer
   var groupSizer = new VerticalSizer;
   groupSizer.margin = 6;
   groupSizer.spacing = 6;
   groupSizer.add(shapeSizer);
   groupSizer.add(zoomSizer);
   groupSizer.add(interpSizer);
   
   result.group.sizer = groupSizer;
   dialog.extractGroup = result.group;
   
   // -------------------------------------------------------------------------
   // Buttons
   // -------------------------------------------------------------------------
   
   result.previewButton = new PushButton(parent);
   result.previewButton.text = "Preview";
   result.previewButton.icon = dialog.scaledResource(":/icons/find.png");
   result.previewButton.onClick = function() {
      dialog.togglePreviewMode();
   };
   dialog.previewButton = result.previewButton;
   
   result.extractButton = new PushButton(parent);
   result.extractButton.text = "Extract";
   result.extractButton.icon = dialog.scaledResource(":/icons/ok.png");
   result.extractButton.onClick = function() {
      dialog.collectParams();
      
      if (dialog.getMode() === "Extract") {
         if (!dialog.hasDrawnRegion) {
            var msgBox = new MessageBox(
               "Please draw a region on the preview first.",
               "pInset",
               StdIcon_Warning,
               StdButton_Ok
            );
            msgBox.execute();
            return;
         }
         
         dialog.extractRegionToNewImage();
      }
      
      dialog.ok();
   };
   dialog.extractButton = result.extractButton;
   
   result.buttonsSizer = new HorizontalSizer;
   result.buttonsSizer.spacing = 8;
   result.buttonsSizer.addStretch();
   result.buttonsSizer.add(result.previewButton);
   result.buttonsSizer.add(result.extractButton);
   dialog.extractButtonsSizer = result.buttonsSizer;
   
   return result;
}

// =============================================================================
// EXTRACT MODE FUNCTIONS
// =============================================================================

/**
 * Toggle between normal view and zoomed preview mode.
 * @param {Dialog} dialog - The parent dialog
 */
function toggleExtractPreviewMode(dialog) {
   if (!dialog.hasDrawnRegion) {
      var msgBox = new MessageBox(
         "Please draw a region first.",
         "pInset",
         StdIcon_Warning,
         StdButton_Ok
      );
      msgBox.execute();
      return;
   }
   
   if (dialog.isPreviewMode) {
      // Switch back to normal mode
      dialog.isPreviewMode = false;
      dialog.zoomedPreviewBitmap = null;
      dialog.previewButton.text = "Preview";
      dialog.previewButton.icon = dialog.scaledResource(":/icons/find.png");
   } else {
      // Switch to preview mode - create zoomed bitmap
      dialog.collectParams();
      createZoomedPreviewBitmap(dialog);
      dialog.isPreviewMode = true;
      dialog.previewButton.text = "Back";
      dialog.previewButton.icon = dialog.scaledResource(":/icons/undo.png");
   }
   
   dialog.previewControl.repaint();
}

/**
 * Create a zoomed preview bitmap from the selected region.
 * @param {Dialog} dialog - The parent dialog
 */
function createZoomedPreviewBitmap(dialog) {
   if (!dialog.targetView || dialog.targetView.isNull) return;
   if (!dialog.hasDrawnRegion) return;
   
   var image = dialog.targetView.image;
   var params = dialog.params;
   
   // Source region
   var srcX = params.regionX;
   var srcY = params.regionY;
   var srcW = params.regionWidth;
   var srcH = params.regionHeight;
   
   // Calculate scaled dimensions 
   var scaledW = Math.round(srcW * params.zoomFactor);
   var scaledH = Math.round(srcH * params.zoomFactor);
   
   // Limit to fit preview control
   var maxW = dialog.previewControl.width - 20;
   var maxH = dialog.previewControl.height - 20;
   var displayScale = Math.min(1, maxW / scaledW, maxH / scaledH);
   var displayW = Math.round(scaledW * displayScale);
   var displayH = Math.round(scaledH * displayScale);
   
   // Extract and scale region
   var srcRect = new Rect(srcX, srcY, srcX + srcW, srcY + srcH);
   
   // Create buffer for the display-sized image
   var numChannels = image.numberOfChannels;
   var displayBuffer = [];
   
   for (var c = 0; c < numChannels; c++) {
      var srcBuffer = new Float32Array(srcW * srcH);
      image.getSamples(srcBuffer, srcRect, c);
      
      var dstBuffer = new Float32Array(displayW * displayH);
      ScalingUtils.scaleBuffer(srcBuffer, srcW, srcH, dstBuffer, displayW, displayH, params.interpolationMethod || "bicubic");
      displayBuffer.push(dstBuffer);
   }
   
   // Create bitmap from buffer
   dialog.zoomedPreviewBitmap = new Bitmap(displayW, displayH);
   
   // For circular shape, calculate circle parameters
   var isCircular = params.insetShape === "Circular";
   var cx = displayW / 2;
   var cy = displayH / 2;
   var radius = Math.min(displayW, displayH) / 2;
   
   for (var y = 0; y < displayH; y++) {
      for (var x = 0; x < displayW; x++) {
         var idx = y * displayW + x;
         var r, g, b, a;
         
         // Check if pixel is inside the circle (for circular shape)
         if (isCircular) {
            var dx = x - cx;
            var dy = y - cy;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > radius) {
               // Outside circle - make transparent
               dialog.zoomedPreviewBitmap.setPixel(x, y, 0x00000000);
               continue;
            }
         }
         
         if (numChannels >= 3) {
            r = Math.round(displayBuffer[0][idx] * 255);
            g = Math.round(displayBuffer[1][idx] * 255);
            b = Math.round(displayBuffer[2][idx] * 255);
         } else {
            var v = Math.round(displayBuffer[0][idx] * 255);
            r = g = b = v;
         }
         
         r = Math.max(0, Math.min(255, r));
         g = Math.max(0, Math.min(255, g));
         b = Math.max(0, Math.min(255, b));
         
         dialog.zoomedPreviewBitmap.setPixel(x, y, (0xFF << 24) | (r << 16) | (g << 8) | b);
      }
   }
   
   console.writeln("pInset: Created zoomed preview " + displayW + "x" + displayH + (isCircular ? " (circular)" : ""));
}

/**
 * Update zoom control's max value based on region size.
 * Limits final image to 8000px max dimension.
 * @param {Dialog} dialog - The parent dialog
 */
function updateZoomLimit(dialog) {
   if (!dialog.zoomControl) return;
   if (!dialog.hasDrawnRegion) return;
   
   // Max final dimension (8000px is a reasonable limit)
   var maxFinalDimension = 8000;
   
   // Get current region's largest dimension
   var largestDim = Math.max(dialog.params.regionWidth, dialog.params.regionHeight);
   
   if (largestDim <= 0) return;
   
   // Calculate max zoom to keep final size under limit
   var maxZoom = maxFinalDimension / largestDim;
   
   // Clamp to reasonable range (1.5 to 10)
   maxZoom = Math.max(1.5, Math.min(10, maxZoom));
   
   // Clamp current zoom value to new range BEFORE updating the control
   var clampedZoom = Math.max(1.5, Math.min(maxZoom, dialog.params.zoomFactor));
   dialog.params.zoomFactor = clampedZoom;
   
   // Update zoom control range and value
   dialog.zoomControl.setRange(1.5, maxZoom);
   dialog.zoomControl.setValue(clampedZoom);
   
   console.writeln("pInset: Region " + dialog.params.regionWidth + "x" + dialog.params.regionHeight + 
      " - Max zoom: " + maxZoom.toFixed(1) + "x (final: " + Math.round(largestDim * clampedZoom) + "px)");
}

/**
 * Extract the selected region to a new image window.
 * @param {Dialog} dialog - The parent dialog
 */
function extractRegionToNewImage(dialog) {
   if (!dialog.targetView || dialog.targetView.isNull) {
      console.writeln("pInset: No target view for extraction");
      return;
   }
   
   var image = dialog.targetView.image;
   var params = dialog.params;
   
   // Source region
   var srcX = params.regionX;
   var srcY = params.regionY;
   var srcW = params.regionWidth;
   var srcH = params.regionHeight;
   
   console.writeln("pInset: Extracting region " + srcX + "," + srcY + " size " + srcW + "x" + srcH);
   
   // Calculate scaled dimensions
   var scaledW = Math.round(srcW * params.zoomFactor);
   var scaledH = Math.round(srcH * params.zoomFactor);
   
   var isCircular = params.insetShape === "Circular";
   
   // For circular shapes, force square dimensions using the larger dimension
   if (isCircular) {
      var size = Math.max(scaledW, scaledH);
      scaledW = size;
      scaledH = size;
   }
   
   console.writeln("pInset: Scaled to " + scaledW + "x" + scaledH + " (zoom: " + params.zoomFactor + ")" + (isCircular ? " [circular, forced square]" : ""));
   
   // For circular shape, we NO LONGER create an alpha channel (user request)
   // We will just burn the circle into a black background
   var numChannels = image.numberOfChannels;
   var totalChannels = numChannels;
   
   // Create new image window (add alpha channel for circular)
   var newWindow = new ImageWindow(
      scaledW,
      scaledH,
      totalChannels,
      image.bitsPerSample,
      image.isReal,
      image.isColor,
      "pInset_Extract"
   );
   
   var newView = newWindow.mainView;
   var newImage = newView.image;
   
   // Extract and scale each channel
   var srcRect = new Rect(srcX, srcY, srcX + srcW, srcY + srcH);
   
   // Begin process to make the image writable
   newView.beginProcess();
   
   for (var c = 0; c < numChannels; c++) {
      // Extract source region
      var srcBuffer = new Float32Array(srcW * srcH);
      image.getSamples(srcBuffer, srcRect, c);
      
      // Scale using selected interpolation method
      var dstBuffer = new Float32Array(scaledW * scaledH);
      ScalingUtils.scaleBuffer(srcBuffer, srcW, srcH, dstBuffer, scaledW, scaledH, params.interpolationMethod);
      
      // Write to new image
      newImage.setSamples(dstBuffer, new Rect(0, 0, scaledW, scaledH), c);
   }
   
   // For circular shape, create and apply alpha channel
   if (isCircular) {
      var alphaBuffer = new Float32Array(scaledW * scaledH);
      var cx = scaledW / 2;
      var cy = scaledH / 2;
      var radius = Math.min(scaledW, scaledH) / 2;
      
      // 1. Generate Mask
      for (var y = 0; y < scaledH; y++) {
         for (var x = 0; x < scaledW; x++) {
            var dx = x - cx;
            var dy = y - cy;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            // Use smooth edge with 1-pixel antialiasing
            if (dist <= radius - 1) {
               alphaBuffer[y * scaledW + x] = 1.0; 
            } else if (dist <= radius) {
               alphaBuffer[y * scaledW + x] = radius - dist; 
            } else {
               alphaBuffer[y * scaledW + x] = 0.0; 
            }
         }
      }
      
      // 2. Apply Mask to RGB channels (PRE-MULTIPLY to ensure black background)
      // This fixes the issue where processes that ignore alpha reveal the square image
      for (var c = 0; c < numChannels; c++) {
         var channelBuffer = new Float32Array(scaledW * scaledH);
         newImage.getSamples(channelBuffer, new Rect(0, 0, scaledW, scaledH), c);
         
         for (var i = 0; i < channelBuffer.length; i++) {
            channelBuffer[i] *= alphaBuffer[i];
         }
         
         newImage.setSamples(channelBuffer, new Rect(0, 0, scaledW, scaledH), c);
      }
      
      // 3. Write Alpha Channel - DISABLED
      // newImage.setSamples(alphaBuffer, new Rect(0, 0, scaledW, scaledH), numChannels);
      console.writeln("pInset: Applied circular mask to RGB (black background)");
   }
   
   newView.endProcess();
   
   // Store extraction metadata as FITS keywords for Finalize mode
   var keywords = newWindow.keywords;
   keywords.push(new FITSKeyword("pInset_RegionX", srcX.toString(), "pInset: Source region X"));
   keywords.push(new FITSKeyword("pInset_RegionY", srcY.toString(), "pInset: Source region Y"));
   keywords.push(new FITSKeyword("pInset_RegionW", srcW.toString(), "pInset: Source region width"));
   keywords.push(new FITSKeyword("pInset_RegionH", srcH.toString(), "pInset: Source region height"));
   keywords.push(new FITSKeyword("pInset_Shape", params.insetShape, "pInset: Shape type"));
   keywords.push(new FITSKeyword("pInset_Zoom", params.zoomFactor.toString(), "pInset: Zoom factor"));
   keywords.push(new FITSKeyword("pInset_Source", dialog.targetView.id, "pInset: Source image ID"));
   newWindow.keywords = keywords;
   
   console.writeln("pInset: Stored extraction metadata in FITS keywords");
   
   // Show the new window
   newWindow.show();
   
   console.writeln("pInset: Extraction complete - created " + newView.id);
}

/**
 * Set up mouse event handlers for the Extract preview control.
 * @param {Dialog} dialog - The parent dialog
 * @param {Control} previewControl - The extract preview control
 */
function createExtractPreviewHandlers(dialog, previewControl) {
   
   // Mouse press handler
   previewControl.onMousePress = function(x, y, button, buttonState, modifiers) {
      if (button !== 1) return;
      if (dialog.isPreviewMode) return;
      if (!dialog.previewBitmap) return;
      
      var offsetX = (this.width - dialog.previewBitmap.width) / 2;
      var offsetY = (this.height - dialog.previewBitmap.height) / 2;
      var px = x - offsetX;
      var py = y - offsetY;
      
      dialog.dragStartX = px;
      dialog.dragStartY = py;
      
      if (dialog.hasDrawnRegion) {
         var hit = dialog.hitTestRegion(px, py);
         
         if (hit.handle) {
            dialog.interactionMode = "resize";
            dialog.resizeHandle = hit.handle;
            dialog.originalRegion = {
               x: dialog.params.regionX,
               y: dialog.params.regionY,
               w: dialog.params.regionWidth,
               h: dialog.params.regionHeight
            };
            return;
         } else if (hit.inside) {
            dialog.interactionMode = "move";
            var shapeX = dialog.params.regionX * dialog.previewScale;
            var shapeY = dialog.params.regionY * dialog.previewScale;
            dialog.dragOffsetX = px - shapeX;
            dialog.dragOffsetY = py - shapeY;
            return;
         }
      }
      
      dialog.interactionMode = "draw";
      dialog.hasDrawnRegion = true;
   };
   
   // Mouse move handler
   previewControl.onMouseMove = function(x, y, buttonState, modifiers) {
      if (!dialog.interactionMode) return;
      if (!dialog.previewBitmap) return;
      
      var offsetX = (this.width - dialog.previewBitmap.width) / 2;
      var offsetY = (this.height - dialog.previewBitmap.height) / 2;
      var px = x - offsetX;
      var py = y - offsetY;
      
      if (dialog.interactionMode === "draw") {
         var x0 = Math.min(dialog.dragStartX, px);
         var y0 = Math.min(dialog.dragStartY, py);
         var x1 = Math.max(dialog.dragStartX, px);
         var y1 = Math.max(dialog.dragStartY, py);
         
         var imgX = Math.round(x0 / dialog.previewScale);
         var imgY = Math.round(y0 / dialog.previewScale);
         var imgW = Math.round((x1 - x0) / dialog.previewScale);
         var imgH = Math.round((y1 - y0) / dialog.previewScale);
         
         imgX = Math.max(0, Math.min(dialog.imageWidth - 10, imgX));
         imgY = Math.max(0, Math.min(dialog.imageHeight - 10, imgY));
         imgW = Math.max(10, Math.min(dialog.imageWidth - imgX, imgW));
         imgH = Math.max(10, Math.min(dialog.imageHeight - imgY, imgH));
         
         if (dialog.params.insetShape === "Circular") {
            var size = Math.max(imgW, imgH);
            imgW = size;
            imgH = size;
         }
         
         dialog.params.regionX = imgX;
         dialog.params.regionY = imgY;
         dialog.params.regionWidth = imgW;
         dialog.params.regionHeight = imgH;
         
      } else if (dialog.interactionMode === "move") {
         var newX = Math.round((px - dialog.dragOffsetX) / dialog.previewScale);
         var newY = Math.round((py - dialog.dragOffsetY) / dialog.previewScale);
         
         newX = Math.max(0, Math.min(dialog.imageWidth - dialog.params.regionWidth, newX));
         newY = Math.max(0, Math.min(dialog.imageHeight - dialog.params.regionHeight, newY));
         
         dialog.params.regionX = newX;
         dialog.params.regionY = newY;
         
      } else if (dialog.interactionMode === "resize") {
         var orig = dialog.originalRegion;
         var dx = Math.round(px / dialog.previewScale) - Math.round(dialog.dragStartX / dialog.previewScale);
         var dy = Math.round(py / dialog.previewScale) - Math.round(dialog.dragStartY / dialog.previewScale);
         
         var newX = orig.x, newY = orig.y, newW = orig.w, newH = orig.h;
         
         if (dialog.resizeHandle.indexOf("w") !== -1) {
            newX = Math.max(0, orig.x + dx);
            newW = orig.w - (newX - orig.x);
         }
         if (dialog.resizeHandle.indexOf("e") !== -1) {
            newW = Math.min(dialog.imageWidth - orig.x, orig.w + dx);
         }
         if (dialog.resizeHandle.indexOf("n") !== -1) {
            newY = Math.max(0, orig.y + dy);
            newH = orig.h - (newY - orig.y);
         }
         if (dialog.resizeHandle.indexOf("s") !== -1) {
            newH = Math.min(dialog.imageHeight - orig.y, orig.h + dy);
         }
         
         newW = Math.max(10, newW);
         newH = Math.max(10, newH);
         
         if (dialog.params.insetShape === "Circular") {
            // Determine if user is shrinking or enlarging based on change from original
            var avgNewSize = (newW + newH) / 2;
            var avgOrigSize = (orig.w + orig.h) / 2;
            var size;
            if (avgNewSize < avgOrigSize) {
               // Shrinking - use the smaller dimension
               size = Math.min(newW, newH);
            } else {
               // Enlarging - use the larger dimension
               size = Math.max(newW, newH);
            }
            newW = size;
            newH = size;
         }
         
         dialog.params.regionX = newX;
         dialog.params.regionY = newY;
         dialog.params.regionWidth = newW;
         dialog.params.regionHeight = newH;
      }
      
      this.repaint();
   };
   
   // Mouse release handler
   previewControl.onMouseRelease = function(x, y, button, buttonState, modifiers) {
      dialog.interactionMode = null;
      dialog.resizeHandle = null;
      dialog.originalRegion = null;
      updateZoomLimit(dialog);
      this.repaint();
   };
   
   // Resize handler
   previewControl.onResize = function(newWidth, newHeight, oldWidth, oldHeight) {
      if (dialog.targetView && !dialog.targetView.isNull && 
          (newWidth !== oldWidth || newHeight !== oldHeight)) {
         dialog.updatePreviewBitmap();
      }
   };
}

/**
 * Create paint handler for the Extract preview control.
 * @param {Dialog} dialog - The parent dialog
 * @param {Control} previewControl - The extract preview control
 */
function createExtractPreviewPaintHandler(dialog, previewControl) {
   previewControl.onPaint = function(x0, y0, x1, y1) {
      var g = new Graphics(this);
      g.clipRect = new Rect(x0, y0, x1, y1);
      g.fillRect(this.boundsRect, new Brush(0xFF333333));
      
      // Check if in zoomed preview mode
      if (dialog.isPreviewMode && dialog.zoomedPreviewBitmap) {
         var offsetX = (this.width - dialog.zoomedPreviewBitmap.width) / 2;
         var offsetY = (this.height - dialog.zoomedPreviewBitmap.height) / 2;
         g.drawBitmap(offsetX, offsetY, dialog.zoomedPreviewBitmap);
      } else if (dialog.previewBitmap) {
         var offsetX = (this.width - dialog.previewBitmap.width) / 2;
         var offsetY = (this.height - dialog.previewBitmap.height) / 2;
         g.drawBitmap(offsetX, offsetY, dialog.previewBitmap);
         dialog.drawSelectionOverlay(g, offsetX, offsetY);
      } else {
         g.pen = new Pen(0xFFAAAAAA);
         g.drawText(this.width / 2 - 80, this.height / 2, "Select an image to preview");
      }
      
      g.end();
   };
}
