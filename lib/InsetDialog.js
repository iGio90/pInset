// ----------------------------------------------------------------------------
// InsetDialog.js - UI components for pInset
// ----------------------------------------------------------------------------
//
// This module contains:
// - Dialog construction with horizontal split layout
// - Left panel: controls
// - Right panel: interactive image preview
// - Mouse event handlers for region drawing
//
// Author: Giovanni Rocca (iGio90) and Antigravity
//
// ----------------------------------------------------------------------------

#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/PenStyle.jsh>
#include <pjsr/BrushStyle.jsh>

// Include panel modules
#include "ExtractPanel.js"
#include "FinalizePanel.js"
#include "ScalingUtils.js"

/**
 * pInsetDialogUI - Full dialog implementation with horizontal split layout.
 * Left panel: Controls (~300px)
 * Right panel: Interactive image preview (expandable)
 */
function pInsetDialogUI(params) {
   this.__base__ = Dialog;
   this.__base__();
   
   // Default parameters
   this.params = params || {
      regionX: 0,
      regionY: 0,
      regionWidth: 100,
      regionHeight: 100,
      insetShape: "Rectangular",
      zoomFactor: 2.0,
      positionPreset: "Bottom-Right",
      customX: 0,
      customY: 0,
      // Extraction region indicator border
      indicatorBorderWidth: 2,
      indicatorColorR: 255,
      indicatorColorG: 255,
      indicatorColorB: 0,
      indicatorOpacity: 100,  // 0-100%
      // Inset image border
      insetBorderWidth: 3,
      insetColorR: 255,
      insetColorG: 255,
      insetColorB: 0,
      insetOpacity: 100,  // 0-100%
      linkBorderOptions: true,  // When true, inset uses indicator settings
      margin: 10,
      drawConnectionLine: true,
      drawSourceIndicator: true,
      applyOpacityToImage: false
   };
   
   this.targetView = null;
   this.previewBitmap = null;
   this.previewScale = 1.0;
   this.imageWidth = 0;
   this.imageHeight = 0;
   
   // Interaction state
   this.interactionMode = null; // null, "draw", "move", "resize"
   this.hasDrawnRegion = false;
   this.dragStartX = 0;
   this.dragStartY = 0;
   this.dragOffsetX = 0; // For move: offset from shape origin
   this.dragOffsetY = 0;
   this.resizeHandle = null; // "nw", "ne", "sw", "se" for corners
   this.originalRegion = null; // Store original region during resize
   
   // Edge detection threshold in pixels
   this.handleSize = 10;
   
   // Preview mode state
   this.isPreviewMode = false;
   this.zoomedPreviewBitmap = null;
   
   // Finalize mode: inset position/size state
   this.insetX = 0;
   this.insetY = 0;
   this.insetWidth = 100;
   this.insetHeight = 100;
   this.insetBitmap = null;
   this.finalizeInteractionMode = null; // null, "move", "resize", "pan"
   this.finalizeDragStartX = 0;
   this.finalizeDragStartY = 0;
   this.finalizeDragOffsetX = 0;
   this.finalizeDragOffsetY = 0;
   this.finalizeResizeHandle = null;
   this.finalizeOriginalRegion = null;
   
   // Finalize preview zoom/pan state
   this.finalizeZoom = 1.0;       // 1.0 = fit to preview, <1 = zoom out
   this.finalizePanX = 0;         // Pan offset in preview coordinates
   this.finalizePanY = 0;
   
   // Source anchor positions for connection lines
   // For circular: angles in radians (default: left=PI, right=0)
   // For rectangular: not used - corners are fixed
   this.sourceAnchors = {
      // Circular anchors (angles in radians, 0 = right, PI = left)
      leftAngle: Math.PI,      // Left side of circle
      rightAngle: 0            // Right side of circle
   };

   
   var self = this;
   
   // =========================================================================
   // LEFT PANEL - Controls
   // =========================================================================
   
   this.leftPanel = this.createLeftPanel();
   
   // =========================================================================
   // RIGHT PANEL - Interactive Preview
   // =========================================================================
   
   this.rightPanel = this.createRightPanel();
   
   // =========================================================================
   // MAIN HORIZONTAL SPLIT LAYOUT
   // =========================================================================
   
   this.mainSizer = new HorizontalSizer;
   this.mainSizer.margin = 8;
   this.mainSizer.spacing = 8;
   this.mainSizer.add(this.leftPanel);
   this.mainSizer.add(this.rightPanel, 100); // Right panel expands
   
   this.sizer = this.mainSizer;
   
   this.windowTitle = "pInset - Create Image Inset";
   this.adjustToContents();
   this.setMinWidth(1100);
   this.setMinHeight(700);
}

pInsetDialogUI.prototype = new Dialog;

// =============================================================================
// LEFT PANEL CREATION
// =============================================================================

pInsetDialogUI.prototype.createLeftPanel = function() {
   var self = this;
   
   var panel = new Control(this);
   panel.setFixedWidth(300);
   
   // Label alignment width
   var labelWidth = 60;
   
   // -------------------------------------------------------------------------
   // Mode Selection
   // -------------------------------------------------------------------------
   
   this.modeLabel = new Label(panel);
   this.modeLabel.text = "Mode:";
   this.modeLabel.setFixedWidth(labelWidth);
   this.modeLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   this.modeCombo = new ComboBox(panel);
   this.modeCombo.addItem("Extract");
   this.modeCombo.addItem("Finalize");
   this.modeCombo.currentItem = 0;
   this.modeCombo.onItemSelected = function(index) {
      self.updateModeVisibility(index);
   };
   
   var modeSizer = new HorizontalSizer;
   modeSizer.spacing = 6;
   modeSizer.add(this.modeLabel);
   modeSizer.add(this.modeCombo, 100);
   
   // =========================================================================
   // EXTRACT MODE CONTROLS
   // =========================================================================
   
   var extractControls = createExtractControls(this, this.params, labelWidth, panel);
   
   // =========================================================================
   // FINALIZE MODE OPTIONS
   // =========================================================================
   
   var finalizeControls = createFinalizeControls(this, this.params, labelWidth, panel);
   
   // Hook up generate button
   this.onGenerate = function() {
      generateFinalImage(self);
   };
   
   // -------------------------------------------------------------------------
   // Left Panel Layout
   // -------------------------------------------------------------------------
   
   var leftSizer = new VerticalSizer;
   leftSizer.margin = 0;
   leftSizer.spacing = 6;
   leftSizer.add(modeSizer);
   // Extract mode controls
   leftSizer.add(extractControls.imageLabel);
   leftSizer.add(extractControls.imageList);
   leftSizer.add(extractControls.group);
   leftSizer.add(extractControls.buttonsSizer);
   // Finalize mode controls
   leftSizer.add(finalizeControls.sourceLabel);
   leftSizer.add(finalizeControls.sourceList);
   leftSizer.add(finalizeControls.insetLabel);
   leftSizer.add(finalizeControls.insetList);
   leftSizer.add(finalizeControls.group);
   leftSizer.add(finalizeControls.generateButton);
   leftSizer.addStretch();
   
   panel.sizer = leftSizer;
   
   return panel;
};

// =============================================================================
// RIGHT PANEL (PREVIEW) CREATION
// =============================================================================

pInsetDialogUI.prototype.createRightPanel = function() {
   var self = this;
   
   // =========================================================================
   // EXTRACT MODE PREVIEW (Interactive)
   // =========================================================================
   
   this.extractPreviewControl = new Control(this);
   this.extractPreviewControl.setMinSize(400, 400);
   this.extractPreviewControl.cursor = new Cursor(StdCursor_Cross);
   this.extractPreviewControl.mouseTracking = true;
   
   // Set up paint and event handlers using ExtractPanel functions
   createExtractPreviewPaintHandler(this, this.extractPreviewControl);
   createExtractPreviewHandlers(this, this.extractPreviewControl);
   
   // =========================================================================
   // FINALIZE MODE PREVIEW (Interactive)
   // =========================================================================
   
   this.finalizePreviewControl = new Control(this);
   this.finalizePreviewControl.setMinSize(400, 400);
   this.finalizePreviewControl.visible = false; // Hidden by default
   this.finalizePreviewControl.cursor = new Cursor(StdCursor_Cross);
   this.finalizePreviewControl.mouseTracking = true;
   
   // Set up paint and event handlers using FinalizePanel functions
   createFinalizePreviewPaintHandler(this, this.finalizePreviewControl);
   createFinalizePreviewHandlers(this, this.finalizePreviewControl);
   
   // Frame for the previews (stack them)
   var frame = new Frame(this);
   frame.frameStyle = FrameStyle_Sunken;
   
   var frameSizer = new VerticalSizer;
   frameSizer.margin = 0;
   frameSizer.add(this.extractPreviewControl, 100);
   frameSizer.add(this.finalizePreviewControl, 100);
   frame.sizer = frameSizer;
   
   // Set previewControl reference for backward compatibility
   this.previewControl = this.extractPreviewControl;
   
   return frame;
};


// =============================================================================
// DRAWING HELPERS
// =============================================================================

pInsetDialogUI.prototype.drawSelectionOverlay = function(g, offsetX, offsetY) {
   // Only draw if user has drawn a region
   if (!this.hasDrawnRegion) return;
   if (this.params.regionWidth < 10 || this.params.regionHeight < 10) return;
   
   // Convert image coordinates to preview coordinates
   var px = this.params.regionX * this.previewScale + offsetX;
   var py = this.params.regionY * this.previewScale + offsetY;
   var pw = this.params.regionWidth * this.previewScale;
   var ph = this.params.regionHeight * this.previewScale;
   
   // Enable antialiasing for smoother drawing
   g.antialiasing = true;
   
   if (this.params.insetShape === "Circular") {
      // Draw ellipse/circle
      var cx = px + pw / 2;
      var cy = py + ph / 2;
      var r = Math.min(pw, ph) / 2;
      
      // Fill
      g.pen = new Pen(0x00000000, 0);
      g.brush = new Brush(0x40FFFF00);
      g.fillEllipse(cx - r, cy - r, cx + r, cy + r);
      
      // Border
      g.pen = new Pen(0xFFFFFF00, 2);
      g.strokeEllipse(cx - r, cy - r, cx + r, cy + r);
      
      // Draw cardinal handles for circular shapes (only in Extract mode)
      if (this.getMode() === "Extract") {
         var hs = 6; // Handle visual size
         g.pen = new Pen(0xFFFFFFFF, 1);
         g.brush = new Brush(0xFFFFFF00);
         
         // North (top)
         g.fillRect(cx - hs, cy - r - hs, cx + hs, cy - r + hs);
         g.strokeRect(cx - hs, cy - r - hs, cx + hs, cy - r + hs);
         
         // South (bottom)
         g.fillRect(cx - hs, cy + r - hs, cx + hs, cy + r + hs);
         g.strokeRect(cx - hs, cy + r - hs, cx + hs, cy + r + hs);
         
         // West (left)
         g.fillRect(cx - r - hs, cy - hs, cx - r + hs, cy + hs);
         g.strokeRect(cx - r - hs, cy - hs, cx - r + hs, cy + hs);
         
         // East (right)
         g.fillRect(cx + r - hs, cy - hs, cx + r + hs, cy + hs);
         g.strokeRect(cx + r - hs, cy - hs, cx + r + hs, cy + hs);
      }
   } else {
      // Draw rectangle
      g.pen = new Pen(0x00000000, 0);
      g.brush = new Brush(0x40FFFF00);
      g.fillRect(px, py, px + pw, py + ph);
      
      // Border
      g.pen = new Pen(0xFFFFFF00, 2);
      g.strokeRect(px, py, px + pw, py + ph);
      
      // Draw corner handles for rectangular shapes (only in Extract mode)
      if (this.getMode() === "Extract") {
         var hs = 6; // Handle visual size
         g.pen = new Pen(0xFFFFFFFF, 1);
         g.brush = new Brush(0xFFFFFF00);
         
         // NW corner
         g.fillRect(px - hs, py - hs, px + hs, py + hs);
         g.strokeRect(px - hs, py - hs, px + hs, py + hs);
         
         // NE corner
         g.fillRect(px + pw - hs, py - hs, px + pw + hs, py + hs);
         g.strokeRect(px + pw - hs, py - hs, px + pw + hs, py + hs);
         
         // SW corner
         g.fillRect(px - hs, py + ph - hs, px + hs, py + ph + hs);
         g.strokeRect(px - hs, py + ph - hs, px + hs, py + ph + hs);
         
         // SE corner
         g.fillRect(px + pw - hs, py + ph - hs, px + pw + hs, py + ph + hs);
         g.strokeRect(px + pw - hs, py + ph - hs, px + pw + hs, py + ph + hs);
      }
   }
   
   // Draw dimensions text
   g.pen = new Pen(0xFFFFFFFF);
   g.drawText(px + 4, py + ph + 14, 
      Math.round(this.params.regionWidth) + " x " + Math.round(this.params.regionHeight));
};

/**
 * Draw read-only selection overlay for Finalize mode (no handles, transparent).
 * Delegates to FinalizePanel function.
 */
pInsetDialogUI.prototype.drawFinalizeOverlay = function(g, offsetX, offsetY) {
   drawFinalizeOverlay(this, g, offsetX, offsetY);
};


pInsetDialogUI.prototype.hitTestRegion = function(px, py) {
   // Returns { handle: "nw"|"ne"|"sw"|"se"|"n"|"s"|"e"|"w"|null, inside: boolean }
   // px, py are in preview coordinates
   
   if (!this.hasDrawnRegion) return { handle: null, inside: false };
   
   // Get shape bounds in preview coordinates
   var x0 = this.params.regionX * this.previewScale;
   var y0 = this.params.regionY * this.previewScale;
   var pw = this.params.regionWidth * this.previewScale;
   var ph = this.params.regionHeight * this.previewScale;
   var x1 = x0 + pw;
   var y1 = y0 + ph;
   
   var hs = this.handleSize;
   
   if (this.params.insetShape === "Circular") {
      // For circular: use cardinal point handles
      var cx = x0 + pw / 2;
      var cy = y0 + ph / 2;
      var r = Math.min(pw, ph) / 2;
      
      // Larger hit area for circular handles
      var circleHs = 15;
      
      // North (top)
      if (px >= cx - circleHs && px <= cx + circleHs && 
          py >= cy - r - circleHs && py <= cy - r + circleHs) {
         return { handle: "n", inside: false };
      }
      // South (bottom)
      if (px >= cx - circleHs && px <= cx + circleHs && 
          py >= cy + r - circleHs && py <= cy + r + circleHs) {
         return { handle: "s", inside: false };
      }
      // West (left)
      if (px >= cx - r - circleHs && px <= cx - r + circleHs && 
          py >= cy - circleHs && py <= cy + circleHs) {
         return { handle: "w", inside: false };
      }
      // East (right)
      if (px >= cx + r - circleHs && px <= cx + r + circleHs && 
          py >= cy - circleHs && py <= cy + circleHs) {
         return { handle: "e", inside: false };
      }
      
      // Check if inside the circle
      var dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
      if (dist <= r) {
         return { handle: null, inside: true };
      }
   } else {
      // For rectangular: use corner handles
      // Northwest corner
      if (px >= x0 - hs && px <= x0 + hs && py >= y0 - hs && py <= y0 + hs) {
         return { handle: "nw", inside: false };
      }
      // Northeast corner
      if (px >= x1 - hs && px <= x1 + hs && py >= y0 - hs && py <= y0 + hs) {
         return { handle: "ne", inside: false };
      }
      // Southwest corner
      if (px >= x0 - hs && px <= x0 + hs && py >= y1 - hs && py <= y1 + hs) {
         return { handle: "sw", inside: false };
      }
      // Southeast corner
      if (px >= x1 - hs && px <= x1 + hs && py >= y1 - hs && py <= y1 + hs) {
         return { handle: "se", inside: false };
      }
      
      // Check if inside the rectangle
      if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
         return { handle: null, inside: true };
      }
   }
   
   return { handle: null, inside: false };
};

// =============================================================================
// PREVIEW BITMAP
// =============================================================================

pInsetDialogUI.prototype.updatePreviewBitmap = function() {
   // Safety check - previewControl may not exist during initialization
   if (!this.previewControl) {
      return;
   }
   
   if (!this.targetView || this.targetView.isNull) {
      this.previewBitmap = null;
      this.previewControl.repaint();
      return;
   }
   
   var image = this.targetView.image;
   this.imageWidth = image.width;
   this.imageHeight = image.height;
   
   // Calculate scale to fit preview area
   var previewW = this.previewControl.width - 20;
   var previewH = this.previewControl.height - 20;
   
   // Ensure valid dimensions
   if (previewW <= 0 || previewH <= 0) {
      previewW = 400;
      previewH = 400;
   }
   
   var scaleX = previewW / this.imageWidth;
   var scaleY = previewH / this.imageHeight;
   this.previewScale = Math.min(scaleX, scaleY, 1.0); // Don't upscale
   
   var scaledW = Math.round(this.imageWidth * this.previewScale);
   var scaledH = Math.round(this.imageHeight * this.previewScale);
   
   // Ensure minimum size
   scaledW = Math.max(10, scaledW);
   scaledH = Math.max(10, scaledH);
   
   // Render image to bitmap (no beginProcess needed for reading)
   try {
      // Render and scale the image
      var fullBitmap = image.render();
      this.previewBitmap = fullBitmap.scaledTo(scaledW, scaledH);
   } catch (e) {
      console.writeln("pInset: Error rendering preview - " + e.message);
      this.previewBitmap = null;
   }
   
   this.previewControl.repaint();
};

// =============================================================================
// UTILITY METHODS
// =============================================================================

pInsetDialogUI.prototype.updateImageDimensions = function() {
   if (!this.targetView || this.targetView.isNull) return;
   
   var image = this.targetView.image;
   this.imageWidth = image.width;
   this.imageHeight = image.height;
};

pInsetDialogUI.prototype.collectParams = function() {
   // regionX/Y/Width/Height are already set by mouse drawing in params
   this.params.insetShape = this.shapeCombo.currentItem === 1 ? "Circular" : "Rectangular";
   this.params.zoomFactor = this.zoomControl.value;
   
   // Finalize-mode controls - only access if they exist
   if (this.borderWidthSlider) {
      this.params.insetBorderWidth = this.borderWidthSlider.value;
   }
   if (this.borderR) {
      this.params.insetColorR = this.borderR.value;
   }
   if (this.borderG) {
      this.params.insetColorG = this.borderG.value;
   }
   if (this.borderB) {
      this.params.insetColorB = this.borderB.value;
   }
   if (this.marginSpin) {
      this.params.margin = this.marginSpin.value;
   }
   if (this.drawLineCheck) {
      this.params.drawConnectionLine = this.drawLineCheck.checked;
   }
   if (this.drawIndicatorCheck) {
      this.params.drawSourceIndicator = this.drawIndicatorCheck.checked;
   }
   if (this.applyOpacityCheck) {
      this.params.applyOpacityToImage = this.applyOpacityCheck.checked;
   }
};

pInsetDialogUI.prototype.getParams = function() {
   return this.params;
};

pInsetDialogUI.prototype.getTargetView = function() {
   return this.targetView;
};

pInsetDialogUI.prototype.getMode = function() {
   return this.modeCombo.currentItem === 0 ? "Extract" : "Finalize";
};

pInsetDialogUI.prototype.updateModeVisibility = function(modeIndex) {
   // Reset internal state when switching modes
   this.hasDrawnRegion = false;
   this.targetView = null;
   this.previewBitmap = null;
   this.finalizeSourceView = null;
   this.finalizeInsetView = null;
   this.isPreviewMode = false;
   this.zoomedPreviewBitmap = null;
   
   // Reset finalize inset state
   this.insetBitmap = null;
   this.insetX = 0;
   this.insetY = 0;
   this.insetWidth = 100;
   this.insetHeight = 100;
   this.finalizeInteractionMode = null;
   this.finalizeZoom = 1.0;
   this.finalizePanX = 0;
   this.finalizePanY = 0;
   
   // Reset source anchor positions to defaults
   this.sourceAnchors = {
      leftAngle: Math.PI,
      rightAngle: 0
   };

   
   // Regenerate ViewLists and clear selection
   if (this.imageList) {
      this.imageList.getMainViews();
      this.imageList.remove(this.imageList.currentView); // Clear selection
   }
   if (this.finalizeSourceList) {
      this.finalizeSourceList.getMainViews();
      this.finalizeSourceList.remove(this.finalizeSourceList.currentView); // Clear selection
   }
   if (this.finalizeInsetList) {
      this.finalizeInsetList.getMainViews();
      this.finalizeInsetList.remove(this.finalizeInsetList.currentView); // Clear selection
      this.finalizeInsetList.enabled = false; // Reset to disabled
   }
   if (this.finalizeInsetLabel) {
      this.finalizeInsetLabel.enabled = false;
   }
   
   // modeIndex: 0 = Extract, 1 = Finalize
   if (modeIndex === 0) {
      // Extract mode - show extract controls
      this.imageLabel.visible = true;
      this.imageList.visible = true;
      this.extractGroup.visible = true;
      this.previewButton.visible = true;
      this.extractButton.visible = true;
      // Hide finalize controls
      this.finalizeSourceLabel.visible = false;
      this.finalizeSourceList.visible = false;
      this.finalizeInsetLabel.visible = false;
      this.finalizeInsetList.visible = false;
      this.finalizeGroup.visible = false;
      if (this.generateButton) this.generateButton.visible = false;
      // Toggle preview controls
      this.extractPreviewControl.visible = true;
      this.finalizePreviewControl.visible = false;
      // Repaint extract preview
      this.extractPreviewControl.repaint();
   } else {
      // Finalize mode - hide extract controls
      this.imageLabel.visible = false;
      this.imageList.visible = false;
      this.extractGroup.visible = false;
      this.previewButton.visible = false;
      this.extractButton.visible = false;
      // Show finalize controls
      this.finalizeSourceLabel.visible = true;
      this.finalizeSourceList.visible = true;
      this.finalizeInsetLabel.visible = true;
      this.finalizeInsetList.visible = true;
      this.finalizeGroup.visible = true;
      if (this.generateButton) this.generateButton.visible = true;
      // Toggle preview controls
      this.extractPreviewControl.visible = false;
      this.finalizePreviewControl.visible = true;
      // Repaint finalize preview
      this.finalizePreviewControl.repaint();
      // Check if options should be enabled
      this.checkFinalizeImagesSelected();
   }
   
   // Adjust dialog to new content
   this.adjustToContents();
};

/**
 * Check if both finalize images are selected and enable/disable options group.
 * Delegates to FinalizePanel function.
 */
pInsetDialogUI.prototype.checkFinalizeImagesSelected = function() {
   checkFinalizeImagesSelected(this);
};

/**
 * Read extraction metadata from a view's FITS keywords.
 * Delegates to FinalizePanel function.
 * @param {View} view - The extracted image view
 */
pInsetDialogUI.prototype.readExtractionMetadata = function(view) {
   readExtractionMetadata(this, view);
};

/**
 * Update preview for Finalize mode using source image.
 * Delegates to FinalizePanel function.
 */
pInsetDialogUI.prototype.updateFinalizePreview = function() {
   updateFinalizePreview(this);
};

/**
 * Toggle between normal view and zoomed preview mode.
 * Delegates to ExtractPanel function.
 */
pInsetDialogUI.prototype.togglePreviewMode = function() {
   toggleExtractPreviewMode(this);
};

/**
 * Create a zoomed preview bitmap from the selected region.
 * Delegates to ExtractPanel function.
 */
pInsetDialogUI.prototype.createZoomedPreviewBitmap = function() {
   createZoomedPreviewBitmap(this);
};

/**
 * Update zoom control's max value based on region size.
 * Delegates to ExtractPanel function.
 */
pInsetDialogUI.prototype.updateZoomLimit = function() {
   updateZoomLimit(this);
};

/**
 * Extract the selected region to a new image window.
 * Delegates to ExtractPanel function.
 */
pInsetDialogUI.prototype.extractRegionToNewImage = function() {
   extractRegionToNewImage(this);
};

