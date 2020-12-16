build:
	npm run make

install-macos: build
	rm -rf ~/Applications/catalyst.app
	rsync -av out/catalyst-darwin-x64/catalyst.app ~/Applications/

install-linux: build
	npm run make
	rm -rf ~/bin/catalyst
	ln -s ${PWD}/out/catalyst-linux-x64/catalyst ~/bin/

icons:
	electron-icon-maker --input=./icon.png --output=./src/assets/
