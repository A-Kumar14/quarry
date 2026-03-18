.PHONY: install test security-check audit lint

# ── Install ────────────────────────────────────────────────────────────────────
install:
	pip install -r requirements.txt

install-dev:
	pip install -r requirements.txt pytest pytest-asyncio httpx pip-audit

# ── Tests ──────────────────────────────────────────────────────────────────────
test:
	pytest

test-v:
	pytest -v

# ── Security ───────────────────────────────────────────────────────────────────
audit:
	@echo "==> Running pip-audit against requirements.txt..."
	pip-audit -r requirements.txt --format columns
	@echo "==> Writing JSON report to security/pip-audit-report.json..."
	@mkdir -p security
	pip-audit -r requirements.txt --format json -o security/pip-audit-report.json
	@echo "==> Done."

security-check: audit test
	@echo "==> Security check complete."
