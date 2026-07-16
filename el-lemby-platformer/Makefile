# اللمبي: مغامرات الحارة — build helpers (macOS)

BUILD_DIR := .build/release
APP       := dist/ElLemby.app
ICON_SRC  := Sources/ElLembyCore/Resources/sprites/icon_256.png

.PHONY: run build test assets app icon clean

## Run the game from source (debug)
run:
	swift run ElLemby

## Release build
build:
	swift build -c release

## Run unit tests
test:
	swift test

## Regenerate all pixel art, SFX, the stage, and preview renders (needs python3)
assets:
	python3 tools/generate_assets.py
	python3 tools/generate_sfx.py
	python3 tools/build_level1.py
	python3 tools/render_level.py

## Assemble a double-clickable .app bundle in dist/
app: build
	rm -rf $(APP)
	mkdir -p $(APP)/Contents/MacOS $(APP)/Contents/Resources
	cp $(BUILD_DIR)/ElLemby $(APP)/Contents/MacOS/ElLemby
	cp -R $(BUILD_DIR)/ElLemby_ElLembyCore.bundle $(APP)/Contents/Resources/
	cp Info.plist $(APP)/Contents/Info.plist
	@if [ -f dist/AppIcon.icns ]; then cp dist/AppIcon.icns $(APP)/Contents/Resources/AppIcon.icns; fi
	@echo "→ $(APP)"

## Build the .icns app icon from the generated pixel art (macOS-only tools)
icon:
	rm -rf dist/AppIcon.iconset
	mkdir -p dist/AppIcon.iconset
	for s in 16 32 64 128 512; do \
		sips -z $$s $$s $(ICON_SRC) --out dist/AppIcon.iconset/icon_$${s}x$${s}.png >/dev/null; \
	done
	cp $(ICON_SRC) dist/AppIcon.iconset/icon_256x256.png
	iconutil -c icns dist/AppIcon.iconset -o dist/AppIcon.icns
	rm -rf dist/AppIcon.iconset
	@echo "→ dist/AppIcon.icns (re-run 'make app' to embed it)"

clean:
	rm -rf .build dist
