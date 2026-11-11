EXT := terminal-theme-sync

.PHONY: all check test install uninstall pack clean

all: check test

check test install uninstall pack clean:
	$(MAKE) -C $(EXT) $@
