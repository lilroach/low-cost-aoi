import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from fastapi import HTTPException

from app.api.training import _assert_run_dataset_matches_request
from app.api.datasets import _open_path


class TrainingApiTests(unittest.TestCase):
    def test_package_rejects_dataset_that_does_not_match_run_args(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            run_dir = root / "runs" / "board-a"
            run_dir.mkdir(parents=True)
            dataset_dir = root / "data" / "datasets" / "board-a-dataset"
            dataset_dir.mkdir(parents=True)
            (run_dir / "args.yaml").write_text(f"data: {dataset_dir.as_posix()}/data.yaml\n", encoding="utf-8")

            with self.assertRaises(HTTPException) as context:
                _assert_run_dataset_matches_request(run_dir, "other-dataset")

            self.assertEqual(context.exception.status_code, 400)
            self.assertIn("does not match", context.exception.detail)

    def test_open_path_is_disabled_by_default_outside_windows_terminal(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)
            with patch("app.api.datasets.os.name", "posix"), patch("app.api.datasets.subprocess.Popen") as popen:
                with self.assertRaises(HTTPException) as context:
                    _open_path(target)

            self.assertEqual(context.exception.status_code, 400)
            self.assertIn("only available", context.exception.detail)
            popen.assert_not_called()


if __name__ == "__main__":
    unittest.main()
