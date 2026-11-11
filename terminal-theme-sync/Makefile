UUID := terminal-theme-sync@jonathangn.github.io
DIST := dist

.PHONY: all check test install uninstall pack clean

all: check test

check:
	python3 -m json.tool metadata.json > /dev/null
	glib-compile-schemas --strict --dry-run schemas

test:
	glib-compile-schemas --strict schemas
	gjs -m tests/test-terminal-sync.js

install:
	./install.sh

uninstall:
	./uninstall.sh

pack:
	./pack.sh $(DIST)

clean:
	rm -rf $(DIST) schemas/gschemas.compiled
