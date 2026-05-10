# Regression Evidence (T032)

## Command

- `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/ -q`

## Result

- Final passing run: `221 passed, 6 skipped, 2 warnings in 35.48s`.
- Known warnings are unchanged Pydantic shadowing warnings in `app/schemas.py` for field name `schema`.
