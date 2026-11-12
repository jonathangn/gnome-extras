# Build every extension in the repository. Each extension folder carries its
# own Makefile, so a new folder is picked up automatically.
EXTENSIONS := $(patsubst %/Makefile,%,$(wildcard */Makefile))

.PHONY: all check test install uninstall pack clean list

all check test install uninstall pack clean:
	@set -e; \
	if [ -z "$(EXTENSIONS)" ]; then \
		echo "No extension Makefiles found." >&2; \
		exit 1; \
	fi; \
	for ext in $(EXTENSIONS); do \
		echo "==> $$ext: $@"; \
		$(MAKE) -C "$$ext" $@; \
	done

list:
	@echo $(EXTENSIONS)
