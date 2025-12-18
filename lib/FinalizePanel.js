// ----------------------------------------------------------------------------
// FinalizePanel.js - Finalize mode UI panel for pInset
// ----------------------------------------------------------------------------
//
// Contains controls for the Finalize mode:
// - Source image selection (outside group)
// - Extracted image selection (outside group)
// - Finalize Options group (disabled until both images selected)
//
// Author: Giovanni Rocca (iGio90) and Antigravity
//
// ----------------------------------------------------------------------------

#include "FinalizeUI.js"
#include "FinalizePreview.js"

// =============================================================================
// FINALIZE MODE FUNCTIONS
// =============================================================================

/**
 * Read extraction metadata from a view's FITS keywords.
 * @param {Dialog} dialog - The parent dialog
 * @param {View} view - The extracted image view
 */
function readExtractionMetadata(dialog, view) {
   // Reset region state first - clear any previous shape
   dialog.hasDrawnRegion = false;
   
   if (!view || view.isNull) return;
   
   var window = view.window;
   var keywords = window.keywords;
   
   var metadata = {
      regionX: null,
      regionY: null,
      regionW: null,
      regionH: null,
      shape: null,
      zoom: null,
      sourceId: null
   };
   
   // Parse FITS keywords
   for (var i = 0; i < keywords.length; i++) {
      var kw = keywords[i];
      var name = kw.name;
      var value = kw.value;
      
      if (name === "pInset_RegionX") metadata.regionX = parseInt(value);
      else if (name === "pInset_RegionY") metadata.regionY = parseInt(value);
      else if (name === "pInset_RegionW") metadata.regionW = parseInt(value);
      else if (name === "pInset_RegionH") metadata.regionH = parseInt(value);
      else if (name === "pInset_Shape") metadata.shape = value.replace(/'/g, "").trim();
      else if (name === "pInset_Zoom") metadata.zoom = parseFloat(value);
      else if (name === "pInset_Source") metadata.sourceId = value.replace(/'/g, "").trim();
   }
   
   // Check if we have valid metadata
   if (metadata.regionX !== null && metadata.regionW !== null) {
      dialog.params.regionX = metadata.regionX;
      dialog.params.regionY = metadata.regionY;
      dialog.params.regionWidth = metadata.regionW;
      dialog.params.regionHeight = metadata.regionH;
      dialog.params.insetShape = metadata.shape || "Rectangular";
      dialog.params.zoomFactor = metadata.zoom || 2.0;
      dialog.hasDrawnRegion = true;
      
      console.writeln("pInset: Loaded metadata - Region: " + metadata.regionX + "," + metadata.regionY + 
         " Size: " + metadata.regionW + "x" + metadata.regionH + " Shape: " + metadata.shape);
      
      // If we found source image ID, log it
      if (metadata.sourceId && dialog.finalizeSourceList) {
         console.writeln("pInset: Source image was: " + metadata.sourceId);
      }
   } else {
      // No valid metadata - show warning to user
      console.writeln("pInset: No pInset metadata found in image '" + view.id + "'");
      var msgBox = new MessageBox(
         "This image does not contain pInset extraction metadata.\n\n" +
         "Please select an image that was created using pInset Extract mode.",
         "pInset - Invalid Inset Image",
         StdIcon_Warning,
         StdButton_Ok
      );
      msgBox.execute();
   }
}

/**
 * Check if both finalize images are selected and enable/disable options group.
 * @param {Dialog} dialog - The parent dialog
 */
function checkFinalizeImagesSelected(dialog) {
   var sourceValid = !!(dialog.finalizeSourceView && !dialog.finalizeSourceView.isNull);
   var insetValid = !!(dialog.finalizeInsetView && !dialog.finalizeInsetView.isNull);
   var hasValidMetadata = dialog.hasDrawnRegion;
   
   // Check if source and inset are the same image
   var imagesAreDifferent = true;
   if (sourceValid && insetValid) {
      if (dialog.finalizeSourceView.id === dialog.finalizeInsetView.id) {
         imagesAreDifferent = false;
         
         if (!dialog._shownSameImageWarning) {
            dialog._shownSameImageWarning = true;
            console.writeln("pInset: Source and inset images are identical");
            var msgBox = new MessageBox(
               "Source Image and Inset Image cannot be the same.\n\n" +
               "Please select different images.",
               "pInset - Invalid Selection",
               StdIcon_Warning,
               StdButton_Ok
            );
            msgBox.execute();
         }
      } else {
         dialog._shownSameImageWarning = false;
      }
   }
   
   // Additional check: region must fit within source image
   var regionFitsSource = true;
   if (sourceValid && hasValidMetadata && imagesAreDifferent) {
      var srcImage = dialog.finalizeSourceView.image;
      var regionEndX = dialog.params.regionX + dialog.params.regionWidth;
      var regionEndY = dialog.params.regionY + dialog.params.regionHeight;
      
      if (regionEndX > srcImage.width || regionEndY > srcImage.height ||
          dialog.params.regionX < 0 || dialog.params.regionY < 0) {
         regionFitsSource = false;
         
         // Show warning if this is a new invalid state
         if (!dialog._shownRegionSizeWarning) {
            dialog._shownRegionSizeWarning = true;
            console.writeln("pInset: Region exceeds source image bounds");
            var msgBox = new MessageBox(
               "The inset region (" + dialog.params.regionWidth + "x" + dialog.params.regionHeight + 
               " at " + dialog.params.regionX + "," + dialog.params.regionY + 
               ") exceeds the source image dimensions (" + srcImage.width + "x" + srcImage.height + ").\n\n" +
               "Please select a different source image that contains the original extraction region.",
               "pInset - Region Mismatch",
               StdIcon_Warning,
               StdButton_Ok
            );
            msgBox.execute();
         }
      } else {
         dialog._shownRegionSizeWarning = false;
      }
   }
   
   // Enable options group and generate button only if all validations pass
   var allValid = sourceValid && insetValid && hasValidMetadata && imagesAreDifferent && regionFitsSource;
   dialog.finalizeGroup.enabled = allValid;
   if (dialog.generateButton) {
      dialog.generateButton.enabled = allValid;
   }
   
   // Initialize inset position and create bitmap if valid
   if (allValid && !dialog.insetBitmap) {
      initializeInsetPosition(dialog);
      createInsetBitmap(dialog);
   }
}

/**
 * Initialize the inset position and size.
 * Scales inset to 1/3 of source image width, positioned at bottom-left with margin.
 * @param {Dialog} dialog - The parent dialog
 */
function initializeInsetPosition(dialog) {
   if (!dialog.finalizeSourceView || dialog.finalizeSourceView.isNull) return;
   if (!dialog.finalizeInsetView || dialog.finalizeInsetView.isNull) return;
   
   var srcImage = dialog.finalizeSourceView.image;
   var insetImage = dialog.finalizeInsetView.image;
   
   // Default margin from edge (in source image coordinates)
   var margin = 20;
   
   // Scale inset to 1/3 of source image width, maintaining aspect ratio
   var targetWidth = Math.round(srcImage.width / 3);
   var aspectRatio = insetImage.height / insetImage.width;
   var targetHeight = Math.round(targetWidth * aspectRatio);
   
   dialog.insetWidth = targetWidth;
   dialog.insetHeight = targetHeight;
   
   // Position at bottom-left corner with margin
   dialog.insetX = margin;
   dialog.insetY = srcImage.height - targetHeight - margin;
   
   // Clamp to valid range
   dialog.insetX = Math.max(0, dialog.insetX);
   dialog.insetY = Math.max(0, dialog.insetY);
   
   console.writeln("pInset: Initialized inset at " + dialog.insetX + "," + dialog.insetY + 
      " size " + dialog.insetWidth + "x" + dialog.insetHeight + 
      " (scaled from " + insetImage.width + "x" + insetImage.height + ")");
}

/**
 * Generate the final image with the inset.
 * @param {Dialog} dialog - The parent dialog
 */
function generateFinalImage(dialog) {
   if (!dialog.finalizeSourceView || dialog.finalizeSourceView.isNull ||
       !dialog.finalizeInsetView || dialog.finalizeInsetView.isNull) {
      return;
   }
   
   var params = dialog.params;

   // 1. Calculate Canvas Dimensions (Union of source and inset)
   var srcImage = dialog.finalizeSourceView.image;
   var insetX = dialog.insetX;
   var insetY = dialog.insetY;
   var insetW = dialog.insetWidth;
   var insetH = dialog.insetHeight;
   
   // Determine bounding box of the composition
   var padding = 20;
   var minX = insetX < 0 ? insetX - padding : 0;
   var minY = insetY < 0 ? insetY - padding : 0;
   var maxX = (insetX + insetW > srcImage.width) ? insetX + insetW + padding : srcImage.width;
   var maxY = (insetY + insetH > srcImage.height) ? insetY + insetH + padding : srcImage.height;
   
   var canvasWidth = maxX - minX;
   var canvasHeight = maxY - minY;
   var offsetX = -minX; // Shift source image by this amount
   var offsetY = -minY;
   
   console.writeln("pInset: Generating output image (" + canvasWidth + "x" + canvasHeight + ")");
   
   // 2. Create New Image Window
   var targetWindow = new ImageWindow(
      canvasWidth,
      canvasHeight,
      srcImage.numberOfChannels,
      srcImage.bitsPerSample,
      srcImage.isReal,
      srcImage.isColor,
      "Inset_Final"
   );
   
   var targetView = targetWindow.mainView;
   var targetImage = targetView.image;
   
   // 3. Copy Source Image
   targetView.beginProcess();
   
   // Fill with black/zero
   targetImage.fill(0);
   
   // Apply source image onto targetImage at simplified offset
   var dstPoint = new Point(offsetX, offsetY);
   targetImage.selectedPoint = dstPoint;
   targetImage.apply(srcImage); 
   
   // Pre-calculate shared color/border values (optimization: avoid redundant calculations)
   var indR = (params.indicatorColorR !== undefined) ? params.indicatorColorR / 255 : 1.0;
   var indG = (params.indicatorColorG !== undefined) ? params.indicatorColorG / 255 : 1.0;
   var indB = (params.indicatorColorB !== undefined) ? params.indicatorColorB / 255 : 0.0;
   var indAlpha = (params.indicatorOpacity !== undefined) ? params.indicatorOpacity / 100 : 1.0;
   var indicatorColor = { r: indR, g: indG, b: indB, a: indAlpha };
   var borderWidth = (params.indicatorBorderWidth !== undefined) ? params.indicatorBorderWidth : 2;
   
   // Create single engine instance (optimization: avoid repeated instantiation)
   var engine = new InsetEngine();
   
   // 4. Draw Source Indicator (if enabled)
   if (params.drawSourceIndicator !== false && dialog.hasDrawnRegion) {
      var indRect = new Rect(
         params.regionX + offsetX,
         params.regionY + offsetY,
         params.regionX + params.regionWidth + offsetX,
         params.regionY + params.regionHeight + offsetY
      );
      
      engine.drawSourceIndicator(targetImage, indRect, indicatorColor, borderWidth, params.insetShape);
   }
   
   // 5. Draw Connection Lines (if enabled)
   if (params.drawConnectionLine !== false && dialog.hasDrawnRegion) {
      var srcRect = new Rect(
         params.regionX + offsetX,
         params.regionY + offsetY,
         params.regionX + params.regionWidth + offsetX,
         params.regionY + params.regionHeight + offsetY
      );
      
      var insRect = new Rect(
         insetX + offsetX,
         insetY + offsetY,
         insetX + insetW + offsetX,
         insetY + insetH + offsetY
      );
      
      engine.drawConnectionLine(targetImage, srcRect, insRect, indicatorColor, borderWidth, params.insetShape, dialog.sourceAnchors);
   }
   
   // 6. Process and Composite Inset
   // Needed: Extracted Inset Data
   var insetSrcImage = dialog.finalizeInsetView.image;
   var fullRect = new Rect(0, 0, insetSrcImage.width, insetSrcImage.height);
   
   // Extract (and create mask if circular)
   var extractedData;
   if (params.insetShape === "Circular") {
      var center = { x: insetSrcImage.width / 2, y: insetSrcImage.height / 2 };
      extractedData = engine.extractCircularRegion(insetSrcImage, center, insetSrcImage.width);
   } else {
      extractedData = engine.extractRegion(insetSrcImage, fullRect);
   }
   
   // Scale to target size (subtract border from target size to keep total size correct)
   var contentW = Math.max(1, insetW - 2 * borderWidth);
   var contentH = Math.max(1, insetH - 2 * borderWidth);
   
   var scaledData = engine.scalePixels(extractedData, contentW, contentH);
   
   // Add Border (use pre-calculated color)
   var borderedData = engine.addBorder(scaledData, borderWidth, indicatorColor);
   
   // Composite
   var finalPos = { x: insetX + offsetX, y: insetY + offsetY };
   var insetOpacity = (params.applyOpacityToImage === true) ? indAlpha : 1.0;
   
   engine.compositeInset(targetImage, borderedData, finalPos, insetOpacity);
   
   targetView.endProcess();
   targetWindow.show();
   targetWindow.zoomToFit();
}

