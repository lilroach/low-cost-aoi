Simulated camera image folder

Put test photos in `images/` and add them to `manifest.json`.

Example:

```json
{
  "src": "/sim-camera/images/my-board-photo.jpg",
  "name": "my-board-photo.jpg"
}
```

When the Edge frontend is rebuilt, these files are served by nginx and used as the simulated Live camera source.
