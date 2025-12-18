#!/bin/bash
# Build script for pInset PixInsight repository package
# Usage: ./build-package.sh [version]
# Example: ./build-package.sh 1.0.0

set -e

VERSION=${1:-"1.0.0"}
DATE=$(date +%Y-%m-%d)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building pInset package version $VERSION..."

# Create temporary package directory
PACKAGE_DIR=$(mktemp -d)
mkdir -p "$PACKAGE_DIR/pInset/lib"

# Copy script files
cp "$SCRIPT_DIR/pInset.js" "$PACKAGE_DIR/pInset/"
cp "$SCRIPT_DIR/lib/"*.js "$PACKAGE_DIR/pInset/lib/"

# Create repository directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/repository"

# Create the package zip
cd "$PACKAGE_DIR"
zip -r "$SCRIPT_DIR/repository/pInset-$VERSION.zip" pInset/

# Update the repository index
cat > "$SCRIPT_DIR/repository/updates.xri" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<xri version="1.0" xmlns="http://www.pixinsight.com/xri" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.pixinsight.com/xri http://pixinsight.com/xri/xri-1.0.xsd">
   <Repository>
      <Name>pInset Repository</Name>
      <Description>Repository for the pInset PixInsight script - Create beautiful magnified insets on your astrophotography images</Description>
   </Repository>
   <Package>
      <Name>pInset</Name>
      <Version>${VERSION}</Version>
      <Type>Script</Type>
      <Platform>all</Platform>
      <ReleaseDate>${DATE}</ReleaseDate>
      <Title>pInset</Title>
      <Description>Create zoomed inset overlays on astronomical images. Select a region of interest, scale it up, and composite it onto the original image with customizable borders and positioning.</Description>
      <InstallLocation>scripts</InstallLocation>
      <PackageLocation>pInset-${VERSION}.zip</PackageLocation>
   </Package>
</xri>
EOF

# Cleanup
rm -rf "$PACKAGE_DIR"

echo ""
echo "✅ Package built successfully!"
echo "   - Package: repository/pInset-$VERSION.zip"
echo "   - Index: repository/updates.xri"
echo ""
echo "To deploy:"
echo "1. Push the repository/ folder to GitHub Pages"
echo "2. Users can add: https://<username>.github.io/<repo>/updates.xri"
