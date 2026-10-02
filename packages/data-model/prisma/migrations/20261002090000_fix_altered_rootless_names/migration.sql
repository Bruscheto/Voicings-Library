-- Correct the two authored A/B names, preserving names users have since edited.
UPDATE "Voicing" AS voicing
SET "name" = correction.new_name
FROM (VALUES
  ('0-3-6-10', 'Rootless A altered', 'Rootless B altered'),
  ('0-4-6-9', 'Rootless B altered', 'Rootless A altered')
) AS correction(shape_key, old_name, new_name)
WHERE voicing."shapeKey" = correction.shape_key
  AND voicing."name" = correction.old_name;
