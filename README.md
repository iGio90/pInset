# pInset

**pInset** is a powerful yet easy-to-use script for **PixInsight** that allows you to create beautiful, magnified insets on your astrophotography images.

## The Story

I was browsing Astrobin when I saw a stunning image with a magnified inset showing off the details of a galaxy core. I immediately wanted to recreate that effect. A quick search led me to [this Photoshop tutorial](https://www.swagastro.com/creating-an-inset-in-photoshop.html), but since I'm not a Photoshop expert—and I prefer not to pay for software I wouldn't really use—I asked ChatGPT for an alternative.

It suggested using GIMP, warning me that creating a PixInsight plugin for this would be "too painful." After 15 minutes of failed attempts and eventual frustration with GIMP, I rage-quit.

## Installation

### Option 1: Via PixInsight Repository (Recommended)

1. Open PixInsight
2. Go to `Resources > Updates > Manage Repositories`
3. Click `Add` and enter:
   ```
   https://raw.githubusercontent.com/igio90/pInset/main/
   ```
4. Go to `Resources > Updates > Check for Updates`
5. Select **pInset** and click `Apply`

This method allows automatic updates when new versions are released.

### Option 2: Manual Installation

1.  Download the `pInset.js` file and the `lib` folder.
2.  Place them in your PixInsight scripts directory:
    *   **macOS**: `~/Library/Application Support/PixInsight/scripts/`
    *   **Windows**: `%APPDATA%\PixInsight\scripts\`
    *   **Linux**: `~/.PixInsight/scripts/`
3.  Restart PixInsight or go to `Script > Feature Scripts` -> `Add` to register the new script.

## What it does

Highlighting specific details in your deep-sky images—like a galaxy core, a planetary nebula, or a star cluster—often requires exporting your image to external tools like Photoshop. **pInset** brings this workflow directly into PixInsight.

With pInset, you can:
*   **Select & Magnify**: Easily draw a region of interest and choose your zoom level.
*   **Customize**: Adjust the position, size, and shape (circle or rectangle) of your inset.
*   **Style**: Automatically draw elegant connection lines and customize border colors and thickness to match your image.
*   **Preview**: See real-time updates as you tweak your settings before generating the final image.

## Usage

### 1. Raw Image
![Raw Image](screenshots/Screenshot%202025-12-12%20at%2016.45.35.png)

### 2. Extraction Phase
Select the shape and the zoom.

![Extraction Options](screenshots/Screenshot%202025-12-12%20at%2016.45.52.png)

### 3. Define Region
Draw a shape on the preview.

![Draw Shape](screenshots/Screenshot%202025-12-12%20at%2016.46.18.png)

### 4. Export
The shape is now exported into a new image.

![Exported Image](screenshots/Screenshot%202025-12-12%20at%2016.46.46.png)

### 5. Independent Processing
Apply additional processing to the zoomed image.

![Processing](screenshots/Screenshot%202025-12-12%20at%2016.51.45.png)
![Processing](screenshots/Screenshot%202025-12-12%20at%2017.26.30.png)

### 6. Finalize
Select finalize mode and join the 2 images.

![Finalize Mode](screenshots/Screenshot%202025-12-12%20at%2017.28.48.png)

### 7. Customize
Customize the inset view, resize and move around even outside the source image.

![Customize](screenshots/Screenshot%202025-12-12%20at%2017.29.00.png)
![Customize](screenshots/Screenshot%202025-12-12%20at%2017.29.12.png)
![Customize](screenshots/Screenshot%202025-12-12%20at%2017.29.43.png)
![Customize](screenshots/Screenshot%202025-12-12%20at%2017.31.09.png)
![Customize](screenshots/Screenshot%202025-12-12%20at%2017.31.30.png)

### 8. Results
And here are some results.

![Result](screenshots/Screenshot%202025-12-12%20at%2018.07.14.png)
![Result](screenshots/Screenshot%202025-12-12%20at%2018.12.08.png)
![Result](screenshots/Screenshot%202025-12-12%20at%2018.34.29.png)

## Requirements

*   PixInsight 1.8.9 or later

## License

MIT License
