import os
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent

# Allow `pytest backend` from the repo root while keeping config local to backend/.
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
