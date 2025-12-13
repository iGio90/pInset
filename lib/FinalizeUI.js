// ----------------------------------------------------------------------------
// FinalizeUI.js - UI Control Creation for Finalize Mode
// ----------------------------------------------------------------------------
//
// Author: Giovanni Rocca (iGio90) and Antigravity
//
// ----------------------------------------------------------------------------

/**
 * Create Finalize mode controls.
 * @param {Dialog} dialog - Parent dialog
 * @param {Object} params - Parameters object
 * @param {Number} labelWidth - Width for label alignment
 * @param {Control} parent - Parent control
 * @returns {Object} Object containing all finalize mode controls
 */
function createFinalizeControls(dialog, params, labelWidth, parent) {
   var result = {};
   
   // -------------------------------------------------------------------------
   // Image Selection (outside group box)
   // -------------------------------------------------------------------------
   
   result.sourceLabel = new Label(parent);
   result.sourceLabel.text = "Source Image:";
   result.sourceLabel.textAlignment = TextAlign_Left;
   result.sourceLabel.visible = false;
   dialog.finalizeSourceLabel = result.sourceLabel;
   
   result.sourceList = new ViewList(parent);
   result.sourceList.getMainViews();
   result.sourceList.visible = false;
   result.sourceList.onViewSelected = function(view) {
      dialog.finalizeSourceView = view;
      // Enable inset image selection when source is selected
      var hasSource = view && !view.isNull;
      dialog.finalizeInsetLabel.enabled = hasSource;
      dialog.finalizeInsetList.enabled = hasSource;
      dialog.checkFinalizeImagesSelected();
      dialog.updateFinalizePreview();
   };
   dialog.finalizeSourceList = result.sourceList;
   
   result.insetLabel = new Label(parent);
   result.insetLabel.text = "Inset Image:";
   result.insetLabel.textAlignment = TextAlign_Left;
   result.insetLabel.visible = false;
   result.insetLabel.enabled = false; // Disabled until source is selected
   dialog.finalizeInsetLabel = result.insetLabel;
   
   result.insetList = new ViewList(parent);
   result.insetList.getMainViews();
   result.insetList.visible = false;
   result.insetList.enabled = false; // Disabled until source is selected
   result.insetList.onViewSelected = function(view) {
      dialog.finalizeInsetView = view;
      // Clear existing inset bitmap so it gets recreated with the new image
      dialog.insetBitmap = null;
      dialog.readExtractionMetadata(view);
      dialog.checkFinalizeImagesSelected();
      dialog.updateFinalizePreview();
   };
   dialog.finalizeInsetList = result.insetList;
   
   // -------------------------------------------------------------------------
   // Options Group (disabled by default)
   // -------------------------------------------------------------------------
   
   result.group = new GroupBox(parent);
   result.group.title = "Options";
   result.group.visible = false;
   result.group.enabled = false; // Disabled until both images selected
   dialog.finalizeGroup = result.group;
   
   // =========================================================================
   // INDICATOR BORDER CONTROLS (extraction region outline)
   // =========================================================================
   
   var indicatorHeader = new Label(result.group);
   indicatorHeader.text = "Border Settings:";
   indicatorHeader.textAlignment = TextAlign_Left;
   
   // Indicator border width
   var indBorderLabel = new Label(result.group);
   indBorderLabel.text = "Width:";
   indBorderLabel.setFixedWidth(labelWidth);
   indBorderLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   dialog.indicatorBorderSlider = new Slider(result.group);
   dialog.indicatorBorderSlider.setRange(1, 200);
   dialog.indicatorBorderSlider.value = params.indicatorBorderWidth || 2;
   dialog.indicatorBorderSlider.setMinWidth(100);
   dialog.indicatorBorderSlider.onValueUpdated = function(value) {
      params.indicatorBorderWidth = value;
      dialog.indicatorBorderValue.text = value.toString() + " px";
      if (dialog.finalizePreviewControl) dialog.finalizePreviewControl.repaint();
   };
   
   dialog.indicatorBorderValue = new Label(result.group);
   dialog.indicatorBorderValue.text = (params.indicatorBorderWidth || 2).toString() + " px";
   dialog.indicatorBorderValue.setFixedWidth(40);
   
   // Indicator color swatch
   dialog.indicatorSwatch = new Control(result.group);
   dialog.indicatorSwatch.setFixedSize(24, 18);
   dialog.indicatorSwatch.onPaint = function() {
      var g = new Graphics(this);
      var r = (params.indicatorColorR !== undefined) ? params.indicatorColorR : 255;
      var green = (params.indicatorColorG !== undefined) ? params.indicatorColorG : 255;
      var b = (params.indicatorColorB !== undefined) ? params.indicatorColorB : 0;
      var color = (0xFF << 24) | (r << 16) | (green << 8) | b;
      g.fillRect(0, 0, this.width, this.height, new Brush(color));
      g.pen = new Pen(0xFF000000, 1);
      g.strokeRect(0, 0, this.width - 1, this.height - 1);
      g.end();
   };
   
   // Indicator RGB sliders
   var updateIndicatorColor = function() {
      dialog.indicatorSwatch.repaint();
      if (dialog.finalizePreviewControl) dialog.finalizePreviewControl.repaint();
   };
   
   dialog.indicatorR = new Slider(result.group);
   dialog.indicatorR.setRange(0, 255);
   dialog.indicatorR.value = params.indicatorColorR || 255;
   dialog.indicatorR.setMinWidth(50);
   
   dialog.indicatorG = new Slider(result.group);
   dialog.indicatorG.setRange(0, 255);
   dialog.indicatorG.value = params.indicatorColorG || 255;
   dialog.indicatorG.setMinWidth(50);
   
   dialog.indicatorB = new Slider(result.group);
   dialog.indicatorB.setRange(0, 255);
   dialog.indicatorB.value = params.indicatorColorB || 0;
   dialog.indicatorB.setMinWidth(50);
   
   dialog.indicatorR.onValueUpdated = function(value) {
      params.indicatorColorR = value;
      updateIndicatorColor();
   };
   dialog.indicatorG.onValueUpdated = function(value) {
      params.indicatorColorG = value;
      updateIndicatorColor();
   };
   dialog.indicatorB.onValueUpdated = function(value) {
      params.indicatorColorB = value;
      updateIndicatorColor();
   };
   
   var indBorderRow = new HorizontalSizer;
   indBorderRow.spacing = 4;
   indBorderRow.add(indBorderLabel);
   indBorderRow.add(dialog.indicatorBorderSlider);
   indBorderRow.add(dialog.indicatorBorderValue);
   indBorderRow.add(dialog.indicatorSwatch);
   
   var indColorRow = new HorizontalSizer;
   indColorRow.spacing = 4;
   indColorRow.addSpacing(labelWidth);
   var indRLabel = new Label(result.group); indRLabel.text = "R:"; indRLabel.setFixedWidth(15);
   indColorRow.add(indRLabel);
   indColorRow.add(dialog.indicatorR, 50);
   var indGLabel = new Label(result.group); indGLabel.text = "G:"; indGLabel.setFixedWidth(15);
   indColorRow.add(indGLabel);
   indColorRow.add(dialog.indicatorG, 50);
   var indBLabel = new Label(result.group); indBLabel.text = "B:"; indBLabel.setFixedWidth(15);
   indColorRow.add(indBLabel);
   indColorRow.add(dialog.indicatorB, 50);
   
   // Indicator opacity slider
   var indOpacityLabel = new Label(result.group);
   indOpacityLabel.text = "Opacity:";
   indOpacityLabel.setFixedWidth(labelWidth);
   indOpacityLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   dialog.indicatorOpacitySlider = new Slider(result.group);
   dialog.indicatorOpacitySlider.setRange(0, 100);
   dialog.indicatorOpacitySlider.value = params.indicatorOpacity || 100;
   dialog.indicatorOpacitySlider.setMinWidth(100);
   dialog.indicatorOpacitySlider.onValueUpdated = function(value) {
      params.indicatorOpacity = value;
      dialog.indicatorOpacityValue.text = value.toString() + "%";
      if (dialog.finalizePreviewControl) dialog.finalizePreviewControl.repaint();
   };
   
   dialog.indicatorOpacityValue = new Label(result.group);
   dialog.indicatorOpacityValue.text = (params.indicatorOpacity || 100).toString() + "%";
   dialog.indicatorOpacityValue.setFixedWidth(40);
   
   var indOpacityRow = new HorizontalSizer;
   indOpacityRow.spacing = 4;
   indOpacityRow.add(indOpacityLabel);
   indOpacityRow.add(dialog.indicatorOpacitySlider);
   indOpacityRow.add(dialog.indicatorOpacityValue);
   

   
   // =========================================================================
   // OTHER OPTIONS
   // =========================================================================
   
   dialog.drawLineCheck = new CheckBox(result.group);
   dialog.drawLineCheck.text = "Draw connection line";
   dialog.drawLineCheck.checked = params.drawConnectionLine !== false;
   dialog.drawLineCheck.onCheck = function(checked) {
      params.drawConnectionLine = checked;
      if (dialog.finalizePreviewControl) dialog.finalizePreviewControl.repaint();
   };

   dialog.applyOpacityCheck = new CheckBox(result.group);
   dialog.applyOpacityCheck.text = "Apply opacity to inset image";
   dialog.applyOpacityCheck.checked = params.applyOpacityToImage === true;
   dialog.applyOpacityCheck.onCheck = function(checked) {
      params.applyOpacityToImage = checked;
      // No reprint needed strictly for generation, but good for preview if we support it
      if (dialog.finalizePreviewControl) dialog.finalizePreviewControl.repaint();
   };
   
   // Zoom controls
   var zoomLabel = new Label(result.group);
   zoomLabel.text = "Preview:";
   zoomLabel.setFixedWidth(labelWidth);
   zoomLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   dialog.zoomOutButton = new ToolButton(result.group);
   dialog.zoomOutButton.icon = dialog.scaledResource(":/icons/zoom-out.png");
   dialog.zoomOutButton.setScaledFixedSize(24, 24);
   dialog.zoomOutButton.toolTip = "Zoom out (scroll wheel down)";
   dialog.zoomOutButton.onClick = function() {
      dialog.finalizeZoom = Math.max(0.2, dialog.finalizeZoom - 0.1);
      if (dialog.finalizePreviewControl) {
         dialog.finalizePreviewControl.repaint();
      }
   };
   
   dialog.zoomInButton = new ToolButton(result.group);
   dialog.zoomInButton.icon = dialog.scaledResource(":/icons/zoom-in.png");
   dialog.zoomInButton.setScaledFixedSize(24, 24);
   dialog.zoomInButton.toolTip = "Zoom in (scroll wheel up)";
   dialog.zoomInButton.onClick = function() {
      dialog.finalizeZoom = Math.min(2.0, dialog.finalizeZoom + 0.1);
      if (dialog.finalizePreviewControl) {
         dialog.finalizePreviewControl.repaint();
      }
   };
   
   dialog.zoomResetButton = new ToolButton(result.group);
   dialog.zoomResetButton.icon = dialog.scaledResource(":/icons/zoom-1-1.png");
   dialog.zoomResetButton.setScaledFixedSize(24, 24);
   dialog.zoomResetButton.toolTip = "Reset zoom and pan";
   dialog.zoomResetButton.onClick = function() {
      dialog.finalizeZoom = 1.0;
      dialog.finalizePanX = 0;
      dialog.finalizePanY = 0;
      if (dialog.finalizePreviewControl) {
         dialog.finalizePreviewControl.repaint();
      }
   };
   
   var zoomRow = new HorizontalSizer;
   zoomRow.spacing = 4;
   zoomRow.add(zoomLabel);
   zoomRow.add(dialog.zoomOutButton);
   zoomRow.add(dialog.zoomInButton);
   zoomRow.add(dialog.zoomResetButton);
   zoomRow.addStretch();
   
   // Group sizer
   var sizer = new VerticalSizer;
   sizer.margin = 6;
   sizer.spacing = 4;
   sizer.add(indicatorHeader);
   sizer.add(indBorderRow);
   sizer.add(indColorRow);
   sizer.add(indOpacityRow);
   sizer.addSpacing(8);
   sizer.add(dialog.drawLineCheck);
   sizer.add(dialog.applyOpacityCheck);
   sizer.addSpacing(8);
   sizer.add(zoomRow);
   
   result.group.sizer = sizer;

   
   // =========================================================================
   // GENERATE BUTTON (outside the group, but follows same enabled state)
   // =========================================================================
   
   result.generateButton = new PushButton(parent);
   result.generateButton.text = "Generate";
   result.generateButton.icon = dialog.scaledResource(":/icons/ok.png");
   result.generateButton.visible = false;
   result.generateButton.enabled = false; // Disabled until both images selected
   result.generateButton.onClick = function() {
      // Execute the inset generation
      if (dialog.onGenerate) {
         dialog.onGenerate();
      }
   };
   dialog.generateButton = result.generateButton;
   
   return result;
}
