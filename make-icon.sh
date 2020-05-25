#!/usr/local/bin/bash

# from https://filipmolcik.com/convert-png-to-icns-right-click-converter/

mkdir -p icon.iconset
cp -v icon.png icon.iconset/icon.png
sips -z 16 16     icon.iconset/icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.iconset/icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.iconset/icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.iconset/icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.iconset/icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.iconset/icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.iconset/icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.iconset/icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.iconset/icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024   icon.iconset/icon.png --out icon.iconset/icon_1024x1024.png
cp -v icon.iconset/icon.png icon.iconset/icon_1024x1024@2x.png
rm -vrf icon.iconset/icon.png
iconutil -c icns icon.iconset
rm -vr icon.iconset
