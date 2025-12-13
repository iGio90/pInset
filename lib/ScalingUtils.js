// ----------------------------------------------------------------------------
// ScalingUtils.js - Image scaling/interpolation utilities for pInset
// ----------------------------------------------------------------------------
//
// Contains interpolation methods:
// - Nearest Neighbor (fastest, pixelated)
// - Bilinear (smooth, fast)
// - Bicubic (smooth, balanced)
// - Lanczos-3 (highest quality, slowest)
//
// Author: Giovanni Rocca (iGio90) and Antigravity
//
// ----------------------------------------------------------------------------

var ScalingUtils = {
   /**
    * Scale buffer using selected interpolation method.
    */
   scaleBuffer: function(src, srcW, srcH, dst, dstW, dstH, method) {
      switch (method) {
         case "nearest":
            this.nearestInterpolate(src, srcW, srcH, dst, dstW, dstH);
            break;
         case "bilinear":
            this.bilinearInterpolate(src, srcW, srcH, dst, dstW, dstH);
            break;
         case "lanczos":
            this.lanczosInterpolate(src, srcW, srcH, dst, dstW, dstH);
            break;
         case "bicubic":
         default:
            this.bicubicInterpolate(src, srcW, srcH, dst, dstW, dstH);
            break;
      }
   },
   
   /**
    * Nearest neighbor interpolation (fastest, pixelated).
    */
   nearestInterpolate: function(src, srcW, srcH, dst, dstW, dstH) {
      var xRatio = srcW / dstW;
      var yRatio = srcH / dstH;
      
      for (var y = 0; y < dstH; y++) {
         for (var x = 0; x < dstW; x++) {
            var srcX = Math.floor(x * xRatio);
            var srcY = Math.floor(y * yRatio);
            srcX = Math.min(srcX, srcW - 1);
            srcY = Math.min(srcY, srcH - 1);
            dst[y * dstW + x] = src[srcY * srcW + srcX];
         }
      }
   },
   
   /**
    * Bilinear interpolation (smooth, fast).
    */
   bilinearInterpolate: function(src, srcW, srcH, dst, dstW, dstH) {
      var xRatio = srcW / dstW;
      var yRatio = srcH / dstH;
      
      for (var y = 0; y < dstH; y++) {
         for (var x = 0; x < dstW; x++) {
            var srcX = x * xRatio;
            var srcY = y * yRatio;
            
            var x0 = Math.floor(srcX);
            var y0 = Math.floor(srcY);
            var x1 = Math.min(x0 + 1, srcW - 1);
            var y1 = Math.min(y0 + 1, srcH - 1);
            
            var xFrac = srcX - x0;
            var yFrac = srcY - y0;
            
            var v00 = src[y0 * srcW + x0];
            var v10 = src[y0 * srcW + x1];
            var v01 = src[y1 * srcW + x0];
            var v11 = src[y1 * srcW + x1];
            
            var top = v00 * (1 - xFrac) + v10 * xFrac;
            var bottom = v01 * (1 - xFrac) + v11 * xFrac;
            
            dst[y * dstW + x] = top * (1 - yFrac) + bottom * yFrac;
         }
      }
   },
   
   /**
    * Bicubic interpolation (smooth, balanced quality/speed).
    */
   bicubicInterpolate: function(src, srcW, srcH, dst, dstW, dstH) {
      var xRatio = srcW / dstW;
      var yRatio = srcH / dstH;
      var self = this;
      
      for (var y = 0; y < dstH; y++) {
         for (var x = 0; x < dstW; x++) {
            var srcX = x * xRatio;
            var srcY = y * yRatio;
            
            var x0 = Math.floor(srcX);
            var y0 = Math.floor(srcY);
            var xFrac = srcX - x0;
            var yFrac = srcY - y0;
            
            var sum = 0;
            var weightSum = 0;
            
            for (var j = -1; j <= 2; j++) {
               for (var i = -1; i <= 2; i++) {
                  var px = Math.max(0, Math.min(srcW - 1, x0 + i));
                  var py = Math.max(0, Math.min(srcH - 1, y0 + j));
                  var weight = self.cubicWeight(i - xFrac) * self.cubicWeight(j - yFrac);
                  sum += src[py * srcW + px] * weight;
                  weightSum += weight;
               }
            }
            
            dst[y * dstW + x] = Math.max(0, Math.min(1, sum / weightSum));
         }
      }
   },
   
   cubicWeight: function(t) {
      t = Math.abs(t);
      if (t <= 1) {
         return 1.5 * t * t * t - 2.5 * t * t + 1;
      } else if (t <= 2) {
         return -0.5 * t * t * t + 2.5 * t * t - 4 * t + 2;
      }
      return 0;
   },
   
   /**
    * Lanczos-3 interpolation (highest quality, slowest).
    */
   lanczosInterpolate: function(src, srcW, srcH, dst, dstW, dstH) {
      var xRatio = srcW / dstW;
      var yRatio = srcH / dstH;
      var a = 3;
      var self = this;
      
      for (var y = 0; y < dstH; y++) {
         for (var x = 0; x < dstW; x++) {
            var srcX = x * xRatio;
            var srcY = y * yRatio;
            
            var x0 = Math.floor(srcX);
            var y0 = Math.floor(srcY);
            
            var sum = 0;
            var weightSum = 0;
            
            for (var j = -a + 1; j <= a; j++) {
               for (var i = -a + 1; i <= a; i++) {
                  var px = Math.max(0, Math.min(srcW - 1, x0 + i));
                  var py = Math.max(0, Math.min(srcH - 1, y0 + j));
                  var dx = srcX - (x0 + i);
                  var dy = srcY - (y0 + j);
                  var weight = self.lanczosKernel(dx, a) * self.lanczosKernel(dy, a);
                  sum += src[py * srcW + px] * weight;
                  weightSum += weight;
               }
            }
            
            dst[y * dstW + x] = Math.max(0, Math.min(1, weightSum > 0 ? sum / weightSum : 0));
         }
      }
   },
   
   lanczosKernel: function(x, a) {
      if (x === 0) return 1;
      if (Math.abs(x) >= a) return 0;
      var pix = Math.PI * x;
      return (a * Math.sin(pix) * Math.sin(pix / a)) / (pix * pix);
   }
};
