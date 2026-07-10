import json
import tempfile
import unittest
import zipfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from app import history_bundle


class HistoryBundleTests(unittest.TestCase):
    def test_build_history_bundle_returns_contract_zip(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            run_dir = root / "20260710_120000"
            run_dir.mkdir()
            (run_dir / "point-1.jpg").write_bytes(b"jpeg")
            (run_dir / "report.json").write_text(
                json.dumps(
                    {
                        "metadata": {"machine_id": "pi-a"},
                        "total_points": 1,
                        "results": [
                            {
                                "point_id": 1,
                                "x": 1,
                                "y": 2,
                                "result": "OK",
                                "detections": [],
                                "image_path": "20260710_120000/point-1.jpg",
                            }
                        ],
                        "completed_at": 1,
                        "status": "completed",
                    }
                ),
                encoding="utf-8",
            )
            (run_dir / "program.json").write_text('{"points": []}', encoding="utf-8")

            with patch.object(history_bundle, "HISTORY_DIR", root):
                payload = history_bundle.build_history_bundle("20260710_120000")

            with zipfile.ZipFile(BytesIO(payload)) as bundle:
                self.assertEqual(
                    {"manifest.json", "report.json", "program.json", "images/point-1.jpg"},
                    set(bundle.namelist()),
                )

    def test_build_history_bundle_rejects_path_traversal(self):
        with self.assertRaises(HTTPException) as context:
            history_bundle.build_history_bundle("../secret")

        self.assertEqual(context.exception.status_code, 400)

    def test_build_history_bundle_returns_404_for_missing_run(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(history_bundle, "HISTORY_DIR", Path(tmp)):
            with self.assertRaises(HTTPException) as context:
                history_bundle.build_history_bundle("missing")

        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
