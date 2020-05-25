install:
	npm run make
	rm -rf ~/Applications/catalyst.app
	rsync -av out/catalyst-darwin-x64/catalyst.app ~/Applications/
