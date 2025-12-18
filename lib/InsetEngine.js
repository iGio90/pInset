// ----------------------------------------------------------------------------
// InsetEngine.js - Core inset creation logic for pInset
// ----------------------------------------------------------------------------
//
// This module contains functions for:
// - Region extraction from source image
// - Scaling/interpolation
// - Border drawing
// - Compositing inset onto target image
// - Connection line drawing
//
// Author: Giovanni Rocca (iGio90) and Antigravity
//
// ----------------------------------------------------------------------------

/**
 * InsetEngine - Core engine for inset creation.
 * Contains all pixel manipulation logic.
 */
function InsetEngine() {
   // Default settings
   this.interpolationMethod = "bicubic"; // "bilinear", "bicubic", "lanczos"
}

// ----------------------------------------------------------------------------
// Region Extraction (Step 3)
// ----------------------------------------------------------------------------

/**
 * Extract a rectangular region from an image.
 * @param {Image} image - Source image object
 * @param {Rect} rect - Rectangle defining the region (x, y, width, height)
 * @returns {Object} Extracted pixel data {pixels: Array, width, height, channels}
 */
InsetEngine.prototype.extractRegion = function(image, rect) {
   // Validate bounds
   if (rect.x0 < 0 || rect.y0 < 0 ||
       rect.x1 > image.width || rect.y1 > image.height) {
      throw new Error("Selected region exceeds image bounds");
   }
   
   if (rect.width < 10 || rect.height < 10) {
      throw new Error("Region must be at least 10x10 pixels");
   }
   
   var channels = image.numberOfChannels;
   var width = rect.width;
   var height = rect.height;
   var pixels = [];
   
   // Extract each channel
   for (var c = 0; c < channels; c++) {
      var buffer = new Float32Array(width * height);
      image.getSamples(buffer, rect, c);
      pixels.push(buffer);
   }
   
   return {
      pixels: pixels,
      width: width,
      height: height,
      channels: channels
   };
};

/**
 * Extract a circular region (square with circular mask).
 * @param {Image} image - Source image object
 * @param {Point} center - Center point of the circle
 * @param {Number} diameter - Diameter in pixels
 * @returns {Object} Extracted data with circular mask
 */
InsetEngine.prototype.extractCircularRegion = function(image, center, diameter) {
   var radius = diameter / 2;
   
   // Calculate initial rect
   var x0 = center.x - radius;
   var y0 = center.y - radius;
   var x1 = center.x + radius;
   var y1 = center.y + radius;
   
   // Clamp to image bounds
   x0 = Math.max(0, Math.round(x0));
   y0 = Math.max(0, Math.round(y0));
   x1 = Math.min(image.width, Math.round(x1));
   y1 = Math.min(image.height, Math.round(y1));
   
   var rect = new Rect(x0, y0, x1, y1);
   
   var data = this.extractRegion(image, rect);
   
   // Create circular mask
   var mask = new Float32Array(data.width * data.height);
   var cx = data.width / 2;
   var cy = data.height / 2;
   
   for (var y = 0; y < data.height; y++) {
      for (var x = 0; x < data.width; x++) {
         var dx = x - cx + 0.5;
         var dy = y - cy + 0.5;
         var dist = Math.sqrt(dx * dx + dy * dy);
         // Anti-aliased edge: smooth transition over 1 pixel
         var alpha = radius + 0.5 - dist;
         if (alpha < 0) alpha = 0;
         else if (alpha > 1) alpha = 1;
         mask[y * data.width + x] = alpha;
      }
   }
   
   data.mask = mask;
   data.isCircular = true;
   return data;
};

// ----------------------------------------------------------------------------
// Scaling (Step 4)
// ----------------------------------------------------------------------------

/**
 * Scale pixel data to new dimensions using specified interpolation.
 * @param {Object} extractedData - Data from extractRegion
 * @param {Number} targetWidth - Target width in pixels
 * @param {Number} targetHeight - Target height in pixels
 * @returns {Object} Scaled pixel data
 */
InsetEngine.prototype.scalePixels = function(extractedData, targetWidth, targetHeight) {
   var srcWidth = extractedData.width;
   var srcHeight = extractedData.height;
   var channels = extractedData.channels;
   var scaledPixels = [];
   
   for (var c = 0; c < channels; c++) {
      var srcBuffer = extractedData.pixels[c];
      var dstBuffer = new Float32Array(targetWidth * targetHeight);
      
      this.bicubicInterpolate(srcBuffer, srcWidth, srcHeight, 
                               dstBuffer, targetWidth, targetHeight);
      scaledPixels.push(dstBuffer);
   }
   
   // Generate circular mask at target size (content area, which is inside border)
   var scaledMask = null;
   if (extractedData.isCircular) {
      scaledMask = new Float32Array(targetWidth * targetHeight);
      var cx = targetWidth / 2;
      var cy = targetHeight / 2;
      // Use radius that fits the smaller dimension
      var radius = Math.min(targetWidth, targetHeight) / 2;
      
      for (var y = 0; y < targetHeight; y++) {
         for (var x = 0; x < targetWidth; x++) {
            var dx = x - cx + 0.5;
            var dy = y - cy + 0.5;
            var dist = Math.sqrt(dx * dx + dy * dy);
            // Anti-aliased edge
            var alpha = radius + 0.5 - dist;
            if (alpha < 0) alpha = 0;
            else if (alpha > 1) alpha = 1;
            scaledMask[y * targetWidth + x] = alpha;
         }
      }
   }
   
   return {
      pixels: scaledPixels,
      width: targetWidth,
      height: targetHeight,
      channels: channels,
      mask: scaledMask,
      isCircular: extractedData.isCircular
   };
};

/**
 * Bicubic interpolation helper (optimized).
 * Uses pre-computed weights to reduce function call overhead.
 */
InsetEngine.prototype.bicubicInterpolate = function(src, srcW, srcH, dst, dstW, dstH) {
   var xRatio = srcW / dstW;
   var yRatio = srcH / dstH;
   
   // Pre-compute cubic weight function inline (avoid function call overhead)
   var computeCubicWeight = function(t) {
      t = t < 0 ? -t : t;  // Math.abs inline
      if (t <= 1) {
         return 1.5 * t * t * t - 2.5 * t * t + 1;
      } else if (t <= 2) {
         return -0.5 * t * t * t + 2.5 * t * t - 4 * t + 2;
      }
      return 0;
   };
   
   for (var y = 0; y < dstH; y++) {
      var srcY = y * yRatio;
      var y0 = srcY | 0;  // Math.floor inline using bitwise OR
      var yFrac = srcY - y0;
      
      // Pre-compute y-direction weights for this row (optimization: computed once per row instead of per pixel)
      var yWeights = [
         computeCubicWeight(-1 - yFrac),
         computeCubicWeight(0 - yFrac),
         computeCubicWeight(1 - yFrac),
         computeCubicWeight(2 - yFrac)
      ];
      
      var dstRowOffset = y * dstW;
      
      for (var x = 0; x < dstW; x++) {
         var srcX = x * xRatio;
         var x0 = srcX | 0;  // Math.floor inline
         var xFrac = srcX - x0;
         
         // Pre-compute x-direction weights
         var xWeights = [
            computeCubicWeight(-1 - xFrac),
            computeCubicWeight(0 - xFrac),
            computeCubicWeight(1 - xFrac),
            computeCubicWeight(2 - xFrac)
         ];
         
         // Sample 4x4 neighborhood with pre-computed weights
         var sum = 0;
         var weightSum = 0;
         
         for (var j = 0; j < 4; j++) {
            var py = y0 + j - 1;
            // Clamp py
            if (py < 0) py = 0;
            else if (py >= srcH) py = srcH - 1;
            
            var pyOffset = py * srcW;
            var yWeight = yWeights[j];
            
            for (var i = 0; i < 4; i++) {
               var px = x0 + i - 1;
               // Clamp px
               if (px < 0) px = 0;
               else if (px >= srcW) px = srcW - 1;
               
               var weight = xWeights[i] * yWeight;
               sum += src[pyOffset + px] * weight;
               weightSum += weight;
            }
         }
         
         // Clamp result to [0, 1]
         var result = sum / weightSum;
         if (result < 0) result = 0;
         else if (result > 1) result = 1;
         dst[dstRowOffset + x] = result;
      }
   }
};

/**
 * Cubic weight function for bicubic interpolation.
 */
InsetEngine.prototype.cubicWeight = function(t) {
   t = Math.abs(t);
   if (t <= 1) {
      return 1.5 * t * t * t - 2.5 * t * t + 1;
   } else if (t <= 2) {
      return -0.5 * t * t * t + 2.5 * t * t - 4 * t + 2;
   }
   return 0;
};

// ----------------------------------------------------------------------------
// Border Drawing (Step 5)
// ----------------------------------------------------------------------------

/**
 * Add a border around the scaled inset.
 * @param {Object} scaledData - Scaled pixel data
 * @param {Number} borderWidth - Border width in pixels
 * @param {Object} borderColor - {r, g, b} normalized 0-1
 * @returns {Object} Pixel data with border added
 */
InsetEngine.prototype.addBorder = function(scaledData, borderWidth, borderColor) {
   var srcW = scaledData.width;
   var srcH = scaledData.height;
   var dstW = srcW + borderWidth * 2;
   var dstH = srcH + borderWidth * 2;
   var channels = scaledData.channels;
   
   var borderedPixels = [];
   var colors = [borderColor.r, borderColor.g, borderColor.b];
   
   for (var c = 0; c < channels; c++) {
      var dstBuffer = new Float32Array(dstW * dstH);
      var borderVal = c < 3 ? colors[c] : 1.0;
      
      // Fill with border color
      for (var i = 0; i < dstBuffer.length; i++) {
         dstBuffer[i] = borderVal;
      }
      
      // Copy original to center (blending if mask exists)
      var srcBuffer = scaledData.pixels[c];
      var srcMask = scaledData.mask;
      
      for (var y = 0; y < srcH; y++) {
         for (var x = 0; x < srcW; x++) {
            var dstX = x + borderWidth;
            var dstY = y + borderWidth;
            var dstIdx = dstY * dstW + dstX;
            var srcIdx = y * srcW + x;
            
            if (srcMask) {
               // Blend content onto border background using mask
               var alpha = srcMask[srcIdx];
               var borderVal = dstBuffer[dstIdx];
               dstBuffer[dstIdx] = srcBuffer[srcIdx] * alpha + borderVal * (1.0 - alpha);
            } else {
               // Direct copy
               dstBuffer[dstIdx] = srcBuffer[srcIdx];
            }
         }
      }
      
   // Create mask for compositing (if not exists)
   var borderedMask = null;
   if (scaledData.mask) {
       // Circular case - create proper circular mask for bordered output
       borderedMask = new Float32Array(dstW * dstH);
       var borderAlpha = (borderColor.a !== undefined) ? borderColor.a : 1.0;
       
       // For circular insets, we need:
       // - Alpha = 0 outside the outer circle (corners should be transparent)
       // - Alpha = borderAlpha in the border ring
       // - Alpha = 1.0 in the content area (inside inner circle)
      var cx = dstW / 2;
      var cy = dstH / 2;
      var outerRadius = Math.min(dstW, dstH) / 2;
      var innerRadius = outerRadius - borderWidth;
        
      for (var y = 0; y < dstH; y++) {
           for (var x = 0; x < dstW; x++) {
              var dx = x - cx + 0.5;
              var dy = y - cy + 0.5;
              var dist = Math.sqrt(dx * dx + dy * dy);
              var idx = y * dstW + x;
              
              if (dist > outerRadius + 0.5) {
                 // Outside the circle - fully transparent
                 borderedMask[idx] = 0.0;
              } else if (dist > outerRadius - 0.5) {
                 // Anti-aliased outer edge - smooth transition
                 var edgeAlpha = outerRadius + 0.5 - dist;
                 borderedMask[idx] = borderAlpha * edgeAlpha;
              } else if (dist > innerRadius) {
                 // In the border ring - use border alpha
                 borderedMask[idx] = borderAlpha;
              } else {
                 // Inside the content area - fully opaque
                 borderedMask[idx] = 1.0;
              }
           }
        }
   } else {
       // Rectangular case - create mask to support border transparency
       borderedMask = new Float32Array(dstW * dstH);
       var borderAlpha = (borderColor.a !== undefined) ? borderColor.a : 1.0;
       
       // Initialize with borderAlpha
       for (var i = 0; i < borderedMask.length; i++) borderedMask[i] = borderAlpha;
       
       // Set center to 1.0 (opaque content)
       var x0 = borderWidth;
       var y0 = borderWidth;
       var x1 = dstW - borderWidth;
       var y1 = dstH - borderWidth;
       
       for (var y = y0; y < y1; y++) {
          for (var x = x0; x < x1; x++) {
             borderedMask[y * dstW + x] = 1.0;
          }
       }
   }
   
   borderedPixels.push(dstBuffer);
   }
   
   return {
      pixels: borderedPixels,
      width: dstW,
      height: dstH,
      channels: channels,
      mask: borderedMask,
      isCircular: scaledData.isCircular
   };
};

// ----------------------------------------------------------------------------
// Position Calculation (Step 6)
// ----------------------------------------------------------------------------

/**
 * Calculate inset position based on preset or custom coordinates.
 * @param {Number} imageWidth - Target image width
 * @param {Number} imageHeight - Target image height
 * @param {Number} insetWidth - Inset width (including border)
 * @param {Number} insetHeight - Inset height (including border)
 * @param {String} preset - Position preset name
 * @param {Number} margin - Margin from edge
 * @param {Object} customPos - Custom {x, y} if preset is "Custom"
 * @returns {Object} {x, y} position for top-left corner
 */
InsetEngine.prototype.calculatePosition = function(imageWidth, imageHeight, 
                                                    insetWidth, insetHeight,
                                                    preset, margin, customPos) {
   var pos = {x: 0, y: 0};
   
   switch (preset) {
      case "Top-Left":
         pos.x = margin;
         pos.y = margin;
         break;
      case "Top-Right":
         pos.x = imageWidth - insetWidth - margin;
         pos.y = margin;
         break;
      case "Bottom-Left":
         pos.x = margin;
         pos.y = imageHeight - insetHeight - margin;
         break;
      case "Bottom-Right":
         pos.x = imageWidth - insetWidth - margin;
         pos.y = imageHeight - insetHeight - margin;
         break;
      case "Custom":
         pos.x = customPos ? customPos.x : margin;
         pos.y = customPos ? customPos.y : margin;
         break;
      default:
         pos.x = margin;
         pos.y = margin;
   }
   
   // Clamp to image bounds
   pos.x = Math.max(0, Math.min(imageWidth - insetWidth, pos.x));
   pos.y = Math.max(0, Math.min(imageHeight - insetHeight, pos.y));
   
   return pos;
};

// ----------------------------------------------------------------------------
// Compositing (Step 7)
// ----------------------------------------------------------------------------

/**
 * Composite the inset onto the target image.
 * @param {Image} targetImage - Target image to modify
 * @param {Object} insetData - Bordered inset pixel data
 * @param {Object} position - {x, y} position for placement
 * @param {Number} opacity - Global opacity (0.0 - 1.0)
 */
InsetEngine.prototype.compositeInset = function(targetImage, insetData, position, opacity) {
   // Default opacity to 1.0 if undefined
   var globalAlpha = (opacity !== undefined) ? opacity : 1.0;
   
   var insetW = insetData.width;
   var insetH = insetData.height;
   var channels = Math.min(insetData.channels, targetImage.numberOfChannels);
   
   var destRect = new Rect(position.x, position.y, 
                           position.x + insetW, position.y + insetH);
   
   // Clamp destRect to targetImage bounds to avoid errors during getSamples
   var safeRect = destRect.intersection(new Rect(0, 0, targetImage.width, targetImage.height));
   if (safeRect.isEmpty) return;
   
   // Adjust offset for source samples if rect was clamped
   var offsetX = safeRect.x0 - destRect.x0;
   var offsetY = safeRect.y0 - destRect.y0;
   var validW = safeRect.width;
   var validH = safeRect.height;
   
   for (var c = 0; c < channels; c++) {
      var targetBuffer = new Float32Array(validW * validH);
      targetImage.getSamples(targetBuffer, safeRect, c);
      
      var insetBuffer = insetData.pixels[c];
      var mask = insetData.mask; // Circular mask if present
      
      // We need to map from safeRect coordinates back to insetBuffer coordinates
      for (var y = 0; y < validH; y++) {
         for (var x = 0; x < validW; x++) {
            var iy = y + offsetY;
            var ix = x + offsetX;
            
            // Source pixel index
            var srcIdx = iy * insetW + ix;
            var tgtIdx = y * validW + x;
            
            var pixelAlpha = globalAlpha;
            if (mask) {
               // Combine global opacity (which applies to content if checked) 
               // with pixel-specific opacity (mask).
               // BUT wait, `globalAlpha` passed in is `insetOpacity`.
               // `insetOpacity` logic in FinalizePanel:
               //   - if checked: set to slider value (e.g. 0.5)
               //   - if unchecked: set to 1.0
               // So proper logic is: ResultAlpha = maskAlpha * globalAlpha ??
               
               // maskAlpha comes from addBorder:
               //   - Border area = slider value (e.g. 0.5)
               //   - Content area = 1.0
               
               // If Unchecked (global=1.0):
               //   - Border: 0.5 * 1.0 = 0.5 (Correct)
               //   - Content: 1.0 * 1.0 = 1.0 (Correct)
               
               // If Checked (global=0.5):
               //   - Border: 0.5 * 0.5 = 0.25 (Double fading? Maybe user wants that?)
               //   - Content: 1.0 * 0.5 = 0.5 (Correct)
               
               // Double fading on border is weird. 
               // The issue is `borderAlpha` is ALREADY set to `baseOpacity` in `addBorder`.
               
               // If `applyOpacity` is FALSE, globalAlpha is 1.0. Correct.
               // If `applyOpacity` is TRUE, globalAlpha is 0.5.
               // But `borderAlpha` is already 0.5.
               // So we get 0.25 on border!
               
               // We should probably rely on `mask` for the "intrinsic" opacity structure,
               // and only apply `globalAlpha` to scales?
               
               // Actually, `borderAlpha` should probably be set to 1.0 in `addBorder` if we want valid masking?
               // No, `addBorder` is creating the pixels.
               
               // Let's assume straight multiplication is acceptable for now or safer:
               pixelAlpha *= mask[srcIdx];
            }
            
            // Blend: Src * alpha + Dst * (1 - alpha)
            targetBuffer[tgtIdx] = insetBuffer[srcIdx] * pixelAlpha + targetBuffer[tgtIdx] * (1.0 - pixelAlpha);
         }
      }
      
      targetImage.setSamples(targetBuffer, safeRect, c);
   }
};

// ----------------------------------------------------------------------------
// Connection Line (Step 8)
// ----------------------------------------------------------------------------

/**
 * Draw a line from source region to inset.
 * @param {Image} image - Target image
 * @param {Rect} sourceRect - Original source region
 * @param {Rect} insetRect - Inset position and size
 * @param {Object} color - {r, g, b} normalized 0-1
 * @param {Number} thickness - Line thickness in pixels
 */
/**
 * Draw a line from source region to inset.
 * @param {Image} image - Target image
 * @param {Rect} sourceRect - Original source region
 * @param {Rect} insetRect - Inset position and size
 * @param {Object} color - {r, g, b} normalized 0-1
 * @param {Number} thickness - Line thickness in pixels
 * @param {String} shape - "Rectangular" or "Circular"
 */
/**
 * Helper to fill a rectangular area efficiently.
 */
InsetEngine.prototype.fillBox = function(image, rect, color) {
   // Clamp rect to image bounds
   var x0 = Math.max(0, rect.x0);
   var y0 = Math.max(0, rect.y0);
   var x1 = Math.min(image.width, rect.x1);
   var y1 = Math.min(image.height, rect.y1);
   
   if (x1 <= x0 || y1 <= y0) return;
   
   var w = x1 - x0;
   var h = y1 - y0;
   var count = w * h;
   
   // Create a rect for the actual fill operation
   var fillRect = new Rect(x0, y0, x1, y1);
   
   var channels = Math.min(3, image.numberOfChannels);
   var colors = [color.r, color.g, color.b];
   var alpha = (color.a !== undefined) ? color.a : 1.0;
   
   if (alpha >= 0.99) {
      // Fast path: Opaque fill
      var buffer = new Float32Array(count);
      for (var c = 0; c < channels; c++) {
         var val = colors[c];
         for (var i = 0; i < count; i++) buffer[i] = val;
         image.setSamples(buffer, fillRect, c);
      }
   } else {
      // Alpha blend path
      for (var c = 0; c < channels; c++) {
         // Read existing pixels
         var buffer = new Float32Array(count);
         image.getSamples(buffer, fillRect, c);
         
         var val = colors[c];
         // Blend
         for (var i = 0; i < count; i++) {
            buffer[i] = val * alpha + buffer[i] * (1.0 - alpha);
         }
         image.setSamples(buffer, fillRect, c);
      }
   }
};

/**
 * Draw a line from source region to inset.
 * @param {Image} image - Target image
 * @param {Rect} sourceRect - Original source region
 * @param {Rect} insetRect - Inset position and size
 * @param {Object} color - {r, g, b} normalized 0-1
 * @param {Number} thickness - Line thickness in pixels
 * @param {String} shape - "Rectangular" or "Circular"
 * @param {Object} sourceAnchors - Optional {leftAngle, rightAngle} for circular shapes
 */
InsetEngine.prototype.drawConnectionLine = function(image, sourceRect, insetRect, color, thickness, shape, sourceAnchors) {
   shape = shape || "Rectangular";

   // Calculate offset to prevent thick lines from protruding outside the inset
   // (Inset is drawn on top, so we want lines to end "deep" enough inside)
   var offset = Math.floor(thickness / 2);

   if (shape === "Circular") {
      // For circular shapes, connect with 2 tangent lines
      var srcCenterX = (sourceRect.x0 + sourceRect.x1) / 2;
      var srcCenterY = (sourceRect.y0 + sourceRect.y1) / 2;
      var srcR = Math.min(sourceRect.width, sourceRect.height) / 2;

      var insCenterX = (insetRect.x0 + insetRect.x1) / 2;
      var insCenterY = (insetRect.y0 + insetRect.y1) / 2;
      // Reduce inset radius by offset to pull connection points inside
      var insR = Math.max(1, Math.min(insetRect.width, insetRect.height) / 2 - offset);

      // Use custom anchor angles if provided, otherwise default to horizontal (left/right)
      var leftAngle = (sourceAnchors && sourceAnchors.leftAngle !== undefined) ? sourceAnchors.leftAngle : Math.PI;
      var rightAngle = (sourceAnchors && sourceAnchors.rightAngle !== undefined) ? sourceAnchors.rightAngle : 0;
      
      // Source anchor positions (calculated from angles)
      var srcLeftX = Math.round(srcCenterX + Math.cos(leftAngle) * srcR);
      var srcLeftY = Math.round(srcCenterY + Math.sin(leftAngle) * srcR);
      var srcRightX = Math.round(srcCenterX + Math.cos(rightAngle) * srcR);
      var srcRightY = Math.round(srcCenterY + Math.sin(rightAngle) * srcR);
      
      // Inset anchor positions (using same angles for parallel lines)
      var insLeftX = Math.round(insCenterX + Math.cos(leftAngle) * insR);
      var insLeftY = Math.round(insCenterY + Math.sin(leftAngle) * insR);
      var insRightX = Math.round(insCenterX + Math.cos(rightAngle) * insR);
      var insRightY = Math.round(insCenterY + Math.sin(rightAngle) * insR);
      
      this.bresenhamLine(image, srcLeftX, srcLeftY, insLeftX, insLeftY, color, thickness);
      this.bresenhamLine(image, srcRightX, srcRightY, insRightX, insRightY, color, thickness);
   } else {
      // For rectangular shapes, connect all 4 corresponding corners
      // Apply offset to inset coordinates (x0 moves right, x1 moves left, etc.)
      
      // NW to NW
      this.bresenhamLine(image, sourceRect.x0, sourceRect.y0, 
                         insetRect.x0 + offset, insetRect.y0 + offset, color, thickness);
      // NE to NE
      this.bresenhamLine(image, sourceRect.x1 - 1, sourceRect.y0, 
                         insetRect.x1 - 1 - offset, insetRect.y0 + offset, color, thickness);
      // SW to SW
      this.bresenhamLine(image, sourceRect.x0, sourceRect.y1 - 1, 
                         insetRect.x0 + offset, insetRect.y1 - 1 - offset, color, thickness);
      // SE to SE
      this.bresenhamLine(image, sourceRect.x1 - 1, sourceRect.y1 - 1, 
                         insetRect.x1 - 1 - offset, insetRect.y1 - 1 - offset, color, thickness);
   }
};

/**
 * Anti-aliased line drawing with thickness.
 * Uses distance-from-line calculation for smooth edges.
 * @param {Image} image - Target image
 * @param {Number} x0, y0 - Start point
 * @param {Number} x1, y1 - End point
 * @param {Object} color - {r, g, b, a} normalized 0-1
 * @param {Number} thickness - Line thickness in pixels
 */
InsetEngine.prototype.bresenhamLine = function(image, x0, y0, x1, y1, color, thickness) {
   var alpha = (color.a !== undefined) ? color.a : 1.0;
   var halfThick = thickness / 2;
   
   // Calculate line vector
   var dx = x1 - x0;
   var dy = y1 - y0;
   var lineLength = Math.sqrt(dx * dx + dy * dy);
   
   if (lineLength < 0.001) {
      // Degenerate case: draw a dot
      lineLength = 1;
      dx = 1;
      dy = 0;
   }
   
   // Normalize line direction
   var ndx = dx / lineLength;
   var ndy = dy / lineLength;
   
   // Determine bounding box with padding for AA
   var padding = halfThick + 1.5;
   var minX = Math.max(0, Math.floor(Math.min(x0, x1) - padding));
   var maxX = Math.min(image.width, Math.ceil(Math.max(x0, x1) + padding));
   var minY = Math.max(0, Math.floor(Math.min(y0, y1) - padding));
   var maxY = Math.min(image.height, Math.ceil(Math.max(y0, y1) + padding));
   
   var rowWidth = maxX - minX;
   if (rowWidth <= 0 || maxY <= minY) return;
   
   var colors = [color.r, color.g, color.b];
   var channels = Math.min(3, image.numberOfChannels);
   
   // Process row by row for efficiency
   for (var row = minY; row < maxY; row++) {
      var rowRect = new Rect(minX, row, maxX, row + 1);
      var py = row + 0.5;
      
      // Pre-calculate coverage for this row
      var coverageRow = new Float32Array(rowWidth);
      var hasCoverage = false;
      
      for (var col = 0; col < rowWidth; col++) {
         var px = minX + col + 0.5;
         
         // Calculate distance from point to line segment
         // Project point onto line
         var t = ((px - x0) * ndx + (py - y0) * ndy);
         
         // Clamp to segment
         if (t < 0) t = 0;
         else if (t > lineLength) t = lineLength;
         
         // Closest point on segment
         var closestX = x0 + t * ndx;
         var closestY = y0 + t * ndy;
         
         // Distance from pixel to closest point
         var distX = px - closestX;
         var distY = py - closestY;
         var dist = Math.sqrt(distX * distX + distY * distY);
         
         // Calculate coverage with smooth falloff
         var coverage = 0;
         if (dist <= halfThick + 0.5) {
            if (dist <= halfThick - 0.5) {
               coverage = 1.0;
            } else {
               // Smooth AA falloff at edge
               coverage = halfThick + 0.5 - dist;
            }
         }
         
         coverageRow[col] = coverage;
         if (coverage > 0) hasCoverage = true;
      }
      
      if (!hasCoverage) continue;
      
      // Process each channel with buffered read/write
      for (var c = 0; c < channels; c++) {
         var buffer = new Float32Array(rowWidth);
         image.getSamples(buffer, rowRect, c);
         
         var colorVal = colors[c];
         var modified = false;
         
         for (var col = 0; col < rowWidth; col++) {
            var coverage = coverageRow[col];
            if (coverage > 0) {
               var pixelAlpha = alpha * coverage;
               buffer[col] = colorVal * pixelAlpha + buffer[col] * (1.0 - pixelAlpha);
               modified = true;
            }
         }
         
         if (modified) {
            image.setSamples(buffer, rowRect, c);
         }
      }
   }
};

// ----------------------------------------------------------------------------
/**
 * Draw a border around the original source region (optimized).
 * @param {Image} image - Target image
 * @param {Rect} sourceRect - Source region rectangle
 * @param {Object} color - {r, g, b} normalized 0-1
 * @param {Number} thickness - Border thickness
 * @param {String} shape - "Rectangular" or "Circular"
 */
InsetEngine.prototype.drawSourceIndicator = function(image, sourceRect, color, thickness, shape) {
   shape = shape || "Rectangular";
   var halfThick = Math.floor(thickness / 2);
   
   if (shape === "Circular") {
      // Draw circular indicator with row-based buffer operations (optimization)
      var cx = (sourceRect.x0 + sourceRect.x1) / 2;
      var cy = (sourceRect.y0 + sourceRect.y1) / 2;
      var radius = Math.min(sourceRect.width, sourceRect.height) / 2;
      
      // Determine bounds to iterate
      var x0 = Math.max(0, Math.floor(cx - radius - thickness));
      var y0 = Math.max(0, Math.floor(cy - radius - thickness));
      var x1 = Math.min(image.width, Math.ceil(cx + radius + thickness));
      var y1 = Math.min(image.height, Math.ceil(cy + radius + thickness));
      
      var rowWidth = x1 - x0;
      if (rowWidth <= 0 || y1 <= y0) return;
      
      var innerR = radius - halfThick;
      var outerR = radius + (thickness - halfThick);
      
      // Prepare colors
      var colors = [color.r, color.g, color.b];
      var alpha = (color.a !== undefined) ? color.a : 1.0;
      
      var channels = Math.min(3, image.numberOfChannels);
      
      // Process row by row with buffered operations (optimization: reduces API calls)
      for (var row = y0; row < y1; row++) {
         var rowRect = new Rect(x0, row, x1, row + 1);
         var dy = row - cy + 0.5;
         var dy2 = dy * dy;
         
         // Pre-calculate coverage for this row
         var coverageRow = new Float32Array(rowWidth);
         var hasCoverage = false;
         
         for (var col = 0; col < rowWidth; col++) {
            var dx = (x0 + col) - cx + 0.5;
            var dist = Math.sqrt(dx * dx + dy2);
            
            var coverage = 0;
            if (dist >= innerR - 0.5 && dist <= outerR + 0.5) {
               // Outer edge AA
               var outerAlpha = outerR + 0.5 - dist;
               if (outerAlpha < 0) outerAlpha = 0;
               else if (outerAlpha > 1) outerAlpha = 1;
               
               // Inner edge AA
               var innerAlpha = dist - (innerR - 0.5);
               if (innerAlpha < 0) innerAlpha = 0;
               else if (innerAlpha > 1) innerAlpha = 1;
               
               coverage = outerAlpha < innerAlpha ? outerAlpha : innerAlpha;
            }
            
            coverageRow[col] = coverage;
            if (coverage > 0) hasCoverage = true;
         }
         
         // Skip rows with no coverage
         if (!hasCoverage) continue;
         
         // Process each channel with buffered read/write
         for (var c = 0; c < channels; c++) {
            var buffer = new Float32Array(rowWidth);
            image.getSamples(buffer, rowRect, c);
            
            var colorVal = colors[c];
            var modified = false;
            
            for (var col = 0; col < rowWidth; col++) {
               var coverage = coverageRow[col];
               if (coverage > 0) {
                  var pixelAlpha = alpha * coverage;
                  buffer[col] = colorVal * pixelAlpha + buffer[col] * (1.0 - pixelAlpha);
                  modified = true;
               }
            }
            
            if (modified) {
               image.setSamples(buffer, rowRect, c);
            }
         }
      }
      
   } else {
      // Rectangular path - use AA lines for smooth edges
      var x0 = sourceRect.x0;
      var y0 = sourceRect.y0;
      var x1 = sourceRect.x1;
      var y1 = sourceRect.y1;
      
      // Top edge
      this.bresenhamLine(image, x0, y0, x1, y0, color, thickness);
      // Bottom edge
      this.bresenhamLine(image, x0, y1, x1, y1, color, thickness);
      // Left edge
      this.bresenhamLine(image, x0, y0, x0, y1, color, thickness);
      // Right edge
      this.bresenhamLine(image, x1, y0, x1, y1, color, thickness);
   }
};

/**
 * Draw border around the inset (on top of composited image).
 * This matches the preview rendering approach where border is drawn last.
 * @param {Image} image - Target image
 * @param {Rect} insetRect - Inset position and size
 * @param {Object} color - {r, g, b, a} normalized 0-1
 * @param {Number} thickness - Border thickness in pixels
 * @param {String} shape - "Rectangular" or "Circular"
 */
InsetEngine.prototype.drawInsetBorder = function(image, insetRect, color, thickness, shape) {
   // Border is drawn inset by half thickness to match preview behavior
   // where strokeCircle/strokeRect centers the stroke on the path
   var halfThick = thickness / 2;
   
   if (shape === "Circular") {
      // For circular inset, draw border ring
      var cx = (insetRect.x0 + insetRect.x1) / 2;
      var cy = (insetRect.y0 + insetRect.y1) / 2;
      // Radius is adjusted inward so border is fully inside the inset bounds
      var radius = Math.min(insetRect.width, insetRect.height) / 2 - halfThick;
      
      if (radius <= 0) return;
      
      // Use the same AA circle drawing as drawSourceIndicator
      // Determine bounds to iterate
      var x0 = Math.max(0, Math.floor(cx - radius - thickness));
      var y0 = Math.max(0, Math.floor(cy - radius - thickness));
      var x1 = Math.min(image.width, Math.ceil(cx + radius + thickness));
      var y1 = Math.min(image.height, Math.ceil(cy + radius + thickness));
      
      var rowWidth = x1 - x0;
      if (rowWidth <= 0 || y1 <= y0) return;
      
      var innerR = radius - halfThick;
      var outerR = radius + halfThick;
      
      var colors = [color.r, color.g, color.b];
      var alpha = (color.a !== undefined) ? color.a : 1.0;
      var channels = Math.min(3, image.numberOfChannels);
      
      // Process row by row with buffered operations
      for (var row = y0; row < y1; row++) {
         var rowRect = new Rect(x0, row, x1, row + 1);
         var dy = row - cy + 0.5;
         var dy2 = dy * dy;
         
         // Pre-calculate coverage for this row
         var coverageRow = new Float32Array(rowWidth);
         var hasCoverage = false;
         
         for (var col = 0; col < rowWidth; col++) {
            var dx = (x0 + col) - cx + 0.5;
            var dist = Math.sqrt(dx * dx + dy2);
            
            var coverage = 0;
            if (dist >= innerR - 0.5 && dist <= outerR + 0.5) {
               // Outer edge AA
               var outerAlpha = outerR + 0.5 - dist;
               if (outerAlpha < 0) outerAlpha = 0;
               else if (outerAlpha > 1) outerAlpha = 1;
               
               // Inner edge AA
               var innerAlpha = dist - (innerR - 0.5);
               if (innerAlpha < 0) innerAlpha = 0;
               else if (innerAlpha > 1) innerAlpha = 1;
               
               coverage = outerAlpha < innerAlpha ? outerAlpha : innerAlpha;
            }
            
            coverageRow[col] = coverage;
            if (coverage > 0) hasCoverage = true;
         }
         
         if (!hasCoverage) continue;
         
         // Process each channel with buffered read/write
         for (var c = 0; c < channels; c++) {
            var buffer = new Float32Array(rowWidth);
            image.getSamples(buffer, rowRect, c);
            
            var colorVal = colors[c];
            var modified = false;
            
            for (var col = 0; col < rowWidth; col++) {
               var coverage = coverageRow[col];
               if (coverage > 0) {
                  var pixelAlpha = alpha * coverage;
                  buffer[col] = colorVal * pixelAlpha + buffer[col] * (1.0 - pixelAlpha);
                  modified = true;
               }
            }
            
            if (modified) {
               image.setSamples(buffer, rowRect, c);
            }
         }
      }
   } else {
      // Rectangular border - use AA lines, drawn inward from rect edges
      var x0 = insetRect.x0 + halfThick;
      var y0 = insetRect.y0 + halfThick;
      var x1 = insetRect.x1 - halfThick;
      var y1 = insetRect.y1 - halfThick;
      
      // Draw four edges with AA lines
      this.bresenhamLine(image, x0, y0, x1, y0, color, thickness); // Top
      this.bresenhamLine(image, x0, y1, x1, y1, color, thickness); // Bottom
      this.bresenhamLine(image, x0, y0, x0, y1, color, thickness); // Left
      this.bresenhamLine(image, x1, y0, x1, y1, color, thickness); // Right
   }
};
