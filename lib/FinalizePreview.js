// ----------------------------------------------------------------------------
// FinalizePreview.js - Preview Rendering & Interaction for Finalize Mode
// ----------------------------------------------------------------------------
//
// Author: Giovanni Rocca (iGio90) and Antigravity
//
// ----------------------------------------------------------------------------

/**
 * Draw overlay for Finalize mode - extraction region and moveable inset image.
 * @param {Dialog} dialog - The parent dialog
 * @param {Graphics} g - Graphics context
 * @param {Number} offsetX - X offset for preview positioning
 * @param {Number} offsetY - Y offset for preview positioning
 * @param {Number} zoom - Optional zoom factor (default 1.0)
 */
function drawFinalizeOverlay(dialog, g, offsetX, offsetY, zoom) {
   zoom = zoom || 1.0;
   var effectiveScale = dialog.previewScale * zoom;
   
   // Enable antialiasing
   g.antialiasing = true;
   
   var params = dialog.params;
   
   // Build indicator border color from RGB and opacity components
   var indBorderWidth = (params.indicatorBorderWidth !== undefined) ? params.indicatorBorderWidth : 2;
   var indR = (params.indicatorColorR !== undefined) ? params.indicatorColorR : 255;
   var indG = (params.indicatorColorG !== undefined) ? params.indicatorColorG : 255;
   var indB = (params.indicatorColorB !== undefined) ? params.indicatorColorB : 0;
   var indOpacity = (params.indicatorOpacity !== undefined) ? params.indicatorOpacity : 100;
   var indAlpha = Math.round(indOpacity * 255 / 100);
   var indicatorColor = (indAlpha << 24) | (indR << 16) | (indG << 8) | indB;
   
   var indicatorColor = (indAlpha << 24) | (indR << 16) | (indG << 8) | indB;
   
   // Use same settings for inset border
   var insBorderWidth = indBorderWidth;
   var insetColor = indicatorColor;
   
   var isCircularInset = params.insetShape === "Circular";
   
   // Scale border widths for preview
   var scaledIndBorderW = Math.max(1, indBorderWidth * effectiveScale);
   var scaledInsBorderW = Math.max(1, isCircularInset ? insBorderWidth * effectiveScale : insBorderWidth * effectiveScale); // Same logic
   
   // Draw extraction region indicator (the source region on the image)
   var px, py, pw, ph;
   if (dialog.hasDrawnRegion) {
      px = params.regionX * effectiveScale + offsetX;
      py = params.regionY * effectiveScale + offsetY;
      pw = params.regionWidth * effectiveScale;
      ph = params.regionHeight * effectiveScale;
      
      if (isCircularInset) {
         var cx = px + pw / 2;
         var cy = py + ph / 2;
         var radius = Math.min(pw, ph) / 2;
         
         g.pen = new Pen(indicatorColor, scaledIndBorderW);
         g.strokeCircle(cx, cy, radius);
         
         // Draw anchor handles for connection lines (circular shapes)
         // These are at the positions where connection lines attach
         var hs = 6; // Handle visual size
         var leftAngle = dialog.sourceAnchors.leftAngle;
         var rightAngle = dialog.sourceAnchors.rightAngle;
         
         // Calculate handle positions
         var leftHandleX = cx + Math.cos(leftAngle) * radius;
         var leftHandleY = cy + Math.sin(leftAngle) * radius;
         var rightHandleX = cx + Math.cos(rightAngle) * radius;
         var rightHandleY = cy + Math.sin(rightAngle) * radius;
         
         // Draw handles with distinct style (filled with indicator color, white border)
         g.pen = new Pen(0xFFFFFFFF, 1);
         g.brush = new Brush(indicatorColor);
         
         // Left anchor handle
         g.fillRect(leftHandleX - hs, leftHandleY - hs, leftHandleX + hs, leftHandleY + hs);
         g.strokeRect(leftHandleX - hs, leftHandleY - hs, leftHandleX + hs, leftHandleY + hs);
         
         // Right anchor handle
         g.fillRect(rightHandleX - hs, rightHandleY - hs, rightHandleX + hs, rightHandleY + hs);
         g.strokeRect(rightHandleX - hs, rightHandleY - hs, rightHandleX + hs, rightHandleY + hs);
      } else {
         g.pen = new Pen(indicatorColor, scaledIndBorderW);
         g.strokeRect(px, py, px + pw, py + ph);
      }
   }
   
   // Draw the inset image with border and handles
   if (dialog.insetBitmap) {
      var ix = dialog.insetX * effectiveScale + offsetX;
      var iy = dialog.insetY * effectiveScale + offsetY;
      var iw = dialog.insetWidth * effectiveScale;
      var ih = dialog.insetHeight * effectiveScale;
      

      // Draw connection lines FIRST (before inset) so they appear behind the inset image
      if (params.drawConnectionLine !== false && dialog.hasDrawnRegion) {
         // Coordinates px, py, pw, ph are already calculated above
         
         g.pen = new Pen(indicatorColor, scaledIndBorderW);
         
         // Calculate thickness-based offset (matches engine logic for internal border)
         // scaledIndBorderW is the effective thickness of the connection line
         var offset = Math.floor(scaledIndBorderW / 2);
         
         if (isCircularInset) {
            // For circular shapes, connect with 2 tangent lines using custom anchor angles
            var indCx = px + pw / 2;
            var indCy = py + ph / 2;
            var indR = Math.min(pw, ph) / 2;
            
            var insCx = ix + iw / 2;
            var insCy = iy + ih / 2;
            // Reduce inset radius by offset to pull connection points inside
            var insR = Math.max(1, Math.min(iw, ih) / 2 - offset);
            
             // Use custom anchor angles from dialog.sourceAnchors
             var leftAngle = dialog.sourceAnchors.leftAngle;
             var rightAngle = dialog.sourceAnchors.rightAngle;
             
             // Source anchor positions (calculated from angles)
             var srcLeftX = indCx + Math.cos(leftAngle) * indR;
             var srcLeftY = indCy + Math.sin(leftAngle) * indR;
             var srcRightX = indCx + Math.cos(rightAngle) * indR;
             var srcRightY = indCy + Math.sin(rightAngle) * indR;
             
             // Inset Left/Right (using reduced radius to hide line ends)
             // Use same angles for inset side to maintain parallel lines
             var insLeftX = insCx + Math.cos(leftAngle) * insR;
             var insLeftY = insCy + Math.sin(leftAngle) * insR;
             var insRightX = insCx + Math.cos(rightAngle) * insR;
             var insRightY = insCy + Math.sin(rightAngle) * insR;
             
             g.drawLine(srcLeftX, srcLeftY, insLeftX, insLeftY);
             g.drawLine(srcRightX, srcRightY, insRightX, insRightY);
         } else {
            // For rectangular shapes, connect all 4 corresponding corners
            // Apply offset to inset coordinates (move them inside the border)
            
            // NW to NW
            g.drawLine(px, py, ix + offset, iy + offset);
            // NE to NE
            g.drawLine(px + pw, py, ix + iw - offset, iy + offset);
            // SW to SW
            g.drawLine(px, py + ph, ix + offset, iy + ih - offset);
            // SE to SE
            g.drawLine(px + pw, py + ph, ix + iw - offset, iy + ih - offset);
         }
      }
      
      // Now draw the inset image (on top of connection lines)
      if (zoom !== 1.0) {
         var scaledInset = dialog.insetBitmap.scaled(zoom);
         g.drawBitmap(ix, iy, scaledInset);
      } else {
         g.drawBitmap(ix, iy, dialog.insetBitmap);
      }
      
      var hs = 6; // Handle visual size
      
      if (isCircularInset) {
         // Draw circular border - adjusted to be internal
         var centerX = ix + iw / 2;
         var centerY = iy + ih / 2;
         var radius = Math.min(iw, ih) / 2 - scaledInsBorderW / 2;
         
         g.pen = new Pen(insetColor, scaledInsBorderW);
         if (radius > 0) g.strokeCircle(centerX, centerY, radius);
         
         // Draw handles at cardinal points (top, bottom, left, right)
         g.pen = new Pen(0xFFFFFFFF, 1);
         g.brush = new Brush(insetColor);
         
         // Top (N)
         g.fillRect(centerX - hs, centerY - radius - hs, centerX + hs, centerY - radius + hs);
         g.strokeRect(centerX - hs, centerY - radius - hs, centerX + hs, centerY - radius + hs);
         
         // Bottom (S)
         g.fillRect(centerX - hs, centerY + radius - hs, centerX + hs, centerY + radius + hs);
         g.strokeRect(centerX - hs, centerY + radius - hs, centerX + hs, centerY + radius + hs);
         
         // Left (W)
         g.fillRect(centerX - radius - hs, centerY - hs, centerX - radius + hs, centerY + hs);
         g.strokeRect(centerX - radius - hs, centerY - hs, centerX - radius + hs, centerY + hs);
         
         // Right (E)
         g.fillRect(centerX + radius - hs, centerY - hs, centerX + radius + hs, centerY + hs);
         g.strokeRect(centerX + radius - hs, centerY - hs, centerX + radius + hs, centerY + hs);
      } else {
         // Draw rectangular border - adjusted to be internal
         g.pen = new Pen(insetColor, scaledInsBorderW);
         var halfB = scaledInsBorderW / 2;
         g.strokeRect(ix + halfB, iy + halfB, ix + iw - halfB, iy + ih - halfB);
         
         // Draw corner handles
         g.pen = new Pen(0xFFFFFFFF, 1);
         g.brush = new Brush(insetColor);
         
         // NW corner
         g.fillRect(ix - hs, iy - hs, ix + hs, iy + hs);
         g.strokeRect(ix - hs, iy - hs, ix + hs, iy + hs);
         
         // NE corner
         g.fillRect(ix + iw - hs, iy - hs, ix + iw + hs, iy + hs);
         g.strokeRect(ix + iw - hs, iy - hs, ix + iw + hs, iy + hs);
         
         // SW corner
         g.fillRect(ix - hs, iy + ih - hs, ix + hs, iy + ih + hs);
         g.strokeRect(ix - hs, iy + ih - hs, ix + hs, iy + ih + hs);
         
         // SE corner
         g.fillRect(ix + iw - hs, iy + ih - hs, ix + iw + hs, iy + ih + hs);
         g.strokeRect(ix + iw - hs, iy + ih - hs, ix + iw + hs, iy + ih + hs);
      }
      
      // Draw dimensions text
      g.pen = new Pen(0xFFFFFFFF);
      g.drawText(ix + 4, iy + ih + 14, 
         Math.round(dialog.insetWidth) + " x " + Math.round(dialog.insetHeight));
   }
}

/**
 * Create a scaled bitmap of the inset image for preview display.
 * @param {Dialog} dialog - The parent dialog
 */
function createInsetBitmap(dialog) {
   if (!dialog.finalizeInsetView || dialog.finalizeInsetView.isNull) {
      dialog.insetBitmap = null;
      return;
   }
   
   var image = dialog.finalizeInsetView.image;
   
   // Calculate the display size based on preview scale
   var displayW = Math.round(dialog.insetWidth * dialog.previewScale);
   var displayH = Math.round(dialog.insetHeight * dialog.previewScale);
   
   // Minimum display size
   displayW = Math.max(20, displayW);
   displayH = Math.max(20, displayH);
   
   try {
      // Render and scale the image (no beginProcess needed for reading)
      var fullBitmap = image.render();
      dialog.insetBitmap = fullBitmap.scaledTo(displayW, displayH);
      
      // If circular, apply alpha mask to hide corners (since extracted image is now black square)
      if (dialog.params.insetShape === "Circular") {
         var cx = displayW / 2;
         var cy = displayH / 2;
         // Use slightly smaller radius to avoid black fringe (inset border will cover the edge)
         var radius = Math.min(displayW, displayH) / 2 - 1.0;
         
         for (var y = 0; y < displayH; y++) {
            for (var x = 0; x < displayW; x++) {
               var dx = x - cx;
               var dy = y - cy;
               var dist = Math.sqrt(dx * dx + dy * dy);
               
               if (dist > radius) {
                   // Set pure transparent
                   dialog.insetBitmap.setPixel(x, y, 0x00000000);
               }
            }
         }
      }
   } catch (e) {
      console.writeln("pInset: Error creating inset bitmap - " + e.message);
      dialog.insetBitmap = null;
   }
}

/**
 * Hit test for the inset shape in finalize mode.
 * @param {Dialog} dialog - The parent dialog
 * @param {Number} px - X position in preview coordinates
 * @param {Number} py - Y position in preview coordinates
 * @param {Number} zoom - Optional zoom factor (default 1.0)
 * @returns {Object} { handle: "nw"|"ne"|"sw"|"se"|null, inside: boolean }
 */
function hitTestInset(dialog, px, py, zoom) {
   if (!dialog.insetBitmap) return { handle: null, inside: false };
   
   zoom = zoom || 1.0;
   var effectiveScale = dialog.previewScale * zoom;
   
   // Get inset bounds in preview coordinates
   var x0 = dialog.insetX * effectiveScale;
   var y0 = dialog.insetY * effectiveScale;
   var iw = dialog.insetWidth * effectiveScale;
   var ih = dialog.insetHeight * effectiveScale;
   var x1 = x0 + iw;
   var y1 = y0 + ih;
   
   var hs = dialog.handleSize;
   var isCircular = dialog.params.insetShape === "Circular";
   
   if (isCircular) {
      // For circular: handles at cardinal points
      var centerX = x0 + iw / 2;
      var centerY = y0 + ih / 2;
      var radius = Math.min(iw, ih) / 2;
      
      // Larger hit area for circular handles (they're harder to hit)
      var circleHs = 15;
      
      // North (top) - handle centered at circle's top edge
      if (px >= centerX - circleHs && px <= centerX + circleHs && 
          py >= centerY - radius - circleHs && py <= centerY - radius + circleHs) {
         return { handle: "n", inside: false };
      }
      // South (bottom)
      if (px >= centerX - circleHs && px <= centerX + circleHs && 
          py >= centerY + radius - circleHs && py <= centerY + radius + circleHs) {
         return { handle: "s", inside: false };
      }
      // West (left)
      if (px >= centerX - radius - circleHs && px <= centerX - radius + circleHs && 
          py >= centerY - circleHs && py <= centerY + circleHs) {
         return { handle: "w", inside: false };
      }
      // East (right)
      if (px >= centerX + radius - circleHs && px <= centerX + radius + circleHs && 
          py >= centerY - circleHs && py <= centerY + circleHs) {
         return { handle: "e", inside: false };
      }
      
      // Check if inside the circle
      var dx = px - centerX;
      var dy = py - centerY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
         return { handle: null, inside: true };
      }
   } else {
      // For rectangular: handles at corners
      if (px >= x0 - hs && px <= x0 + hs && py >= y0 - hs && py <= y0 + hs) {
         return { handle: "nw", inside: false };
      }
      if (px >= x1 - hs && px <= x1 + hs && py >= y0 - hs && py <= y0 + hs) {
         return { handle: "ne", inside: false };
      }
      if (px >= x0 - hs && px <= x0 + hs && py >= y1 - hs && py <= y1 + hs) {
         return { handle: "sw", inside: false };
      }
      if (px >= x1 - hs && px <= x1 + hs && py >= y1 - hs && py <= y1 + hs) {
         return { handle: "se", inside: false };
      }
      
      // Check if inside the rectangle
      if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
         return { handle: null, inside: true };
      }
   }
   
   return { handle: null, inside: false };
}

/**
 * Hit test for source region anchor handles (connection line endpoints).
 * @param {Dialog} dialog - The parent dialog
 * @param {Number} px - X position in preview coordinates (relative to image origin)
 * @param {Number} py - Y position in preview coordinates (relative to image origin)
 * @param {Number} zoom - Optional zoom factor (default 1.0)
 * @returns {Object} { anchor: "left"|"right"|null }
 */
function hitTestSourceAnchors(dialog, px, py, zoom) {
   if (!dialog.hasDrawnRegion) return { anchor: null };
   if (dialog.params.insetShape !== "Circular") return { anchor: null };
   
   zoom = zoom || 1.0;
   var effectiveScale = dialog.previewScale * zoom;
   
   // Get source region bounds in preview coordinates
   var params = dialog.params;
   var rx = params.regionX * effectiveScale;
   var ry = params.regionY * effectiveScale;
   var rw = params.regionWidth * effectiveScale;
   var rh = params.regionHeight * effectiveScale;
   
   var cx = rx + rw / 2;
   var cy = ry + rh / 2;
   var radius = Math.min(rw, rh) / 2;
   
   // Calculate anchor positions from angles
   var leftAngle = dialog.sourceAnchors.leftAngle;
   var rightAngle = dialog.sourceAnchors.rightAngle;
   
   var leftHandleX = cx + Math.cos(leftAngle) * radius;
   var leftHandleY = cy + Math.sin(leftAngle) * radius;
   var rightHandleX = cx + Math.cos(rightAngle) * radius;
   var rightHandleY = cy + Math.sin(rightAngle) * radius;
   
   // Hit test with larger area for easier clicking
   var hitRadius = 15;
   
   // Check left anchor
   var dxLeft = px - leftHandleX;
   var dyLeft = py - leftHandleY;
   if (Math.sqrt(dxLeft * dxLeft + dyLeft * dyLeft) <= hitRadius) {
      return { anchor: "left" };
   }
   
   // Check right anchor
   var dxRight = px - rightHandleX;
   var dyRight = py - rightHandleY;
   if (Math.sqrt(dxRight * dxRight + dyRight * dyRight) <= hitRadius) {
      return { anchor: "right" };
   }
   
   return { anchor: null };
}

/**
 * Update preview for Finalize mode using source image.
 * @param {Dialog} dialog - The parent dialog
 */
function updateFinalizePreview(dialog) {
   if (!dialog.finalizeSourceView || dialog.finalizeSourceView.isNull) {
      return;
   }
   
   // Use source image for preview
   dialog.targetView = dialog.finalizeSourceView;
   dialog.updateImageDimensions();
   dialog.updatePreviewBitmap();
   
   // Repaint the finalize preview control
   if (dialog.finalizePreviewControl) {
      dialog.finalizePreviewControl.repaint();
   }
}

/**
 * Create paint handler for the Finalize preview control.
 * @param {Dialog} dialog - The parent dialog
 * @param {Control} previewControl - The finalize preview control
 */
function createFinalizePreviewPaintHandler(dialog, previewControl) {
   previewControl.onPaint = function(x0, y0, x1, y1) {
      var g = new Graphics(this);
      g.clipRect = new Rect(x0, y0, x1, y1);
      g.fillRect(this.boundsRect, new Brush(0xFF333333));
      
      if (dialog.previewBitmap) {
         // Apply zoom and pan
         var zoom = dialog.finalizeZoom;
         var scaledW = dialog.previewBitmap.width * zoom;
         var scaledH = dialog.previewBitmap.height * zoom;
         
         // Center the scaled image, then apply pan offset
         var offsetX = (this.width - scaledW) / 2 + dialog.finalizePanX;
         var offsetY = (this.height - scaledH) / 2 + dialog.finalizePanY;
         
         // Draw scaled preview bitmap
         if (zoom !== 1.0) {
            var scaledBitmap = dialog.previewBitmap.scaled(zoom);
            g.drawBitmap(offsetX, offsetY, scaledBitmap);
         } else {
            g.drawBitmap(offsetX, offsetY, dialog.previewBitmap);
         }
         
         // Draw extraction region and inset image with zoom applied
         drawFinalizeOverlay(dialog, g, offsetX, offsetY, zoom);
         
         // Draw zoom indicator
         if (zoom !== 1.0) {
            g.pen = new Pen(0xFFFFFFFF);
            g.drawText(10, this.height - 20, "Zoom: " + (zoom * 100).toFixed(0) + "%");
         }
      } else {
         g.pen = new Pen(0xFFAAAAAA);
         g.drawText(this.width / 2 - 100, this.height / 2, "Select source and inset images");
      }
      
      g.end();
   };
   
   // Resize handler - recreate inset bitmap when preview size changes
   previewControl.onResize = function(newWidth, newHeight, oldWidth, oldHeight) {
      if (dialog.targetView && !dialog.targetView.isNull && 
          (newWidth !== oldWidth || newHeight !== oldHeight)) {
         dialog.updatePreviewBitmap();
         // Recreate inset bitmap with new scale
         if (dialog.insetBitmap) {
            createInsetBitmap(dialog);
         }
      }
   };
}

/**
 * Set up mouse event handlers for the Finalize preview control.
 * @param {Dialog} dialog - The parent dialog
 * @param {Control} previewControl - The finalize preview control
 */
function createFinalizePreviewHandlers(dialog, previewControl) {
   
   // Helper to get effective offset accounting for zoom and pan
   function getOffset(control) {
      var zoom = dialog.finalizeZoom;
      var scaledW = dialog.previewBitmap ? dialog.previewBitmap.width * zoom : 0;
      var scaledH = dialog.previewBitmap ? dialog.previewBitmap.height * zoom : 0;
      return {
         x: (control.width - scaledW) / 2 + dialog.finalizePanX,
         y: (control.height - scaledH) / 2 + dialog.finalizePanY
      };
   }
   
   // Mouse press handler
   previewControl.onMousePress = function(x, y, button, buttonState, modifiers) {
      if (!dialog.previewBitmap) return;
      
      var offset = getOffset(this);
      var zoom = dialog.finalizeZoom;
      var effectiveScale = dialog.previewScale * zoom;
      var px = x - offset.x;
      var py = y - offset.y;
      
      // Middle button or clicking outside inset starts panning
      if (button === 4) {
         dialog.finalizeInteractionMode = "pan";
         dialog.finalizeDragStartX = x;
         dialog.finalizeDragStartY = y;
         dialog._panStartX = dialog.finalizePanX;
         dialog._panStartY = dialog.finalizePanY;
         return;
      }
      
      if (button !== 1) return;
      
      dialog.finalizeDragStartX = px;
      dialog.finalizeDragStartY = py;
      
      // First, check for source anchor hit (connection line endpoints)
      var anchorHit = hitTestSourceAnchors(dialog, px, py, zoom);
      if (anchorHit.anchor) {
         dialog.finalizeInteractionMode = "anchor-drag";
         dialog.finalizeDragAnchor = anchorHit.anchor;
         return;
      }
      
      // Check if inset exists and hit test
      if (dialog.insetBitmap) {
         var hit = hitTestInset(dialog, px, py, zoom);
         
         if (hit.handle) {
            dialog.finalizeInteractionMode = "resize";
            dialog.finalizeResizeHandle = hit.handle;
            dialog.finalizeOriginalRegion = {
               x: dialog.insetX,
               y: dialog.insetY,
               w: dialog.insetWidth,
               h: dialog.insetHeight
            };
            return;
         } else if (hit.inside) {
            dialog.finalizeInteractionMode = "move";
            var insetPx = dialog.insetX * effectiveScale;
            var insetPy = dialog.insetY * effectiveScale;
            dialog.finalizeDragOffsetX = px - insetPx;
            dialog.finalizeDragOffsetY = py - insetPy;
            return;
         }
      }
      
      // Clicking outside inset - start panning
      dialog.finalizeInteractionMode = "pan";
      dialog.finalizeDragStartX = x;
      dialog.finalizeDragStartY = y;
      dialog._panStartX = dialog.finalizePanX;
      dialog._panStartY = dialog.finalizePanY;
   };
   
   // Mouse move handler
   previewControl.onMouseMove = function(x, y, buttonState, modifiers) {
      if (!dialog.finalizeInteractionMode) return;
      if (!dialog.previewBitmap) return;
      
      var zoom = dialog.finalizeZoom;
      var effectiveScale = dialog.previewScale * zoom;
      
      // Handle panning
      if (dialog.finalizeInteractionMode === "pan") {
         var dx = x - dialog.finalizeDragStartX;
         var dy = y - dialog.finalizeDragStartY;
         dialog.finalizePanX = dialog._panStartX + dx;
         dialog.finalizePanY = dialog._panStartY + dy;
         this.repaint();
         return;
      }
      
      var offset = getOffset(this);
      var px = x - offset.x;
      var py = y - offset.y;
      
      // Handle anchor dragging (connection line endpoints)
      if (dialog.finalizeInteractionMode === "anchor-drag") {
         var params = dialog.params;
         var rx = params.regionX * effectiveScale;
         var ry = params.regionY * effectiveScale;
         var rw = params.regionWidth * effectiveScale;
         var rh = params.regionHeight * effectiveScale;
         
         // Calculate center of source region
         var cx = rx + rw / 2;
         var cy = ry + rh / 2;
         
         // Calculate angle from center to mouse position
         var newAngle = Math.atan2(py - cy, px - cx);
         
         // Move both anchors symmetrically (opposite sides of the circle)
         // When one anchor moves, the other stays PI radians (180°) apart
         if (dialog.finalizeDragAnchor === "left") {
            dialog.sourceAnchors.leftAngle = newAngle;
            dialog.sourceAnchors.rightAngle = newAngle + Math.PI;
         } else if (dialog.finalizeDragAnchor === "right") {
            dialog.sourceAnchors.rightAngle = newAngle;
            dialog.sourceAnchors.leftAngle = newAngle + Math.PI;
         }
         
         this.repaint();
         return;
      }
      
      if (dialog.finalizeInteractionMode === "move") {
         var newX = Math.round((px - dialog.finalizeDragOffsetX) / effectiveScale);
         var newY = Math.round((py - dialog.finalizeDragOffsetY) / effectiveScale);
         
         // Allow positioning outside source image bounds (no clamping)
         dialog.insetX = newX;
         dialog.insetY = newY;
         
      } else if (dialog.finalizeInteractionMode === "resize") {
         var orig = dialog.finalizeOriginalRegion;
         var dx = Math.round(px / effectiveScale) - Math.round(dialog.finalizeDragStartX / effectiveScale);
         var dy = Math.round(py / effectiveScale) - Math.round(dialog.finalizeDragStartY / effectiveScale);
         
         // Calculate aspect ratio for proportional resize
         var aspectRatio = orig.w / orig.h;
         
         var newX = orig.x, newY = orig.y, newW = orig.w, newH = orig.h;
         
         // Determine the primary resize direction and enforce aspect ratio
         var handle = dialog.finalizeResizeHandle;
         
         if (handle === "se") {
            var delta = Math.abs(dx) > Math.abs(dy) ? dx : dy * aspectRatio;
            newW = orig.w + delta;
            newH = newW / aspectRatio;
         } else if (handle === "sw") {
            var delta = Math.abs(dx) > Math.abs(dy) ? -dx : dy * aspectRatio;
            newW = orig.w + delta;
            newH = newW / aspectRatio;
            newX = orig.x + orig.w - newW;
         } else if (handle === "ne") {
            var delta = Math.abs(dx) > Math.abs(dy) ? dx : -dy * aspectRatio;
            newW = orig.w + delta;
            newH = newW / aspectRatio;
            newY = orig.y + orig.h - newH;
         } else if (handle === "nw") {
            var delta = Math.abs(dx) > Math.abs(dy) ? -dx : -dy * aspectRatio;
            newW = orig.w + delta;
            newH = newW / aspectRatio;
            newX = orig.x + orig.w - newW;
            newY = orig.y + orig.h - newH;
         } else if (handle === "n") {
            // North: drag up to grow, down to shrink (uniform scale for circle)
            var delta = -dy;
            newW = orig.w + delta;
            newH = orig.h + delta;
            // Keep centered horizontally, anchor at bottom
            newX = orig.x - delta / 2;
            newY = orig.y - delta;
         } else if (handle === "s") {
            // South: drag down to grow, up to shrink
            var delta = dy;
            newW = orig.w + delta;
            newH = orig.h + delta;
            // Keep centered horizontally, anchor at top
            newX = orig.x - delta / 2;
         } else if (handle === "w") {
            // West: drag left to grow, right to shrink
            var delta = -dx;
            newW = orig.w + delta;
            newH = orig.h + delta;
            // Keep centered vertically, anchor at right
            newX = orig.x - delta;
            newY = orig.y - delta / 2;
         } else if (handle === "e") {
            // East: drag right to grow, left to shrink
            var delta = dx;
            newW = orig.w + delta;
            newH = orig.h + delta;
            // Keep centered vertically, anchor at left
            newY = orig.y - delta / 2;
         }
         
         // Minimum size
         if (newW < 20) {
            newW = 20;
            newH = newW / aspectRatio;
         }
         if (newH < 20) {
            newH = 20;
            newW = newH * aspectRatio;
         }
         
         // No clamping to image bounds - allow inset outside source image
         
         dialog.insetX = Math.round(newX);
         dialog.insetY = Math.round(newY);
         dialog.insetWidth = Math.round(newW);
         dialog.insetHeight = Math.round(newH);
         
         // Recreate inset bitmap at new size
         createInsetBitmap(dialog);
      }
      
      this.repaint();
   };
   
   // Mouse release handler
   previewControl.onMouseRelease = function(x, y, button, buttonState, modifiers) {
      dialog.finalizeInteractionMode = null;
      dialog.finalizeResizeHandle = null;
      dialog.finalizeOriginalRegion = null;
      dialog.finalizeDragAnchor = null;
      this.repaint();
   };
   
   // Mouse wheel handler for zoom
   previewControl.onMouseWheel = function(x, y, delta, buttonState, modifiers) {
      if (!dialog.previewBitmap) return;
      
      // Zoom factor change per wheel step
      var zoomStep = 0.1;
      var newZoom = dialog.finalizeZoom;
      
      if (delta > 0) {
         newZoom = Math.min(2.0, dialog.finalizeZoom + zoomStep); // Zoom in (max 200%)
      } else {
         newZoom = Math.max(0.2, dialog.finalizeZoom - zoomStep); // Zoom out (min 20%)
      }
      
      // Zoom towards mouse position
      var oldZoom = dialog.finalizeZoom;
      if (newZoom !== oldZoom) {
         // Calculate zoom center offset adjustment
         var centerX = this.width / 2;
         var centerY = this.height / 2;
         var dx = x - centerX;
         var dy = y - centerY;
         
         // Adjust pan to zoom towards mouse position
         var zoomRatio = newZoom / oldZoom;
         dialog.finalizePanX = dialog.finalizePanX * zoomRatio - dx * (zoomRatio - 1);
         dialog.finalizePanY = dialog.finalizePanY * zoomRatio - dy * (zoomRatio - 1);
         
         dialog.finalizeZoom = newZoom;
         this.repaint();
      }
   };
}
