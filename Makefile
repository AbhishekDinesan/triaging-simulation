.PHONY: dev frontend backend

dev:
	@echo "Starting backend (8000) and frontend (5173)..."
	@cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
	@cd frontend && npm run dev

frontend:
	@cd frontend && npm run dev

backend:
	@cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
