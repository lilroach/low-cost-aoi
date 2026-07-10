import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from fastapi import HTTPException

from app.services.run_import_service import import_run_bundle_file


def _write_bundle(path: Path, run_id: str = "run-1", image_member: str = "images/a.jpg") -> None:
    manifest = {
        "schema_version": "1.0",
        "run_id": run_id,
        "machine_id": "pi-a",
        "created_at": "2026-07-10T12:00:00Z",
        "contents": {
            "report": "report.json",
            "program": "program.json",
            "images_dir": "images",
        },
    }
    report = {
        "metadata": {"machine_id": "pi-a"},
        "total_points": 0,
        "results": [],
        "completed_at": 1,
        "status": "completed",
    }
    with zipfile.ZipFile(path, "w") as bundle:
        bundle.writestr("manifest.json", json.dumps(manifest))
        bundle.writestr("report.json", json.dumps(report))
        bundle.writestr("program.json", '{"points": []}')
        bundle.writestr(image_member, b"jpeg")


class RunImportServiceTests(unittest.TestCase):
    def test_import_uses_storage_id_and_copies_images(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bundle_path = root / "run.zip"
            imported_dir = root / "imported"
            raw_dir = root / "raw"
            _write_bundle(bundle_path)

            result = import_run_bundle_file(
                bundle_path,
                imported_dir,
                raw_dir,
                storage_id="edge-a__run-1",
            )

            self.assertEqual(result["run_id"], "run-1")
            self.assertEqual(result["storage_id"], "edge-a__run-1")
            self.assertTrue((imported_dir / "edge-a__run-1" / "report.json").exists())
            self.assertTrue((raw_dir / "edge-a__run-1_a.jpg").exists())

    def test_import_rejects_unsafe_zip_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bundle_path = root / "unsafe.zip"
            _write_bundle(bundle_path, image_member="../escape.jpg")

            with self.assertRaises(HTTPException) as context:
                import_run_bundle_file(bundle_path, root / "imported", root / "raw")

            self.assertEqual(context.exception.status_code, 400)
            self.assertFalse((root / "escape.jpg").exists())

    def test_import_conflict_preserves_existing_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bundle_path = root / "run.zip"
            imported_dir = root / "imported"
            existing_dir = imported_dir / "edge-a__run-1"
            existing_dir.mkdir(parents=True)
            (existing_dir / "marker.txt").write_text("keep", encoding="utf-8")
            _write_bundle(bundle_path)

            with self.assertRaises(HTTPException) as context:
                import_run_bundle_file(
                    bundle_path,
                    imported_dir,
                    root / "raw",
                    storage_id="edge-a__run-1",
                    replace_existing=False,
                )

            self.assertEqual(context.exception.status_code, 409)
            self.assertEqual((existing_dir / "marker.txt").read_text(encoding="utf-8"), "keep")


if __name__ == "__main__":
    unittest.main()
