// ----------------------------------------------------------------------------
// pInset - Create Image Insets for PixInsight
// ----------------------------------------------------------------------------
//
// A script to create zoomed inset overlays on astronomical images,
// replicating the Photoshop inset technique for PixInsight.
//
// Author: Giovanni Rocca (iGio90) and Antigravity
// ----------------------------------------------------------------------------

#feature-id   Utilities > pInset
#feature-info Create zoomed inset overlays on astronomical images. \
              Select a region of interest, scale it up, and composite it \
              onto the original image with customizable borders and positioning.
#feature-icon pInset.xpm

#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/ColorSpace.jsh>
#include <pjsr/UndoFlag.jsh>

// Include pInset modules
#include "lib/InsetEngine.js"
#include "lib/InsetDialog.js"

#define VERSION "1.0.0"
#define TITLE   "pInset"

/**
 * Main entry point for the pInset script.
 * Orchestrates the dialog display and execution flow.
 */
function main() {
   console.writeln("<b>pInset v" + VERSION + "</b>");
   console.writeln("Creating image inset...");

   // Create the dialog using the library
   var dialog = new pInsetDialogUI();
   
   // Execute dialog and check if user clicked OK
   if (dialog.execute()) {
      // User clicked OK
      // Only run full inset workflow in Finalize mode
      if (dialog.getMode() === "Finalize") {
         executeInset(dialog);
      } else {
         console.writeln("pInset: Extraction complete");
      }
   } else {
      console.writeln("pInset: Cancelled by user");
   }

   console.writeln("pInset: Done");
}

/**
 * Execute the inset creation using dialog parameters.
 * @param {pInsetDialogUI} dialog - The configured dialog instance
 */
function executeInset(dialog) {
   var params = dialog.getParams();
   var targetView = dialog.getTargetView();
   
   if (!targetView || targetView.isNull) {
      console.writeln("pInset Error: No target view selected");
      return;
   }
   
   console.writeln("Processing image: " + targetView.id);
   
   // Create engine instance
   var engine = new InsetEngine();
   
   // Get image reference
   var image = targetView.image;
   
   // Build source region rectangle
   var sourceRect = new Rect(
      params.regionX,
      params.regionY,
      params.regionX + params.regionWidth,
      params.regionY + params.regionHeight
   );
   
   console.writeln("Source region: " + sourceRect.x0 + ", " + sourceRect.y0 + 
                   " - " + sourceRect.width + "x" + sourceRect.height);
   
   try {
      // Step 3: Extract region
      var extractedData;
      if (params.insetShape === "Circular") {
         var center = new Point(
            params.regionX + params.regionWidth / 2,
            params.regionY + params.regionHeight / 2
         );
         extractedData = engine.extractCircularRegion(image, center, params.regionWidth);
      } else {
         extractedData = engine.extractRegion(image, sourceRect);
      }
      console.writeln("Extracted region: " + extractedData.width + "x" + extractedData.height);
      
      // Step 4: Scale the extracted region
      var scaledWidth = Math.round(extractedData.width * params.zoomFactor);
      var scaledHeight = Math.round(extractedData.height * params.zoomFactor);
      var scaledData = engine.scalePixels(extractedData, scaledWidth, scaledHeight);
      console.writeln("Scaled to: " + scaledData.width + "x" + scaledData.height);
      
      // Step 5: Add border
      var borderColor = {
         r: params.borderColorR / 255.0,
         g: params.borderColorG / 255.0,
         b: params.borderColorB / 255.0
      };
      var borderedData = engine.addBorder(scaledData, params.borderWidth, borderColor);
      console.writeln("With border: " + borderedData.width + "x" + borderedData.height);
      
      // Step 6: Calculate position
      var customPos = {x: params.customX, y: params.customY};
      var position = engine.calculatePosition(
         image.width, image.height,
         borderedData.width, borderedData.height,
         params.positionPreset, params.margin, customPos
      );
      console.writeln("Position: " + position.x + ", " + position.y);
      
      // Step 7: Composite onto original (with undo support)
      targetView.beginProcess(UndoFlag_NoSwapFile);
      
      engine.compositeInset(image, borderedData, position);
      
      // Step 8: Draw connection line if requested
      if (params.drawConnectionLine) {
         var insetRect = new Rect(
            position.x, position.y,
            position.x + borderedData.width,
            position.y + borderedData.height
         );
         engine.drawConnectionLine(image, sourceRect, insetRect, borderColor, params.borderWidth);
         console.writeln("Drew connection line");
      }
      
      // Step 10: Draw source region indicator if requested
      if (params.drawSourceIndicator) {
         engine.drawSourceIndicator(image, sourceRect, borderColor, params.borderWidth);
         console.writeln("Drew source indicator");
      }
      
      targetView.endProcess();
      
      console.writeln("<b>Inset created successfully!</b>");
      
   } catch (error) {
      console.writeln("<b>pInset Error:</b> " + error.message);
      var msgBox = new MessageBox(
         "Error creating inset:\n\n" + error.message,
         TITLE,
         StdIcon_Error,
         StdButton_Ok
      );
      msgBox.execute();
   }
}

// Run the main function
main();
