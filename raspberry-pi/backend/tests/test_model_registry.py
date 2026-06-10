import tempfile
import unittest
from pathlib import Path

from app.model_registry import ModelRegistry, ModelRegistryError


class ModelRegistryTests(unittest.TestCase):
    def test_activate_rejects_valid_model_that_is_not_runtime_compatible(self):
        with tempfile.TemporaryDirectory() as tmp:
            registry = ModelRegistry(model_root=Path(tmp))
            registry._models = {
                "pt-model": {
                    "model_id": "pt-model",
                    "status": "valid",
                    "runtime_compatible": False,
                    "manifest": {
                        "part_no": "PCB-A",
                    },
                }
            }
            registry.refresh = lambda: registry.snapshot()

            with self.assertRaisesRegex(ModelRegistryError, "not compatible"):
                registry.activate("pt-model")


if __name__ == "__main__":
    unittest.main()
