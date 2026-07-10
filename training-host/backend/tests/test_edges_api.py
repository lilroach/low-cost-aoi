import unittest

from app.main import app


class EdgesApiTests(unittest.TestCase):
    def test_edge_routes_are_registered(self):
        paths = {route.path for route in app.routes}

        self.assertIn("/api/edges", paths)
        self.assertIn("/api/edges/{device_id}/test", paths)
        self.assertIn("/api/edges/{device_id}/sync", paths)
        self.assertIn("/api/edges/{device_id}/latest", paths)


if __name__ == "__main__":
    unittest.main()
