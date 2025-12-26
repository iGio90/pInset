#!/bin/bash
# Build script for pInset PixInsight repository package
# Usage: ./build-package.sh [version]
# Example: ./build-package.sh 1.0.0

set -e

VERSION=${1:-"1.1.1"}
DATE=$(date +%Y%m%d)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building pInset package version $VERSION..."

# Remove previous zip files
rm -f "$SCRIPT_DIR"/pInset-*.zip

# Create temporary package directory
PACKAGE_DIR=$(mktemp -d)
mkdir -p "$PACKAGE_DIR/src/scripts/pInset/lib"

# Copy script files
cp "$SCRIPT_DIR/pInset.js" "$PACKAGE_DIR/src/scripts/pInset/"
cp "$SCRIPT_DIR/lib/"*.js "$PACKAGE_DIR/src/scripts/pInset/lib/"

# Create the package zip
cd "$PACKAGE_DIR"
zip -r "$SCRIPT_DIR/pInset-$VERSION.zip" src/

# Calculate SHA1 hash
SHA1=$(shasum "$SCRIPT_DIR/pInset-$VERSION.zip" | cut -d' ' -f1)

# Update the repository index
cat > "$SCRIPT_DIR/updates.xri" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<xri version="1.0">
   <description>
      <p>
        Repository for pInset by Giovanni Rocca (iGio90) - Create beautiful magnified insets on your astrophotography images.
      </p>
   </description>
   <platform os="all" arch="noarch" version="1.8.9:1.9.99">
      <package fileName="pInset-${VERSION}.zip" sha1="${SHA1}"
               type="script" releaseDate="${DATE}">
         <title>
            pInset ${VERSION}
         </title>
         <description>
            <p>Create zoomed inset overlays on astronomical images. Select a region of interest, 
            scale it up, and composite it onto the original image with customizable borders and positioning.</p>
            <h3>Release ${VERSION}</h3>
            <ul>
               <li>Circular and rectangular inset shapes</li>
               <li>Customizable zoom, borders, and positioning</li>
               <li>Connection lines and source indicators</li>
               <li>Real-time preview</li>
            </ul>
         </description>
      </package>
   </platform>
</xri>
EOF

# Cleanup
rm -rf "$PACKAGE_DIR"

echo ""
echo "✅ Package built successfully!"
echo "   - Package: pInset-$VERSION.zip"
echo "   - SHA1: $SHA1"
echo "   - Index: updates.xri"
echo ""
echo "To deploy, commit and push the / folder."
echo "Users can add repository: https://raw.githubusercontent.com/igio90/pInset/main"
