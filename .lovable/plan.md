# Sharper trip hero images

## Changes
- Add one shared quality check for trip and itinerary hero uploads.
- Require hero images to be at least 1600 × 900 pixels and allow files up to 10 MB, preventing low-resolution covers from being saved.
- Apply the same rules to file selection, drag-and-drop, paste uploads, itinerary covers, and group landing heroes.
- Add browser image hints so full-screen trip covers decode cleanly and render at their natural quality.

## Verification
- Confirm undersized images show a clear error before upload.
- Confirm a qualifying image uploads and appears on the shared trip preview.
- Check the full-screen preview at desktop and mobile widths.

## Existing images
- Existing low-resolution covers will not be artificially enlarged. They can be replaced through the normal cover controls; the new rules prevent future low-quality uploads.
