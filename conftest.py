"""Configuration of pytest."""

import sys
from pathlib import Path

# Add the root directory to Python path so custom_components can be found
sys.path.insert(0, str(Path(Path(__file__).parent).resolve()))
